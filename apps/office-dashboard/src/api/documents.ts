import { getApiUrl } from '@club-ops/shared';

export function getAdminDocumentDownloadUrl(documentId: string): string {
  return getApiUrl(`/api/v1/admin/documents/${documentId}`);
}

