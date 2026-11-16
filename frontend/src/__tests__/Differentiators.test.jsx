import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import CitationAssistantModal from '../components/CitationAssistantModal';
import AiSentenceHeatmap from '../components/AiSentenceHeatmap';
import CodePlagiarismModal from '../components/CodePlagiarismModal';
import OriginalityCertificateModal from '../components/OriginalityCertificateModal';
import AdversarialEvasionBanner from '../components/AdversarialEvasionBanner';
import DiffModal from '../components/DiffModal';
import { AuthProvider } from '../context/AuthContext';

describe('Turnitin Differentiators Component Tests', () => {
  const mockMatch = {
    id: 'match_123',
    matched_text: 'Deep learning is a subset of machine learning.',
    source_title: 'Introduction to Neural Networks',
    source_author: 'Geoffrey Hinton',
    source_category: 'Academic Paper',
    source_url: 'https://arxiv.org/abs/12345',
    smart_citations: {
      apa: {
        in_text: '(Hinton, 2026)',
        quoted_text: '"Deep learning is a subset of machine learning." (Hinton, 2026)',
        bibliography: 'Hinton, G. (2026). Introduction to Neural Networks. Academic Paper. https://arxiv.org/abs/12345'
      },
      mla: {
        in_text: '(Hinton)',
        quoted_text: '"Deep learning is a subset of machine learning." (Hinton)',
        bibliography: 'Hinton, Geoffrey. "Introduction to Neural Networks." Academic Paper, 2026. https://arxiv.org/abs/12345.'
      },
      chicago: {
        footnote: '1. Geoffrey Hinton, "Introduction to Neural Networks" (Academic Paper, 2026).',
        bibliography: 'Hinton, Geoffrey. "Introduction to Neural Networks." Academic Paper, 2026.'
      }
    }
  };

  test('CitationAssistantModal renders APA, MLA, and Chicago citations and handles tab switching', () => {
    const handleClose = jest.fn();
    render(
      <CitationAssistantModal
        match={mockMatch}
        isOpen={true}
        onClose={handleClose}
      />
    );

    // Checks header & APA default
    expect(screen.getByText(/Smart Academic Citation Assistant/i)).toBeInTheDocument();
    expect(screen.getByText('(Hinton, 2026)')).toBeInTheDocument();
    expect(screen.getByText(/Hinton, G\. \(2026\)/i)).toBeInTheDocument();

    // Switch to MLA tab
    const mlaTab = screen.getByRole('button', { name: /MLA 9th Edition/i });
    fireEvent.click(mlaTab);
    expect(screen.getByText('(Hinton)')).toBeInTheDocument();
    expect(screen.getByText(/Works Cited Entry/i)).toBeInTheDocument();

    // Switch to Chicago tab
    const chicagoTab = screen.getByRole('button', { name: /Chicago 17th/i });
    fireEvent.click(chicagoTab);
    expect(screen.getByText(/Bibliography Entry/i)).toBeInTheDocument();

    // Close modal
    const doneButton = screen.getByRole('button', { name: /Done/i });
    fireEvent.click(doneButton);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('AiSentenceHeatmap displays metrics, ESL shield status, and sentence breakdown', () => {
    const mockAiDetection = {
      ai_probability: 32.5,
      human_probability: 67.5,
      verdict: 'Mixed / AI-Assisted',
      esl_shield_applied: true,
      sentence_analyses: [
        {
          sentence: 'Furthermore, international cooperation is essential for renewable energy development.',
          ai_score: 0.35,
          is_ai_flagged: false,
          linguistic_cues: ["Standard transition 'furthermore' (cleared by ESL Shield)", "Human length variance"]
        },
        {
          sentence: 'It delves into the realm of multifaceted machine learning architectures.',
          ai_score: 0.85,
          is_ai_flagged: true,
          linguistic_cues: ["Synthetic LLM cliché pattern: 'delves into'", "Uniform sentence length"]
        }
      ],
      metrics: {
        burstiness_score: 0.52,
        lexical_diversity: 0.88,
        ai_marker_count: 1,
        total_sentences: 2,
        flagged_ai_sentences: 1
      }
    };

    render(
      <AiSentenceHeatmap
        aiDetection={mockAiDetection}
      />
    );

    expect(screen.getAllByText(/ESL Bias Shield Active/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/32.5%/i)).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 2/i)).toBeInTheDocument();

    // Click to expand sentence list
    const expandBtn = screen.getByRole('button', { name: /View Sentence Breakdown/i });
    fireEvent.click(expandBtn);

    expect(screen.getByText(/Furthermore, international cooperation/i)).toBeInTheDocument();
    expect(screen.getByText(/cleared by ESL Shield/i)).toBeInTheDocument();
    expect(screen.getByText(/It delves into the realm/i)).toBeInTheDocument();
  });

  test('CodePlagiarismModal renders with dual editor panes and AST explanation', () => {
    const handleClose = jest.fn();
    render(
      <AuthProvider>
        <CodePlagiarismModal
          isOpen={true}
          onClose={handleClose}
        />
      </AuthProvider>
    );

    expect(screen.getByText(/Source Code Plagiarism & Renaming Inspector/i)).toBeInTheDocument();
    expect(screen.getByText(/Submission A \(Reference Code\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Submission B \(Suspect \/ Renamed Code\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Run Structural AST Diff/i })).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: /Close/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('OriginalityCertificateModal renders cryptographic certificate and handles close', () => {
    const handleClose = jest.fn();
    const mockReport = {
      scan_id: 'scan_abcdef123456',
      document_title: 'Quantum Neural Entanglement Thesis',
      originality_score: 96,
      overall_score: 4,
      adversarial_integrity: {
        sha256_hash: '3a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456789abcdef01',
        integrity_status: 'Verified Clean'
      },
      certificate: {
        certificate_id: 'cert_scan_abcde',
        document_title: 'Quantum Neural Entanglement Thesis',
        sha256: '3a4b5c6d7e8f90123456789abcdef0123456789abcdef0123456789abcdef01',
        issued_at: '2026-11-16T12:00:00Z',
        overall_score: 4,
        originality_score: 96,
        ai_probability: 2,
        integrity_status: 'Verified Clean',
        verification_seal: 'Cryptographically Verified by Poach Academic Integrity Protocol',
        verification_url: 'https://chalbecopykrega-app.onrender.com/verify/cert_scan_abcde'
      }
    };

    render(
      <OriginalityCertificateModal
        report={mockReport}
        isOpen={true}
        onClose={handleClose}
      />
    );

    expect(screen.getByText(/Official Originality Certificate/i)).toBeInTheDocument();
    expect(screen.getByText(/Certificate ID:/i)).toBeInTheDocument();
    expect(screen.getAllByText(/cert_scan_abcde/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Quantum Neural Entanglement Thesis/i)).toBeInTheDocument();
    expect(screen.getByText(/96%/i)).toBeInTheDocument();
    expect(screen.getByText(/Verified Clean/i)).toBeInTheDocument();

    // Close button test
    const closeBtn = screen.getByRole('button', { name: /^Close$/i });
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('AdversarialEvasionBanner warns about homoglyphs and expands tampering logs', () => {
    const mockIntegrity = {
      tampering_detected: true,
      integrity_status: 'Evasion Attempt Neutralized',
      integrity_score: 64.0,
      homoglyphs_detected_count: 5,
      zero_width_chars_count: 3,
      detected_tampering: {
        homoglyphs: [
          {
            char: 'а',
            code_point: 'U+0430',
            script: 'CYRILLIC SMALL LETTER A',
            replaced_with: 'a',
            context: 'mаchine'
          }
        ],
        zero_width_characters: ['U+200B']
      }
    };

    render(
      <AdversarialEvasionBanner adversarialIntegrity={mockIntegrity} />
    );

    expect(screen.getByText(/Adversarial Evasion Attempt Neutralized/i)).toBeInTheDocument();
    expect(screen.getByText(/5 Cyrillic\/Greek homoglyphs/i)).toBeInTheDocument();
    expect(screen.getByText(/3 invisible characters/i)).toBeInTheDocument();

    // Expand tampering logs
    const inspectBtn = screen.getByRole('button', { name: /Inspect Intercepted Characters/i });
    fireEvent.click(inspectBtn);

    expect(screen.getByText(/U\+0430/i)).toBeInTheDocument();
    expect(screen.getByText(/CYRILLIC SMALL LETTER A/i)).toBeInTheDocument();
    expect(screen.getByText(/Document Integrity Score:/i)).toBeInTheDocument();
  });

  test('DiffModal allows tab switching to Student Remediation Sandbox and evaluating live revision', async () => {
    const handleClose = jest.fn();
    const mockRemediationResponse = {
      initial_similarity: 88.0,
      revised_similarity: 12.0,
      similarity_reduction: 76.0,
      remediation_success: true,
      is_partial: false,
      verdict: 'Successfully Remediated',
      remaining_verbatim_phrases: [],
      pedagogical_feedback: 'Outstanding synthesis! You reduced source similarity from 88.0% down to 12.0%.'
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRemediationResponse,
    });

    render(
      <DiffModal
        match={mockMatch}
        isOpen={true}
        onClose={handleClose}
      />
    );

    // Initial state: Diff tab active
    expect(screen.getByText(/Side-by-Side Source Comparison/i)).toBeInTheDocument();
    expect(screen.getByText(/Submitted Student Work/i)).toBeInTheDocument();

    // Switch to Remediation Sandbox tab
    const sandboxTab = screen.getByRole('button', { name: /Student Remediation Sandbox/i });
    fireEvent.click(sandboxTab);

    expect(screen.getByText(/Pedagogical Learning Sandbox vs\. Turnitin Punitive Flagging/i)).toBeInTheDocument();
    expect(screen.getByText(/Your Rewritten Revision:/i)).toBeInTheDocument();

    // Click Live Re-Check
    const checkBtn = screen.getByRole('button', { name: /Live Re-Check Overlap/i });
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(screen.getByText(/Successfully Remediated/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/Outstanding synthesis!/i)).toBeInTheDocument();
    expect(screen.getByText(/-76%/i)).toBeInTheDocument();

    // Cleanup fetch mock
    global.fetch.mockRestore();
  });
});
