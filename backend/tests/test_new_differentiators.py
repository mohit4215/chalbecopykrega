"""Tests for Advanced Turnitin Differentiators (Strengthened Suite):
1. Full-Spectrum Adversarial Evasion & Unicode Homoglyph Scanner
2. Interactive Student Remediation Sandbox with Patchwriting Detection & Token Diff
3. Cryptographic Originality Certificate API
4. Cross-Cohort Collusion Matrix & Peer-Sharing Ring Detection Engine
5. Source Code AST Obfuscation & Dummy-Code Injection Neutralizer
"""

import pytest
from httpx import AsyncClient
from app.services.adversarial_detector import AdversarialDetector
from app.services.remediation_engine import RemediationEngine
from app.services.collusion_detector import CohortCollusionDetector
from app.services.code_plagiarism import CodePlagiarismEngine
from app.main import CERTIFICATE_REGISTRY


def test_adversarial_homoglyph_detection_and_unmasking():
    """Confirms Cyrillic homoglyphs replacing Latin vowels are intercepted and neutralized."""
    obfuscated_text = "This m\u0430chin\u0435 l\u0435\u0430rning mod\u0435l is highly adv\u0430nc\u0435d."
    audit = AdversarialDetector.audit_and_unmask(obfuscated_text)

    assert audit["tampering_detected"] is True
    assert audit["homoglyphs_detected_count"] >= 5
    assert audit["integrity_status"] == "Adversarial Evasion Attempted"
    assert audit["integrity_score"] < 80.0
    # Clean Latin representation
    assert audit["unmasked_text"] == "This machine learning model is highly advanced."


def test_adversarial_zero_width_spaces_stripping():
    """Confirms zero-width spaces (\u200B) and BOM (\uFEFF) injected to break N-grams are detected and stripped."""
    tampered_text = "Deep\u200blearning\ufeffis\u200ba\u200csubset\u200dof\u2060AI."
    audit = AdversarialDetector.audit_and_unmask(tampered_text)

    assert audit["tampering_detected"] is True
    assert audit["zero_width_chars_count"] >= 5
    assert "\u200b" not in audit["unmasked_text"]
    assert "\ufeff" not in audit["unmasked_text"]


def test_adversarial_full_spectrum_and_punctuation_splitting():
    """Confirms Cherokee/math symbols and in-word punctuation splitting (p.l.a.g.i.a.r.i.s.m) are defeated."""
    # "p.l.a.g.i.a.r.i.s.m" split with dots
    split_text = "Students attempt p.l.a.g.i.a.r.i.s.m to evade detectors."
    audit = AdversarialDetector.audit_and_unmask(split_text)

    assert audit["tampering_detected"] is True
    assert audit["punctuation_splits_count"] >= 1
    assert "plagiarism" in audit["unmasked_text"]
    assert "Punctuation In-Word Splitting" in audit["evasion_tactics_detected"]


def test_adversarial_clean_text_integrity():
    clean_text = "This is a clean academic paper written purely with standard Latin characters."
    audit = AdversarialDetector.audit_and_unmask(clean_text)

    assert audit["tampering_detected"] is False
    assert audit["integrity_score"] == 100.0
    assert audit["integrity_status"] == "Verified Clean"
    assert audit["homoglyphs_detected_count"] == 0
    assert audit["zero_width_chars_count"] == 0
    assert audit["threat_level"] == "CLEAN"


def test_remediation_engine_successful_synthesis():
    """Confirms when a student rewrites a copied sentence in their own words, similarity drops."""
    source_sentence = "The landmark Transformer paradigm discarded recurrent modules completely, depending exclusively on self-attention calculations."
    original_flagged = "The Transformer paradigm discarded recurrent modules completely, depending exclusively on self-attention."
    revised_student = "Modern language models eliminated sequential loops entirely by calculating contextual weights between words in parallel."

    result = RemediationEngine.evaluate_revision(
        original_text=original_flagged,
        revised_text=revised_student,
        source_text=source_sentence
    )

    assert result["remediation_success"] is True
    assert result["revised_similarity"] <= 20.0
    assert result["similarity_reduction"] >= 50.0
    assert result["verdict"] == "Successfully Remediated"
    assert len(result["token_diff"]) > 0


def test_remediation_engine_patchwriting_detection():
    """Confirms patchwriting (thesaurus swapping identical clause backbone) is flagged."""
    source = "The company reported high financial losses during the second quarter of the fiscal year."
    # Synonym replacement keeping exact syntactic skeleton
    patchwritten = "The firm announced elevated fiscal damages throughout the following period of the business year."

    result = RemediationEngine.evaluate_revision(
        original_text=source,
        revised_text=patchwritten,
        source_text=source
    )

    assert result["is_patchwriting"] is True
    assert "Patchwriting" in result["verdict"]


