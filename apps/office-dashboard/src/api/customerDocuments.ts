import { apiJson } from './index';
import { getApiUrl } from '@club-ops/shared';

export type CustomerDocumentRow = {
  id: string;
  has_pdf: boolean;
  created_at: string | null;
  visit_started_at: string | null;
};

export type CustomerDocumentsResponse = {
  documents: CustomerDocumentRow[];
};

export async function fetchDocumentCustomersByName(
  sessionToken: string,
  name: string,
  signal?: AbortSignal
): Promise<{ customers: any[] }> {
  return apiJson<{ customers: any[] }>(`/v1/documents/customers?name=${encodeURIComponent(name)}`,
    { sessionToken, signal }
  );
}

export async function fetchDocumentsByCustomerId(
  sessionToken: string,
  customerId: string,
  signal?: AbortSignal
): Promise<CustomerDocumentsResponse> {
  return apiJson<CustomerDocumentsResponse>(`/v1/documents/by-customer/${customerId}`,
    { sessionToken, signal }
  );
}

export async function downloadCustomerDocumentPdf(
  sessionToken: string,
  documentId: string,
  signal?: AbortSignal
): Promise<Blob> {
  const res = await fetch(getApiUrl(`/api/v1/documents/${documentId}/download`), {
    headers: { Authorization: `Bearer ${sessionToken}` },
    signal,
  });
  if (!res.ok) throw new Error('Download failed');
  return res.blob();
}

// (intentionally no admin endpoint helper here; office-dashboard uses /v1/documents/* for demo UI)
