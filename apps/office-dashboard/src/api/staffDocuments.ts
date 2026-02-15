import { apiJson } from './index';

export type StaffDocument = {
  id: string;
  docType: string;
  filename: string;
  mimeType: string;
  uploadedAt: string;
  notes: string | null;
};

export type UploadStaffDocumentRequest = {
  docType: string;
  filename: string;
  mimeType: string;
  fileData: string;
  notes?: string;
};

export async function fetchStaffDocuments(
  sessionToken: string,
  staffId: string,
  signal?: AbortSignal
): Promise<StaffDocument[]> {
  return apiJson<StaffDocument[]>(`/v1/admin/employees/${staffId}/documents`, {
    sessionToken,
    signal,
  });
}

export async function uploadStaffDocument(
  sessionToken: string,
  staffId: string,
  body: UploadStaffDocumentRequest,
  signal?: AbortSignal
): Promise<void> {
  await apiJson(`/v1/admin/employees/${staffId}/documents`, {
    method: 'POST',
    sessionToken,
    body,
    signal,
  });
}

