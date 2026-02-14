import { apiJson } from './index';
import type { PasskeyCredential } from '../staff/types';

export type WebAuthnCredentialsResponse = {
  credentials: PasskeyCredential[];
};

export async function fetchWebAuthnCredentials(
  sessionToken: string,
  staffId: string,
  signal?: AbortSignal
): Promise<WebAuthnCredentialsResponse> {
  return apiJson<WebAuthnCredentialsResponse>(`/v1/auth/webauthn/credentials/${staffId}`, {
    sessionToken,
    signal,
  });
}

export async function revokeWebAuthnCredential(
  sessionToken: string,
  credentialId: string,
  signal?: AbortSignal
): Promise<void> {
  await apiJson(`/v1/auth/webauthn/credentials/${credentialId}/revoke`, {
    method: 'POST',
    sessionToken,
    signal,
  });
}

