"""MLOps Pipeline: Convert SentenceTransformers PyTorch Models to Optimized ONNX Format.

This module automates the conversion, graph optimization, and INT8 quantization of
SentenceTransformer models (e.g., 'all-MiniLM-L6-v2') for high-throughput CPU inference.

Key Optimizations:
1. End-to-End ONNX Graph: Fuses Transformer backbone + Mean Pooling + L2 Normalization
   directly into the ONNX graph so inference produces unit-normalized vectors in 1 pass.
2. Dynamic Axes: Fully dynamic batch size and sequence length for efficient variable-length chunking.
3. INT8 Dynamic Quantization: Reduces model footprint by ~75% (90MB -> 22MB) with ~2.5x CPU speedup.
4. Tokenizer Preservation: Exports tokenizer assets alongside the ONNX model graph.
"""

import os
import sys
import argparse
import logging
from typing import Optional, Dict, Any

logger = logging.getLogger("mlops.export_onnx")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def export_sentence_transformer_to_onnx(
    model_name: str = "sentence-transformers/all-MiniLM-L6-v2",
    output_path: str = "models/all-MiniLM-L6-v2.onnx",
    quantize: bool = True,
    quantized_output_path: Optional[str] = None,
    opset_version: int = 17,
) -> Dict[str, str]:
    """
    Exports a HuggingFace / SentenceTransformers model into an end-to-end ONNX model.
    The exported computation graph takes (input_ids, attention_mask) and outputs
    unit-normalized 384-dimensional dense sentence embeddings.
    """
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    if quantized_output_path is None:
        base, ext = os.path.splitext(output_path)
        quantized_output_path = f"{base}-quantized{ext}"

    try:
        import torch
        import torch.nn as nn
        from transformers import AutoTokenizer, AutoModel
    except ImportError as exc:
        logger.error(
            "PyTorch and Transformers are required for ONNX export: "
            "pip install torch transformers sentence-transformers"
        )
        raise RuntimeError(f"Missing export dependency: {exc}") from exc

    logger.info(f"Loading base HuggingFace model and tokenizer: '{model_name}'...")
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    base_transformer = AutoModel.from_pretrained(model_name)
    base_transformer.eval()

    # Define PyTorch wrapper that includes Mean Pooling & L2 Normalization in the computation graph
    class EndToEndSentenceEmbeddingModel(nn.Module):
        def __init__(self, transformer: nn.Module):
            super().__init__()
            self.transformer = transformer

        def forward(self, input_ids: torch.Tensor, attention_mask: torch.Tensor) -> torch.Tensor:
            outputs = self.transformer(input_ids=input_ids, attention_mask=attention_mask)
            token_embeddings = outputs[0]  # First element: last_hidden_state [batch, seq_len, dim]

            # Mean Pooling across attention mask
            input_mask_expanded = attention_mask.unsqueeze(-1).expand(token_embeddings.size()).float()
            sum_embeddings = torch.sum(token_embeddings * input_mask_expanded, dim=1)
            sum_mask = torch.clamp(input_mask_expanded.sum(dim=1), min=1e-9)
            pooled_embeddings = sum_embeddings / sum_mask

            # Unit L2 Normalization: vectors / norm
            norm = torch.norm(pooled_embeddings, p=2, dim=1, keepdim=True)
            norm = torch.clamp(norm, min=1e-12)
            normalized_embeddings = pooled_embeddings / norm
            return normalized_embeddings

    wrapper_model = EndToEndSentenceEmbeddingModel(base_transformer)
    wrapper_model.eval()

    # Create representative dummy inputs with dynamic dimensions
    dummy_text = ["This is a sample document passage to benchmark neural embeddings."]
    dummy_inputs = tokenizer(
        dummy_text,
        padding=True,
        truncation=True,
        max_length=128,
        return_tensors="pt"
    )

    input_names = ["input_ids", "attention_mask"]
    output_names = ["embeddings"]

    dynamic_axes = {
        "input_ids": {0: "batch_size", 1: "sequence_length"},
        "attention_mask": {0: "batch_size", 1: "sequence_length"},
        "embeddings": {0: "batch_size"},
    }

    logger.info(f"Exporting PyTorch model to ONNX: '{output_path}' (Opset: {opset_version})...")
    with torch.no_grad():
        torch.onnx.export(
            wrapper_model,
            (dummy_inputs["input_ids"], dummy_inputs["attention_mask"]),
            output_path,
            input_names=input_names,
            output_names=output_names,
            dynamic_axes=dynamic_axes,
            opset_version=opset_version,
            do_constant_folding=True,
        )

    # Save tokenizer configuration and vocabulary files in the same directory
    model_dir = os.path.dirname(os.path.abspath(output_path))
    logger.info(f"Saving tokenizer assets to '{model_dir}'...")
    tokenizer.save_pretrained(model_dir)

    result_paths = {"fp32_model": output_path}

    # Perform INT8 Dynamic Quantization
    if quantize:
        logger.info(f"Quantizing ONNX model to INT8: '{quantized_output_path}'...")
        try:
            from onnxruntime.quantization import quantize_dynamic, QuantType
            quantize_dynamic(
                model_input=output_path,
                model_output=quantized_output_path,
                weight_type=QuantType.QInt8,
                per_channel=True,
                reduce_range=True,
            )
            result_paths["quantized_model"] = quantized_output_path
            fp32_size = os.path.getsize(output_path) / (1024 * 1024)
            int8_size = os.path.getsize(quantized_output_path) / (1024 * 1024)
            logger.info(
                f"Quantization complete! FP32: {fp32_size:.2f} MB -> INT8: {int8_size:.2f} MB "
                f"({((fp32_size - int8_size) / fp32_size) * 100:.1f}% reduction)"
            )
        except Exception as q_err:
            logger.warning(f"INT8 Quantization failed: {q_err}. Using FP32 model.")

    return result_paths


