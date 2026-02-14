import { apiJson } from './index';

export type Device = {
  deviceId: string;
  displayName: string;
  enabled: boolean;
};

export type DevicesResponse = {
  devices: Device[];
};

export async function fetchDevices(sessionToken: string, signal?: AbortSignal) {
  const devices = await apiJson<Device[]>('/v1/admin/devices', { sessionToken, signal });
  return { devices };
}

export async function createDevice(
  sessionToken: string,
  body: unknown,
  signal?: AbortSignal
): Promise<Device> {
  return apiJson<Device>('/v1/admin/devices', { method: 'POST', sessionToken, body, signal });
}

export async function updateDevice(
  sessionToken: string,
  deviceId: string,
  body: unknown,
  signal?: AbortSignal
): Promise<Device> {
  return apiJson<Device>(`/v1/admin/devices/${deviceId}`, {
    method: 'PATCH',
    sessionToken,
    body,
    signal,
  });
}

export async function deleteDevice(
  sessionToken: string,
  deviceId: string,
  signal?: AbortSignal
): Promise<void> {
  await apiJson(`/v1/admin/devices/${deviceId}`, { method: 'DELETE', sessionToken, signal });
}