def test_cohort_collusion_matrix_analysis():
    """Confirms cohort collusion matrix flags student peer sharing rings."""
    cohort = [
        {
            "id": "sub_1",
            "student_name": "Alice",
            "text": "Convolutional neural networks process pixel values through kernel filters to classify visual features efficiently."
        },
        {
            "id": "sub_2",
            "student_name": "David",
            "text": "Convolutional neural networks process pixel values through kernel filters to classify visual patterns efficiently."
        },
        {
            "id": "sub_3",
            "student_name": "Charlie",
            "text": "Decision tree classifiers segment dataset attributes using information gain and Gini impurity metrics."
        }
    ]

    analysis = CohortCollusionDetector.analyze_cohort(cohort, threshold=30.0)

    assert analysis["cohort_size"] == 3
    assert len(analysis["matrix"]) == 3
    assert analysis["matrix"][0][0] == 100.0
    # Alice & David have high overlap
    assert analysis["matrix"][0][1] >= 60.0
    # Charlie is independent
    assert analysis["matrix"][0][2] < 15.0
    assert len(analysis["suspicious_pairs"]) >= 1
    assert analysis["suspicious_pairs"][0]["student_a"] in ["Alice", "David"]


def test_code_plagiarism_dead_code_pruning():
    """Confirms dead code injection (dummy variables/prints) is detected and pruned."""
    code_a = """
    def bubble_sort(arr):
        n = len(arr)
        for i in range(n):
            for j in range(0, n - i - 1):
                if arr[j] > arr[j + 1]:
                    arr[j], arr[j + 1] = arr[j + 1], arr[j]
        return arr
    """

    code_b = """
    def my_sort(data):
        dummy_flag = False
        print("sorting")
        length = len(data)
        for x in range(length):
            for y in range(0, length - x - 1):
                if data[y] > data[y + 1]:
                    data[y], data[y + 1] = data[y + 1], data[y]
        return data
    """

    comp = CodePlagiarismEngine.compare_code_submissions(code_a, code_b)

    assert comp["similarity_score"] >= 65.0
    assert comp["pruned_dummy_lines_b"] >= 1
    assert comp["obfuscation_neutralized"] is True


@pytest.mark.asyncio
async def test_remediation_api_endpoint(client: AsyncClient):
    resp = await client.post(
        "/api/remediation/evaluate",
        json={
            "original_text": "Deep learning is a subset of machine learning using neural networks.",
            "revised_text": "Artificial neural architectures represent a specialized branch of automated pattern recognition.",
            "source_text": "Deep learning is a subset of machine learning using artificial neural networks."
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "remediation_success" in data
    assert "similarity_reduction" in data
    assert "token_diff" in data


@pytest.mark.asyncio
async def test_cohort_collusion_api_endpoint(client: AsyncClient):
    resp = await client.post(
        "/api/cohort/collusion-matrix",
        json={
            "threshold": 30.0,
            "submissions": [
                {
                    "student_name": "Student A",
                    "title": "Quantum Paper",
                    "text": "Quantum superposition allows qubits to exist in multiple simultaneous states before measurement collapses them."
                },
                {
                    "student_name": "Student B",
                    "title": "Quantum Physics Copy",
                    "text": "Quantum superposition allows qubits to exist in multiple simultaneous states before measurement collapses them."
                }
            ]
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["cohort_size"] == 2
    assert data["matrix"][0][1] >= 90.0
    assert len(data["suspicious_pairs"]) == 1


@pytest.mark.asyncio
async def test_certificate_public_api_endpoint(client: AsyncClient):
    test_cert_id = "cert_test_12345"
    CERTIFICATE_REGISTRY[test_cert_id] = {
        "certificate_id": test_cert_id,
        "document_title": "Quantum_Computing_Thesis.pdf",
        "sha256": "abcdef1234567890",
        "issued_at": "2026-11-16T12:00:00Z",
        "overall_score": 4.5,
        "originality_score": 95.5,
        "ai_probability": 0.0,
        "integrity_status": "Verified Clean",
        "verification_seal": "Cryptographically Verified by Poach Academic Integrity Protocol"
    }

    resp = await client.get(f"/api/certificate/{test_cert_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "verified"
    assert data["certificate"]["certificate_id"] == test_cert_id
    assert data["certificate"]["originality_score"] == 95.5

    missing_resp = await client.get("/api/certificate/cert_non_existent")
    assert missing_resp.status_code == 404
