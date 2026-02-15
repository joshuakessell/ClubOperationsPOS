import { apiJson } from './index';

export type StaffEmployee = {
  id: string;
  name: string;
  role: 'STAFF' | 'ADMIN';
};

export type StaffEmployeeListResponse = {
  staff: StaffEmployee[];
};

export type StaffSession = {
  staffId: string;
  name: string;
  role: 'STAFF' | 'ADMIN';
  sessionToken: string;
};

export type StaffLoginPinRequest = {
  staffLookup: string;
  deviceId: string;
  pin: string;
  deviceType: 'tablet' | 'kiosk' | 'desktop';
};

export async function fetchAuthStaff(signal?: AbortSignal): Promise<StaffEmployeeListResponse> {
  return apiJson<StaffEmployeeListResponse>('/v1/auth/staff', { signal });
}

export async function loginPin(
  body: StaffLoginPinRequest,
  signal?: AbortSignal
): Promise<StaffSession> {
  return apiJson<StaffSession>('/v1/auth/login-pin', {
    method: 'POST',
    body,
    signal,
  });
}

