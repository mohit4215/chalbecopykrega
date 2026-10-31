import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('UploadComponent Unit & Interaction Tests', () => {
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
    expect(screen.getByText(/Supported formats/i)).toBeInTheDocument();
    expect(screen.getByText(/Use Sample Research Paper/i)).toBeInTheDocument();
  });

  test('populates sample paper when clicking "Use Sample Research Paper"', async () => {
    render(
      <UploadComponent
        onScanComplete={jest.fn()}
        isLoading={false}
        setIsLoading={jest.fn()}
      />
    );

    const sampleButton = screen.getByRole('button', { name: /Use Sample Research Paper/i });
    fireEvent.click(sampleButton);

    await waitFor(() => {
      expect(screen.getByText('NLP_Research_Sample_Paper.txt')).toBeInTheDocument();
      expect(screen.getByText(/Ready to Scan/i)).toBeInTheDocument();
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

    const scanButton = screen.getByRole('button', { name: /Begin Plagiarism & Similarity Audit/i });
    fireEvent.click(scanButton);

    expect(screen.getByText(/Please select or drop a document to scan/i)).toBeInTheDocument();
  });

  test('submits document and triggers onScanComplete callback on success', async () => {
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

    mockAuthFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockReportData
    });

    render(
      <UploadComponent
        onScanComplete={mockOnScanComplete}
        isLoading={false}
        setIsLoading={mockSetIsLoading}
      />
    );

    // 1. Select sample file
    const sampleButton = screen.getByRole('button', { name: /Use Sample Research Paper/i });
    fireEvent.click(sampleButton);

    // 2. Click scan button
    const scanButton = screen.getByRole('button', { name: /Begin Plagiarism & Similarity Audit/i });
    fireEvent.click(scanButton);

    expect(mockSetIsLoading).toHaveBeenCalledWith(true);

    await waitFor(() => {
      expect(mockAuthFetch).toHaveBeenCalledWith(
        '/api/check-plagiarism',
        expect.objectContaining({ method: 'POST' })
      );
      expect(mockOnScanComplete).toHaveBeenCalledWith(mockReportData);
    });
  });

  test('displays loading spinner state when isLoading is true', () => {
    render(
      <UploadComponent
        onScanComplete={jest.fn()}
        isLoading={true}
        setIsLoading={jest.fn()}
      />
    );

    expect(screen.getByText(/Processing Document.../i)).toBeInTheDocument();
    expect(screen.getByText(/Extracting text & applying OCR fallback/i)).toBeInTheDocument();
  });
});