def build_synthetic_onnx_model(output_path: str, dim: int = 384) -> str:
    """
    Builds a lightweight, valid ONNX graph that takes (input_ids, attention_mask)
    and produces unit-normalized (batch_size, dim) embeddings.
    Useful for testing ONNX Runtime inference sessions, SessionOptions, and
    MLOps pipelines in environments without PyTorch.
    """
    import onnx
    from onnx import helper, TensorProto
    import numpy as np

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    # Inputs: input_ids [batch, seq], attention_mask [batch, seq]
    input_ids = helper.make_tensor_value_info("input_ids", TensorProto.INT64, ["batch_size", "sequence_length"])
    attention_mask = helper.make_tensor_value_info("attention_mask", TensorProto.INT64, ["batch_size", "sequence_length"])
    embeddings = helper.make_tensor_value_info("embeddings", TensorProto.FLOAT, ["batch_size", dim])

    # Weights matrix: shape [1, dim]
    np_weights = (np.ones((1, dim), dtype=np.float32) * 0.1)
    weights_tensor = helper.make_tensor(
        name="projection_weights",
        data_type=TensorProto.FLOAT,
        dims=[1, dim],
        vals=np_weights.tobytes(),
        raw=True,
    )

    nodes = [
        helper.make_node("Cast", ["input_ids"], ["ids_float"], to=TensorProto.FLOAT),
        helper.make_node("ReduceMean", ["ids_float"], ["mean_token"], axes=[1], keepdims=1),
        helper.make_node("MatMul", ["mean_token", "projection_weights"], ["raw_vec"]),
        helper.make_node("LpNormalization", ["raw_vec"], ["embeddings"], axis=1, p=2),
    ]

    graph_def = helper.make_graph(
        nodes=nodes,
        name="SyntheticSentenceEmbedding",
        inputs=[input_ids, attention_mask],
        outputs=[embeddings],
        initializer=[weights_tensor],
    )

    model_def = helper.make_model(
        graph_def,
        producer_name="mlops.export_onnx",
        opset_imports=[helper.make_opsetid("", 13)],
        ir_version=9
    )
    onnx.checker.check_model(model_def)
    onnx.save(model_def, output_path)
    logger.info(f"Synthetic test ONNX embedding graph created at '{output_path}' (dim={dim}).")
    return output_path


def main():
    parser = argparse.ArgumentParser(description="Convert SentenceTransformers models to optimized ONNX.")
    parser.add_argument("--model", type=str, default="sentence-transformers/all-MiniLM-L6-v2", help="HuggingFace model ID")
    parser.add_argument("--output", type=str, default="models/all-MiniLM-L6-v2.onnx", help="Target ONNX model path")
    parser.add_argument("--quantize", action="store_true", default=True, help="Perform INT8 dynamic quantization")
    parser.add_argument("--synthetic", action="store_true", help="Generate synthetic test graph (zero PyTorch requirement)")
    parser.add_argument("--opset", type=int, default=17, help="ONNX operator set version")

    args = parser.parse_args()

    if args.synthetic:
        path = build_synthetic_onnx_model(args.output)
        print(f"Synthetic ONNX model created at: {path}")
        return

    try:
        paths = export_sentence_transformer_to_onnx(
            model_name=args.model,
            output_path=args.output,
            quantize=args.quantize,
            opset_version=args.opset,
        )
        print("Export successful:")
        for k, v in paths.items():
            print(f"  {k}: {v}")
    except Exception as exc:
        logger.error(f"Export failed: {exc}")
        sys.exit(1)


if __name__ == "__main__":
    main()
