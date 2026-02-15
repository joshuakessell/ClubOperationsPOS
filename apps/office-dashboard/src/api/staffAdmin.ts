import { apiJson } from './index';

export type StaffMember = {
  id: string;
  name: string;
  role: 'STAFF' | 'ADMIN';
  active: boolean;
  createdAt: string;
  lastLogin: string | null;
};

export type StaffListResponse = {
  staff: StaffMember[];
};

export type CreateStaffRequest = {
  name: string;
  role: 'STAFF' | 'ADMIN';
  pin: string;
  active: boolean;
};

export async function fetchStaff(
  sessionToken: string,
  params: URLSearchParams,
  signal?: AbortSignal
): Promise<StaffListResponse> {
  return apiJson<StaffListResponse>(`/v1/admin/staff?${params}`, { sessionToken, signal });
}

export async function createStaff(
  sessionToken: string,
  body: CreateStaffRequest,
  signal?: AbortSignal
): Promise<void> {
  await apiJson('/v1/admin/staff', { method: 'POST', sessionToken, body, signal });
}

export async function updateStaff(
  sessionToken: string,
  staffId: string,
  body: unknown,
  signal?: AbortSignal
): Promise<void> {
  await apiJson(`/v1/admin/staff/${staffId}`, {
    method: 'PATCH',
    sessionToken,
    body,
    signal,
  });
}

export async function resetStaffPin(
  sessionToken: string,
  staffId: string,
  newPin: string,
  signal?: AbortSignal
): Promise<void> {
  await apiJson(`/v1/admin/staff/${staffId}/pin-reset`, {
    method: 'POST',
    sessionToken,
    body: { newPin },
    signal,
  });
}

