import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CitationAssistantModal from '../components/CitationAssistantModal';
import AiSentenceHeatmap from '../components/AiSentenceHeatmap';
import CodePlagiarismModal from '../components/CodePlagiarismModal';
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
});
