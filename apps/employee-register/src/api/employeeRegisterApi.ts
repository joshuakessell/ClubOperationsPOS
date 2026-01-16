export const API_BASE = '/api' as const;

export type ApiError = Error & {
  status: number;
  body: unknown;
};

export function isApiError(err: unknown): err is ApiError {
  return (
    err instanceof Error &&
    typeof (err as { status?: unknown }).status === 'number' &&
    'body' in (err as object)
  );
}

function makeApiError(params: { status: number; message: string; body: unknown }): ApiError {
  const err = new Error(params.message) as ApiError;
  err.status = params.status;
  err.body = params.body;
  return err;
}

function authHeaders(sessionToken: string | null | undefined): Record<string, string> {
  if (!sessionToken) return {};
  return { Authorization: `Bearer ${sessionToken}` };
}

function jsonHeaders(sessionToken: string | null | undefined): Record<string, string> {
  return { 'Content-Type': 'application/json', ...authHeaders(sessionToken) };
}

async function readJsonSafe<T>(res: Response): Promise<T | null> {
  // Avoid throwing on empty or non-JSON bodies; callers can decide fallback behavior.
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    // Some endpoints respond with empty body; treat as null.
    return null;
  }
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function getErrorMessageFromBody(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const rec = body as Record<string, unknown>;
  const error = rec['error'];
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const msg = (error as Record<string, unknown>)['message'];
    if (typeof msg === 'string') return msg;
  }
  const details = rec['details'];
  if (typeof details === 'string') return details;
  return null;
}

async function requestJson<T>(url: string, init: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await readJsonSafe<unknown>(res);
  if (!res.ok) {
    throw makeApiError({
      status: res.status,
      message: getErrorMessageFromBody(body) || `Request failed (${res.status})`,
      body,
    });
  }
  return body as T;
}

async function requestVoid(url: string, init: RequestInit): Promise<void> {
  const res = await fetch(url, init);
  const body = await readJsonSafe<unknown>(res);
  if (!res.ok) {
    throw makeApiError({
      status: res.status,
      message: getErrorMessageFromBody(body) || `Request failed (${res.status})`,
      body,
    });
  }
}

async function requestBlob(url: string, init: RequestInit): Promise<Blob> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const body = await readJsonSafe<unknown>(res);
    throw makeApiError({
      status: res.status,
      message: getErrorMessageFromBody(body) || `Request failed (${res.status})`,
      body,
    });
  }
  return await res.blob();
}

export type CustomerSuggestion = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  dobMonthDay?: string;
  membershipNumber?: string;
  disambiguator: string;
};

