"""Tests for Turnitin Differentiators:
1. Source Code Plagiarism Detection & Renaming Obfuscation Resistance
2. 1-Click Smart Academic Citation Assistant (APA 7th, MLA 9th, Chicago 17th)
3. Explainable AI Perplexity Visualizer with ESL Student Bias Shield
4. Zero-Knowledge / Ephemeral Private Scan Guarantee
5. Code comparison & Citation endpoints
"""

import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.services.code_plagiarism import CodePlagiarismEngine
from app.services.citation_generator import SmartCitationGenerator
from app.services.ai_detector import AIDetectionEngine
from app.services.auth import create_access_token


def test_code_plagiarism_renaming_resistance():
    """Confirms AST identifier normalization detects plagiarism despite variable renaming."""
    original_code = '''
    def compute_average(scores):
        # Calculate sum of all exam scores
        total = 0
        for item in scores:
            total = total + item
        result = total / len(scores)
        return result
    '''

    renamed_code = '''
    def calc_mean(data_list):
        /* Copied algorithm with renamed variables */
        accumulator = 0
        for element in data_list:
            accumulator = accumulator + element
        output_val = accumulator / len(data_list)
        return output_val
    '''

    comparison = CodePlagiarismEngine.compare_code_submissions(original_code, renamed_code)
    assert comparison["similarity_score"] >= 70.0
    assert "Identical Structure" in comparison["structural_match_verdict"]
    assert comparison["shared_kgrams_count"] > 0


def test_code_plagiarism_dissimilar_logic():
    """Confirms different algorithms yield low structural similarity."""
    code_a = '''
    def binary_search(arr, target):
        low = 0
        high = len(arr) - 1
        while low <= high:
            mid = (low + high) // 2
            if arr[mid] == target:
                return mid
            elif arr[mid] < target:
                low = mid + 1
            else:
                high = mid - 1
        return -1
    '''

    code_b = '''
    def print_greeting(user):
        greeting = "Hello, " + user
        print(greeting)
        return greeting
    '''

    comparison = CodePlagiarismEngine.compare_code_submissions(code_a, code_b)
    assert comparison["similarity_score"] < 40.0
    assert comparison["structural_match_verdict"] == "Unique Independent Logic"


def test_code_file_extension_support():
    assert CodePlagiarismEngine.is_code_file("solution.py") is True
    assert CodePlagiarismEngine.is_code_file("App.tsx") is True
    assert CodePlagiarismEngine.is_code_file("engine.cpp") is True
    assert CodePlagiarismEngine.is_code_file("paper.pdf") is False
    assert CodePlagiarismEngine.is_code_file("essay.docx") is False


def test_smart_citation_generation():
    """Tests 1-click citation synthesis for APA 7th, MLA 9th, and Chicago 17th."""
    matched_text = "The quick brown fox jumps over the lazy dog."
    citations = SmartCitationGenerator.generate_all_citations(
        matched_text=matched_text,
        source_title="Advances in Quantum Computing",
        source_author="Dr. Alan M. Turing",
        source_url="https://doi.org/10.1000/182",
        institution="Cambridge Press"
    )

    # APA
    assert citations["apa"]["in_text"] == "(Turing, 2026)" or "(Turing," in citations["apa"]["in_text"]
    assert "Turing, A.M." in citations["apa"]["bibliography"] or "Turing" in citations["apa"]["bibliography"]
    assert "Cambridge Press" in citations["apa"]["bibliography"]

    # MLA
    assert "Turing" in citations["mla"]["in_text"]
    assert '"Advances in Quantum Computing."' in citations["mla"]["bibliography"]

    # Chicago
    assert "Cambridge Press" in citations["chicago"]["bibliography"]

    # Remediation quotes
    assert citations["remediation_quote_apa"].startswith('"The quick brown fox jumps over the lazy dog."')


def test_ai_detector_esl_bias_shield():
    """
    Confirms ESL Bias Shield mitigates false positives caused by
    uniform sentence structure and standard textbook transitions.
    """
    esl_sample = (
        "Furthermore, global warming is a serious problem for the entire planet. "
        "In addition, rising temperatures affect ocean ecosystems and agriculture. "
        "Moreover, international cooperation is essential to achieve sustainable energy goals. "
        "In conclusion, governments must enact strict climate policies to protect future generations."
    )

    # Standard mode (without shield) flags uniform textbook structure
    standard_result = AIDetectionEngine.analyze_text(esl_sample, esl_mode=False)
    # ESL mode (with shield) protects non-native student from false accusation
    esl_result = AIDetectionEngine.analyze_text(esl_sample, esl_mode=True)

    assert esl_result["esl_mode"] is True
    assert esl_result["esl_shield_applied"] is True
    assert esl_result["ai_probability"] <= standard_result["ai_probability"]
    assert "bias_shield_notes" in esl_result
    assert any("cleared by ESL Shield" in cue or "calibrated for ESL" in cue 
               for s in esl_result["sentence_analyses"] for cue in s["linguistic_cues"])


@pytest.mark.asyncio
async def test_api_citation_endpoint(client: AsyncClient):
    resp = await client.post(
        "/api/citations/generate",
        json={
            "matched_text": "Machine learning represents a paradigm shift.",
            "source_title": "Deep Learning Fundamentals",
            "source_author": "Geoffrey Hinton",
            "source_url": "https://arxiv.org/abs/12345",
            "institution": "University of Toronto"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "apa" in data
    assert "mla" in data
    assert "chicago" in data
    assert "Hinton" in data["apa"]["in_text"]


@pytest.mark.asyncio
async def test_api_code_compare_endpoint(client: AsyncClient):
    resp = await client.post(
        "/api/code/compare",
        json={
            "code_a": "def foo(x): return x * 2",
            "code_b": "def bar(val): return val * 2",
            "filename_a": "script1.py",
            "filename_b": "script2.py"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "comparison" in data
    assert data["comparison"]["similarity_score"] >= 60.0


@pytest.mark.asyncio
async def test_ephemeral_scan_guarantee(client: AsyncClient, auth_headers: dict):
    """Confirms Zero-Knowledge Ephemeral Mode does not persist document to repository."""
    resp = await client.post(
        "/api/v1/scan",
        headers=auth_headers,
        json={
            "text": "This is a private student paper being scanned under zero retention guarantee. " * 3,
            "title": "Private_Research.txt",
            "enable_web_search": False,
            "save_to_repository": True,  # User may set this, but ephemeral_mode should override!
            "ephemeral_mode": True,
            "esl_mode": True
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["ephemeral_mode"] is True
    assert data["zero_retention_guaranteed"] is True
    assert data["esl_mode"] is True

    # Verify it was NOT persisted to repository
    list_resp = await client.get("/api/repository/documents?search=Private_Research.txt")
    assert list_resp.status_code == 200
    assert list_resp.json()["total"] == 0
