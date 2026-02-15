import { apiJson } from './index';

export type AuthMeResponse = {
  staffId: string;
  name: string;
  role: string;
};

export async function fetchAuthMe(sessionToken: string, signal?: AbortSignal) {
  return apiJson<AuthMeResponse>('/v1/auth/me', { sessionToken, signal });
}

export async function logout(sessionToken: string, signal?: AbortSignal) {
  await apiJson('/v1/auth/logout', { method: 'POST', sessionToken, signal });
}