export async function searchCustomers(params: {
  sessionToken: string | null;
  query: string;
  limit: number;
  signal?: AbortSignal;
}): Promise<{ suggestions: CustomerSuggestion[] }> {
  const { sessionToken, query, limit, signal } = params;
  const url = `${API_BASE}/v1/customers/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url, { headers: authHeaders(sessionToken), signal });
  const body = await readJsonSafe<unknown>(res);
  if (!res.ok) {
    throw makeApiError({
      status: res.status,
      message: getErrorMessageFromBody(body) || 'Search failed',
      body,
    });
  }
  const parsed = (body ?? {}) as { suggestions?: CustomerSuggestion[] };
  return { suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [] };
}

export async function registerSignout(params: {
  sessionToken: string | null;
  deviceId: string;
}): Promise<void> {
  return requestVoid(`${API_BASE}/v1/registers/signout`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({ deviceId: params.deviceId }),
  });
}

export async function authLogout(params: { sessionToken: string | null }): Promise<void> {
  return requestVoid(`${API_BASE}/v1/auth/logout`, {
    method: 'POST',
    headers: authHeaders(params.sessionToken),
  });
}

export type LaneSessionStartResponse = {
  sessionId?: string;
  customerName?: string;
  membershipNumber?: string;
  mode?: 'INITIAL' | 'RENEWAL';
  blockEndsAt?: string;
  activeAssignedResourceType?: 'room' | 'locker';
  activeAssignedResourceNumber?: string;
};

export async function startLaneSession(params: {
  sessionToken: string | null;
  lane: string;
  body: { customerId?: string; idScanValue?: string; membershipScanValue?: string };
}): Promise<LaneSessionStartResponse> {
  return requestJson<LaneSessionStartResponse>(`${API_BASE}/v1/checkin/lane/${params.lane}/start`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify(params.body),
  });
}

export async function scanId(params: {
  sessionToken: string | null;
  lane: string;
  payload: unknown;
}): Promise<LaneSessionStartResponse> {
  // payload is IdScanPayload (from @club-ops/shared) in the caller; keep module decoupled.
  return requestJson<LaneSessionStartResponse>(`${API_BASE}/v1/checkin/lane/${params.lane}/scan-id`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify(params.payload),
  });
}

export type CustomerMatchIdentityResponse = {
  matchCount?: number;
  bestMatch?: { id?: string; name?: string; membershipNumber?: string | null; dob?: string | null } | null;
};

export async function customersMatchIdentity(params: {
  sessionToken: string | null;
  firstName: string;
  lastName: string;
  dob: string;
}): Promise<CustomerMatchIdentityResponse> {
  return requestJson<CustomerMatchIdentityResponse>(`${API_BASE}/v1/customers/match-identity`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({ firstName: params.firstName, lastName: params.lastName, dob: params.dob }),
  });
}

export type CustomerCreateManualResponse = { customer?: { id?: string } };

export async function customersCreateManual(params: {
  sessionToken: string | null;
  firstName: string;
  lastName: string;
  dob: string;
}): Promise<CustomerCreateManualResponse> {
  return requestJson<CustomerCreateManualResponse>(`${API_BASE}/v1/customers/create-manual`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({ firstName: params.firstName, lastName: params.lastName, dob: params.dob }),
  });
}

export type CheckinScanResponse = {
  result: 'MATCHED' | 'NO_MATCH' | 'MULTIPLE_MATCHES' | 'ERROR';
  scanType?: 'STATE_ID' | 'MEMBERSHIP';
  customer?: { id: string; name: string; membershipNumber: string | null };
  extracted?: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    dob?: string;
    idNumber?: string;
    issuer?: string;
    jurisdiction?: string;
  };
  candidates?: Array<{
    id: string;
    name: string;
    dob: string | null;
    membershipNumber: string | null;
    matchScore: number;
  }>;
  normalizedRawScanText?: string;
  idScanHash?: string;
  membershipCandidate?: string;
  error?: { code?: string; message?: string };
};

export async function checkinScan(params: {
  sessionToken: string | null;
  laneId: string;
  rawScanText: string;
  selectedCustomerId?: string;
}): Promise<CheckinScanResponse> {
  return requestJson<CheckinScanResponse>(`${API_BASE}/v1/checkin/scan`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({
      laneId: params.laneId,
      rawScanText: params.rawScanText,
      selectedCustomerId: params.selectedCustomerId,
    }),
  });
}

export async function customersCreateFromScan(params: {
  sessionToken: string | null;
  idScanValue: string;
  idScanHash?: string;
  firstName: string;
  lastName: string;
  dob: string;
}): Promise<CustomerCreateManualResponse> {
  return requestJson<CustomerCreateManualResponse>(`${API_BASE}/v1/customers/create-from-scan`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({
      idScanValue: params.idScanValue,
      idScanHash: params.idScanHash || undefined,
      firstName: params.firstName,
      lastName: params.lastName,
      dob: params.dob,
    }),
  });
}

export async function laneReset(params: { sessionToken: string | null; lane: string }): Promise<void> {
  // Caller expects 404 to be tolerated in some contexts.
  return requestVoid(`${API_BASE}/v1/checkin/lane/${params.lane}/reset`, {
    method: 'POST',
    headers: authHeaders(params.sessionToken),
  });
}

export async function checkoutClaim(params: {
  sessionToken: string | null;
  requestId: string;
}): Promise<void> {
  return requestVoid(`${API_BASE}/v1/checkout/${params.requestId}/claim`, {
    method: 'POST',
    headers: authHeaders(params.sessionToken),
  });
}

export async function checkoutConfirmItems(params: {
  sessionToken: string | null;
  requestId: string;
}): Promise<void> {
  return requestVoid(`${API_BASE}/v1/checkout/${params.requestId}/confirm-items`, {
    method: 'POST',
    headers: authHeaders(params.sessionToken),
  });
}

export async function checkoutMarkFeePaid(params: {
  sessionToken: string | null;
  requestId: string;
}): Promise<void> {
  return requestVoid(`${API_BASE}/v1/checkout/${params.requestId}/mark-fee-paid`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({}),
  });
}

export async function checkoutComplete(params: {
  sessionToken: string | null;
  requestId: string;
}): Promise<void> {
  return requestVoid(`${API_BASE}/v1/checkout/${params.requestId}/complete`, {
    method: 'POST',
    headers: authHeaders(params.sessionToken),
  });
}

export type WaitlistEntry = {
  id: string;
  visitId: string;
  checkinBlockId: string;
  desiredTier: string;
  backupTier: string;
  status: string;
  createdAt: string;
  checkinAt?: string;
  checkoutAt?: string;
  offeredAt?: string;
  roomId?: string | null;
  offeredRoomNumber?: string | null;
  displayIdentifier: string;
  currentRentalType: string;
  customerName?: string;
};

export async function waitlistList(params: {
  sessionToken: string | null;
  status: 'ACTIVE' | 'OFFERED';
}): Promise<{ entries: WaitlistEntry[] }> {
  return requestJson<{ entries?: WaitlistEntry[] }>(`${API_BASE}/v1/waitlist?status=${params.status}`, {
    headers: authHeaders(params.sessionToken),
  }).then((r) => ({ entries: Array.isArray(r.entries) ? r.entries : [] }));
}

export type InventoryAvailable = {
  rooms: Record<string, number>;
  rawRooms: Record<string, number>;
  waitlistDemand: Record<string, number>;
  lockers: number;
  total?: number;
};

export async function inventoryAvailable(_params: { sessionToken: string | null }): Promise<InventoryAvailable> {
  // Public endpoint (no auth required).
  return requestJson<InventoryAvailable>(`${API_BASE}/v1/inventory/available`, { method: 'GET' });
}

export type SessionDocument = {
  id: string;
  doc_type: string;
  mime_type: string;
  created_at: string;
  has_signature: boolean;
  signature_hash_prefix?: string;
  has_pdf?: boolean;
};

export async function documentsBySession(params: {
  sessionToken: string | null;
  laneSessionId: string;
}): Promise<{ documents: SessionDocument[] }> {
  return requestJson<{ documents?: SessionDocument[] }>(
    `${API_BASE}/v1/documents/by-session/${params.laneSessionId}`,
    { headers: authHeaders(params.sessionToken) }
  ).then((r) => ({ documents: Array.isArray(r.documents) ? r.documents : [] }));
}

export async function documentDownloadPdf(params: {
  sessionToken: string | null;
  documentId: string;
}): Promise<Blob> {
  return requestBlob(`${API_BASE}/v1/documents/${params.documentId}/download`, {
    headers: authHeaders(params.sessionToken),
  });
}

export type UpgradeFulfillResponse = {
  paymentIntentId?: string;
  upgradeFee?: number;
  originalCharges?: Array<{ description: string; amount: number }>;
  originalTotal?: number | null;
  newRoomNumber?: string | null;
};

export async function upgradesFulfill(params: {
  sessionToken: string | null;
  waitlistId: string;
  roomId: string;
  acknowledgedDisclaimer: boolean;
}): Promise<UpgradeFulfillResponse> {
  return requestJson<UpgradeFulfillResponse>(`${API_BASE}/v1/upgrades/fulfill`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({
      waitlistId: params.waitlistId,
      roomId: params.roomId,
      acknowledgedDisclaimer: params.acknowledgedDisclaimer,
    }),
  });
}

export async function paymentsMarkPaid(params: {
  sessionToken: string | null;
  paymentIntentId: string;
  squareTransactionId?: string;
}): Promise<void> {
  return requestVoid(`${API_BASE}/v1/payments/${params.paymentIntentId}/mark-paid`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({ squareTransactionId: params.squareTransactionId }),
  });
}

export async function upgradesComplete(params: {
  sessionToken: string | null;
  waitlistId: string;
  paymentIntentId: string;
}): Promise<void> {
  return requestVoid(`${API_BASE}/v1/upgrades/complete`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({ waitlistId: params.waitlistId, paymentIntentId: params.paymentIntentId }),
  });
}

export async function proposeSelection(params: {
  sessionToken: string | null;
  lane: string;
  rentalType: string;
  proposedBy: 'EMPLOYEE' | 'CUSTOMER';
}): Promise<void> {
  return requestVoid(`${API_BASE}/v1/checkin/lane/${params.lane}/propose-selection`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({ rentalType: params.rentalType, proposedBy: params.proposedBy }),
  });
}

export async function confirmSelection(params: {
  sessionToken: string | null;
  lane: string;
  confirmedBy: 'EMPLOYEE' | 'CUSTOMER';
}): Promise<void> {
  return requestVoid(`${API_BASE}/v1/checkin/lane/${params.lane}/confirm-selection`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({ confirmedBy: params.confirmedBy }),
  });
}

export async function assignResource(params: {
  sessionToken: string | null;
  lane: string;
  resourceType: 'room' | 'locker';
  resourceId: string;
}): Promise<{ needsConfirmation?: boolean }> {
  return requestJson<{ needsConfirmation?: boolean }>(`${API_BASE}/v1/checkin/lane/${params.lane}/assign`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({ resourceType: params.resourceType, resourceId: params.resourceId }),
  });
}

export type CreatePaymentIntentResponse = {
  paymentIntentId?: string;
  quote?: { total: number; lineItems: Array<{ description: string; amount: number }>; messages: string[] };
};

export async function createPaymentIntent(params: {
  sessionToken: string | null;
  lane: string;
}): Promise<CreatePaymentIntentResponse> {
  return requestJson<CreatePaymentIntentResponse>(`${API_BASE}/v1/checkin/lane/${params.lane}/create-payment-intent`, {
    method: 'POST',
    headers: authHeaders(params.sessionToken),
  });
}

export async function completeMembershipPurchase(params: {
  sessionToken: string | null;
  lane: string;
  sessionId: string;
  membershipNumber: string;
}): Promise<void> {
  return requestVoid(`${API_BASE}/v1/checkin/lane/${params.lane}/complete-membership-purchase`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({ sessionId: params.sessionId, membershipNumber: params.membershipNumber }),
  });
}

export async function manualSignatureOverride(params: {
  sessionToken: string | null;
  lane: string;
  sessionId: string;
}): Promise<void> {
  return requestVoid(`${API_BASE}/v1/checkin/lane/${params.lane}/manual-signature-override`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({ sessionId: params.sessionId }),
  });
}

export async function pastDueDemoPayment(params: {
  sessionToken: string | null;
  lane: string;
  outcome: 'CASH_SUCCESS' | 'CREDIT_SUCCESS' | 'CREDIT_DECLINE';
  declineReason?: string;
}): Promise<void> {
  return requestVoid(`${API_BASE}/v1/checkin/lane/${params.lane}/past-due/demo-payment`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({ outcome: params.outcome, declineReason: params.declineReason }),
  });
}

export async function pastDueBypass(params: {
  sessionToken: string | null;
  lane: string;
  managerId: string;
  managerPin: string;
}): Promise<void> {
  return requestVoid(`${API_BASE}/v1/checkin/lane/${params.lane}/past-due/bypass`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({ managerId: params.managerId, managerPin: params.managerPin }),
  });
}

export async function addNote(params: {
  sessionToken: string | null;
  lane: string;
  note: string;
}): Promise<void> {
  return requestVoid(`${API_BASE}/v1/checkin/lane/${params.lane}/add-note`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({ note: params.note }),
  });
}

export async function demoTakePayment(params: {
  sessionToken: string | null;
  lane: string;
  outcome: 'CASH_SUCCESS' | 'CREDIT_SUCCESS' | 'CREDIT_DECLINE';
  declineReason?: string;
  registerNumber?: number;
}): Promise<void> {
  return requestVoid(`${API_BASE}/v1/checkin/lane/${params.lane}/demo-take-payment`, {
    method: 'POST',
    headers: jsonHeaders(params.sessionToken),
    body: JSON.stringify({
      outcome: params.outcome,
      declineReason: params.declineReason,
      registerNumber: params.registerNumber,
    }),
  });
}

export type HealthStatus = { status: string; timestamp: string; uptime: number };

export async function getHealth(_params: { sessionToken: string | null }): Promise<HealthStatus | null> {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await readJsonSafe<unknown>(res);
    if (!data || typeof data !== 'object') return null;
    const rec = data as Record<string, unknown>;
    if (typeof rec.status === 'string' && typeof rec.timestamp === 'string' && typeof rec.uptime === 'number') {
      return { status: rec.status, timestamp: rec.timestamp, uptime: rec.uptime };
    }
    return null;
  } catch {
    return null;
  }
}

export async function employeesAvailable(params: {
  sessionToken: string | null;
}): Promise<{ employees: Array<{ id: string; name: string; role: string }> }> {
  return requestJson<{ employees?: Array<{ id: string; name: string; role: string }> }>(
    `${API_BASE}/v1/employees/available`,
    { headers: authHeaders(params.sessionToken) }
  ).then((r) => ({ employees: Array.isArray(r.employees) ? r.employees : [] }));
}

