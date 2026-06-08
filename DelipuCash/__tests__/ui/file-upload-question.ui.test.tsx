/**
 * Regression tests for FileUploadQuestion (respondent-facing survey file upload).
 *
 * Covers the three fixes:
 *  1. The advertised 25MB cap is enforced client-side (oversized files never upload).
 *  2. A file restored from a draft (currentFileId set, but no in-memory uploadedFile)
 *     is still deletable.
 *  3. The in-flight upload state is surfaced to the parent via onUploadingChange so it
 *     can block navigation — and is always cleared on unmount.
 *
 * expo-document-picker and the upload/delete hooks are mocked so the component renders
 * deterministically in jsdom without native bindings.
 */
import React from 'react';
import { renderWithProviders, screen, fireEvent, act, waitFor } from '@/test-utils';
import { FileUploadQuestion } from '@/components/survey/FileUploadQuestion';

const mockGetDocument = jest.fn();
jest.mock('expo-document-picker', () => ({
  __esModule: true,
  getDocumentAsync: (...args: unknown[]) => mockGetDocument(...args),
}));

const mockUploadMutate = jest.fn();
const mockDeleteMutate = jest.fn();
const mockUploadState = { progress: 0, isUploading: false };

jest.mock('@/services/surveyFileHooks', () => ({
  __esModule: true,
  useUploadSurveyFile: () => ({
    mutate: mockUploadMutate,
    reset: jest.fn(),
    progress: mockUploadState.progress,
    isUploading: mockUploadState.isUploading,
  }),
  useDeleteSurveyFile: () => ({ mutate: mockDeleteMutate, isPending: false }),
}));

const MB = 1024 * 1024;

function setPickedFile(size: number) {
  mockGetDocument.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file:///tmp/doc.pdf', name: 'doc.pdf', mimeType: 'application/pdf', size }],
  });
}

beforeEach(() => {
  mockGetDocument.mockReset();
  mockUploadMutate.mockReset();
  mockDeleteMutate.mockReset();
  mockUploadState.progress = 0;
  mockUploadState.isUploading = false;
});

describe('FileUploadQuestion — 25MB cap', () => {
  it('rejects an oversized file and never starts the upload', async () => {
    setPickedFile(30 * MB);

    renderWithProviders(
      <FileUploadQuestion surveyId="s-1" questionId="q-1" onFileUploaded={jest.fn()} />
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Tap to upload a file'));
    });

    await waitFor(() => expect(screen.getByText(/File is too large/)).toBeOnTheScreen());
    expect(mockUploadMutate).not.toHaveBeenCalled();
  });

  it('uploads a file within the limit', async () => {
    setPickedFile(5 * MB);

    renderWithProviders(
      <FileUploadQuestion surveyId="s-1" questionId="q-1" onFileUploaded={jest.fn()} />
    );

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Tap to upload a file'));
    });

    await waitFor(() => expect(mockUploadMutate).toHaveBeenCalledTimes(1));
    expect(mockUploadMutate.mock.calls[0][0]).toMatchObject({
      surveyId: 's-1',
      questionId: 'q-1',
      fileName: 'doc.pdf',
    });
  });
});

describe('FileUploadQuestion — draft-resumed file', () => {
  it('can be deleted even though no in-memory upload result exists', () => {
    const onFileDeleted = jest.fn();
    renderWithProviders(
      <FileUploadQuestion
        surveyId="s-1"
        questionId="q-1"
        onFileUploaded={jest.fn()}
        onFileDeleted={onFileDeleted}
        currentFileId="file-123"
      />
    );

    // Resumed file renders the "uploaded" UI with a delete control.
    fireEvent.press(screen.getByLabelText('Delete uploaded file'));

    expect(mockDeleteMutate).toHaveBeenCalledTimes(1);
    expect(mockDeleteMutate.mock.calls[0][0]).toEqual({ surveyId: 's-1', fileId: 'file-123' });
  });
});

describe('FileUploadQuestion — onUploadingChange', () => {
  it('reports the in-flight upload state to the parent', () => {
    mockUploadState.isUploading = true;
    const onUploadingChange = jest.fn();

    renderWithProviders(
      <FileUploadQuestion
        surveyId="s-1"
        questionId="q-1"
        onFileUploaded={jest.fn()}
        onUploadingChange={onUploadingChange}
      />
    );

    expect(onUploadingChange).toHaveBeenCalledWith(true);
  });

  it('clears the uploading flag on unmount', () => {
    const onUploadingChange = jest.fn();
    const { unmount } = renderWithProviders(
      <FileUploadQuestion
        surveyId="s-1"
        questionId="q-1"
        onFileUploaded={jest.fn()}
        onUploadingChange={onUploadingChange}
      />
    );

    onUploadingChange.mockClear();
    unmount();
    expect(onUploadingChange).toHaveBeenCalledWith(false);
  });
});
