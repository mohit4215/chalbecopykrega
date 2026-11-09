import { render, screen, fireEvent } from '@testing-library/react';
import ScoreGauge from '../components/ScoreGauge';
import DocumentViewer from '../components/DocumentViewer';
import SourcesSidebar from '../components/SourcesSidebar';

describe('Results Dashboard Component Tests', () => {
  const sampleSummary = {
    exact_matches_count: 2,
    paraphrase_matches_count: 1,
    internet_matches_count: 3
  };

  const sampleMatches = [
    {
      id: 'match_1',
      matched_text: 'Deep learning is a subset of machine learning',
      start_index: 0,
      end_index: 45,
      similarity_score: 0.95,
      match_type: 'exact_copy',
      source_title: 'Introduction to Deep Learning - MIT',
      source_url: 'https://mit.edu/deep-learning',
      source_category: 'Academic Database'
    },
    {
      id: 'match_2',
      matched_text: 'The landmark Transformer paradigm discarded recurrent modules',
      start_index: 60,
      end_index: 122,
      similarity_score: 0.84,
      match_type: 'paraphrase',
      source_title: 'Attention Mechanisms in NLP',
      source_url: 'https://arxiv.org/abs/1706.03762',
      source_category: 'Internet Source'
    }
  ];

  describe('ScoreGauge Component', () => {
    test('renders low similarity score and original badge for score under 20%', () => {
      render(
        <ScoreGauge
          overallScore={12}
          originalityScore={88}
          summary={sampleSummary}
        />
      );

      expect(screen.getByText('12%')).toBeInTheDocument();
      expect(screen.getByText('88%')).toBeInTheDocument();
      expect(screen.getByText('Low Similarity')).toBeInTheDocument();
    });

    test('renders high plagiarism badge for score above 40%', () => {
      render(
        <ScoreGauge
          overallScore={65}
          originalityScore={35}
          summary={sampleSummary}
        />
      );

      expect(screen.getByText('65%')).toBeInTheDocument();
      expect(screen.getByText('High Plagiarism')).toBeInTheDocument();
    });
  });

  describe('DocumentViewer Component', () => {
    test('renders extracted text with highlighted matches', () => {
      const fullText = 'Deep learning is a subset of machine learning and here is some unique text.';
      render(
        <DocumentViewer
          fullText={fullText}
          matches={sampleMatches}
          selectedMatchId={null}
          onSelectMatch={jest.fn()}
        />
      );

      expect(screen.getByText(/here is some unique text/i)).toBeInTheDocument();
      // Verifies that text segments from matches are present in document
      expect(screen.getByText(/Deep learning is a subset of machine learning/i)).toBeInTheDocument();
    });
  });

  describe('SourcesSidebar Component', () => {
    test('renders list of matched sources with similarity percentages', () => {
      const mockOnSelectMatch = jest.fn();
      const mockOnOpenDiff = jest.fn();

      render(
        <SourcesSidebar
          matches={sampleMatches}
          selectedMatchId="match_1"
          onSelectMatch={mockOnSelectMatch}
          onOpenDiff={mockOnOpenDiff}
        />
      );

      expect(screen.getByText('Introduction to Deep Learning - MIT')).toBeInTheDocument();
      expect(screen.getByText('95%')).toBeInTheDocument();
      expect(screen.getByText('Attention Mechanisms in NLP')).toBeInTheDocument();
      expect(screen.getByText('84%')).toBeInTheDocument();
    });

    test('triggers onSelectMatch callback when a source item is clicked', () => {
      const mockOnSelectMatch = jest.fn();
      render(
        <SourcesSidebar
          matches={sampleMatches}
          selectedMatchId={null}
          onSelectMatch={mockOnSelectMatch}
          onOpenDiff={jest.fn()}
        />
      );

      const sourceCard = screen.getByText('Introduction to Deep Learning - MIT');
      fireEvent.click(sourceCard);

      expect(mockOnSelectMatch).toHaveBeenCalledWith(sampleMatches[0]);
    });
  });
});
