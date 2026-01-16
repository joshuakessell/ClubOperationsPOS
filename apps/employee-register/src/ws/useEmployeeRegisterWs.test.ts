import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { handleEmployeeRegisterWsMessage } from './useEmployeeRegisterWs';

function makeDeps() {
  return {
    lane: 'lane-1',
    dispatchRegister: vi.fn(),
    selectedCheckoutRequestRef: { current: null as string | null },
    currentSessionIdRef: { current: null as string | null },
    customerSelectedTypeRef: { current: null as string | null },
    setCheckoutRequests: vi.fn(),
    setSelectedCheckoutRequest: vi.fn(),
    setCheckoutChecklist: vi.fn(),
    setCheckoutItemsConfirmed: vi.fn(),
    setCheckoutFeePaid: vi.fn(),
    setSelectedInventoryItem: vi.fn(),
    fetchWaitlist: vi.fn(),
    fetchInventoryAvailable: vi.fn(),
  };
}

describe('handleEmployeeRegisterWsMessage', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ignores invalid JSON', () => {
    const deps = makeDeps();
    handleEmployeeRegisterWsMessage('{', deps);
    expect(deps.dispatchRegister).not.toHaveBeenCalled();
    expect(deps.setCheckoutRequests).not.toHaveBeenCalled();
    expect(deps.fetchInventoryAvailable).not.toHaveBeenCalled();
  });

  it('ignores unknown event types', () => {
    const deps = makeDeps();
    handleEmployeeRegisterWsMessage(JSON.stringify({ type: 'UNKNOWN_EVENT', payload: { a: 1 } }), deps);
    expect(deps.dispatchRegister).not.toHaveBeenCalled();
    expect(deps.setCheckoutRequests).not.toHaveBeenCalled();
    expect(deps.fetchInventoryAvailable).not.toHaveBeenCalled();
  });
});

