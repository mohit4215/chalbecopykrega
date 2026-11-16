"""Source Code Plagiarism Detection & Structural AST Normalization Engine.

Differentiates Poach from Turnitin by analyzing source code in Python, JavaScript/TypeScript,
Java, C/C++, Go, and Rust. Defeats variable-renaming obfuscation, reordered declarations,
and comment-stripping through identifier normalization and structural n-gram fingerprinting.
"""

import re
from typing import List, Dict, Any, Tuple, Optional


class CodePlagiarismEngine:
    """Analyzes and cross-references source code submissions for structural copying."""

    SUPPORTED_EXTENSIONS = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
        ".java": "java",
        ".c": "c_cpp",
        ".cpp": "c_cpp",
        ".h": "c_cpp",
        ".cs": "csharp",
        ".go": "go",
        ".rs": "rust",
    }

    # Universal programming keywords that are preserved during normalization
    KEYWORDS = {
        "if", "else", "elif", "while", "for", "do", "return", "break", "continue",
        "def", "function", "class", "import", "from", "as", "try", "except", "catch",
        "finally", "raise", "throw", "public", "private", "protected", "static", "void",
        "int", "float", "double", "char", "string", "bool", "boolean", "new", "this",
        "super", "const", "let", "var", "switch", "case", "default", "struct", "enum"
    }

    @classmethod
    def is_code_file(cls, filename: str) -> bool:
        """Determines if a filename belongs to a supported programming language."""
        lower_name = filename.lower()
        return any(lower_name.endswith(ext) for ext in cls.SUPPORTED_EXTENSIONS)

    @classmethod
    def strip_comments_and_strings(cls, code: str, language: str = "generic") -> str:
        """Strips single-line and multi-line comments from code."""
        # Multi-line strings in Python: '''...''' or """..."""
        code = re.sub(r'("""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\')', ' "STR" ', code)
        # Block comments: /* ... */
        code = re.sub(r'/\*[\s\S]*?\*/', ' ', code)
        # Single-line comments: // or #
        code = re.sub(r'(//|#)[^\r\n]*', ' ', code)
        # String literals: "..." or '...'
        code = re.sub(r'("[^"\\]*(?:\\.[^"\\]*)*"|\'[^\'\\]*(?:\\.[^\'\\]*)*\')', ' "STR" ', code)
        return code

    @classmethod
    def normalize_identifiers(cls, code: str) -> Tuple[str, Dict[str, str]]:
        """
        Replaces user-defined variables and function identifiers with canonical placeholders
        (v1, v2, v3...) while retaining syntax control keywords (if, for, while, return).
        This defeats renaming obfuscation (e.g. changing 'student_grade' to 'x').
        """
        clean_code = cls.strip_comments_and_strings(code)
        tokens = re.findall(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b|[^\s\w]', clean_code)

        normalized_tokens: List[str] = []
        identifier_map: Dict[str, str] = {}
        id_counter = 1

        for tok in tokens:
            if re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', tok):
                lower_tok = tok.lower()
                if lower_tok in cls.KEYWORDS:
                    normalized_tokens.append(lower_tok)
                else:
                    if tok not in identifier_map:
                        identifier_map[tok] = f"v{id_counter}"
                        id_counter += 1
                    normalized_tokens.append(identifier_map[tok])
            else:
                normalized_tokens.append(tok)

        return " ".join(normalized_tokens), identifier_map

    @classmethod
    def extract_code_kgrams(cls, normalized_code: str, k: int = 6) -> List[str]:
        """Extracts rolling structural k-grams from the normalized token sequence."""
        tokens = normalized_code.split()
        if len(tokens) <= k:
            return [" ".join(tokens)] if tokens else []
        return [" ".join(tokens[i:i + k]) for i in range(len(tokens) - k + 1)]

    @classmethod
    def compare_code_submissions(
        cls,
        code_a: str,
        code_b: str,
        k: int = 6
    ) -> Dict[str, Any]:
        """
        Compares two source code texts and produces structural similarity,
        exact token match ratios, and variable renaming mappings.
        """
        norm_a, map_a = cls.normalize_identifiers(code_a)
        norm_b, map_b = cls.normalize_identifiers(code_b)

        kgrams_a = set(cls.extract_code_kgrams(norm_a, k=k))
        kgrams_b = set(cls.extract_code_kgrams(norm_b, k=k))

        if not kgrams_a or not kgrams_b:
            return {
                "similarity_score": 0.0,
                "shared_kgrams_count": 0,
                "structural_match_verdict": "Unique Logic",
                "total_kgrams_a": len(kgrams_a),
                "total_kgrams_b": len(kgrams_b)
            }

        shared_kgrams = kgrams_a.intersection(kgrams_b)
        union_kgrams = kgrams_a.union(kgrams_b)

        # Jaccard structural overlap
        similarity = round(len(shared_kgrams) / max(1, len(union_kgrams)) * 100.0, 2)

        verdict = (
            "Identical Structure (Likely Plagiarism / Obfuscated Renaming)"
            if similarity >= 70.0 else
            "Moderate Structural Similarity (Shared Algorithm or Boilerplate)"
            if similarity >= 40.0 else
            "Unique Independent Logic"
        )

        return {
            "similarity_score": similarity,
            "shared_kgrams_count": len(shared_kgrams),
            "structural_match_verdict": verdict,
            "total_kgrams_a": len(kgrams_a),
            "total_kgrams_b": len(kgrams_b),
            "identifiers_count_a": len(map_a),
            "identifiers_count_b": len(map_b)
        }
