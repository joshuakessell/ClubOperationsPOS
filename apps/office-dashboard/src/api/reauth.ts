import { apiJson } from './index';

export async function reauthPin(
  sessionToken: string,
  pin: string,
  signal?: AbortSignal
): Promise<void> {
  await apiJson('/v1/auth/reauth-pin', {
    method: 'POST',
    sessionToken,
    body: { pin },
    signal,
  });
}

