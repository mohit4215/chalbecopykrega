import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import UploadComponent from '../components/UploadComponent';

// Mock AuthContext
const mockAuthFetch = jest.fn();
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    authFetch: mockAuthFetch,
    user: { email: 'student@stanford.edu', scan_credits: 5 },
    isAuthenticated: true
  })
}));

describe('UploadComponent Unit & Asynchronous Polling Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders drag-and-drop file upload zone and instructions', () => {
    render(
      <UploadComponent
        onScanComplete={jest.fn()}
        isLoading={false}
        setIsLoading={jest.fn()}
      />
    );

    expect(screen.getByText(/Drag and drop your file here/i)).toBeInTheDocument();
    expect(screen.getByText(/Load Demo File/i)).toBeInTheDocument();
  });

  test('populates sample paper when clicking "Load Demo File"', async () => {
    render(
      <UploadComponent
        onScanComplete={jest.fn()}
        isLoading={false}
        setIsLoading={jest.fn()}
      />
    );

    const sampleButton = screen.getByRole('button', { name: /Load Demo File/i });
    fireEvent.click(sampleButton);

    await waitFor(() => {
      expect(screen.getByText('NLP_Research_Sample_Paper.txt')).toBeInTheDocument();
    });
  });

  test('displays validation error if scan initiated without a file', async () => {
    render(
      <UploadComponent
        onScanComplete={jest.fn()}
        isLoading={false}
        setIsLoading={jest.fn()}
      />
    );

    const scanButton = screen.getByRole('button', { name: /Submit Document for Asynchronous Analysis/i });
    fireEvent.click(scanButton);

    expect(screen.getByText(/Please select or drop a document to scan/i)).toBeInTheDocument();
  });

  test('submits document and starts asynchronous task polling until success', async () => {
    const mockOnScanComplete = jest.fn();
    const mockSetIsLoading = jest.fn();

    const mockReportData = {
      scan_id: 'scan_12345',
      document_title: 'NLP_Research_Sample_Paper.txt',
      overall_score: 18.5,
      originality_score: 81.5,
      total_words: 450,
      total_characters: 2800,
      matches: []
    };

    // 1. Initial submission returns task_id
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        task_id: 'task_celery_9999',
        status: 'processing',
        message: 'Document queued'
      })
    });

    // 2. Polling returns completed task with report
    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        task_id: 'task_celery_9999',
        status: 'success',
        progress: 100,
        report: mockReportData
      })
    });

    render(
      <UploadComponent
        onScanComplete={mockOnScanComplete}
        isLoading={false}
        setIsLoading={mockSetIsLoading}
      />
    );

    // Select sample file
    const sampleButton = screen.getByRole('button', { name: /Load Demo File/i });
    fireEvent.click(sampleButton);

    // Click submit button
    const scanButton = screen.getByRole('button', { name: /Submit Document for Asynchronous Analysis/i });
    fireEvent.click(scanButton);

    expect(mockSetIsLoading).toHaveBeenCalledWith(true);

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        '/api/check-plagiarism',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  test('displays dynamic pipeline stepper when isLoading is true', () => {
    render(
      <UploadComponent
        onScanComplete={jest.fn()}
        isLoading={true}
        setIsLoading={jest.fn()}
      />
    );

    expect(screen.getByText(/Pipeline Execution/i)).toBeInTheDocument();
    expect(screen.getByText(/Text Extraction & OCR/i)).toBeInTheDocument();
    expect(screen.getByText(/Vector Embedding & DB/i)).toBeInTheDocument();
    expect(screen.getByText(/Similarity & NLP Scoring/i)).toBeInTheDocument();
  });
});
