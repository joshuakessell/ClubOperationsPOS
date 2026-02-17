import { describe, it, expect } from 'vitest';
import { deriveCheckinStage } from './checkinStage';

function makeInput(overrides: Partial<Parameters<typeof deriveCheckinStage>[0]> = {}) {
  return {
    currentSessionId: 'sess-1',
    customerName: 'Jane Doe',
    assignedResourceType: null as 'room' | 'locker' | null,
    assignedResourceNumber: null as string | null,
    agreementSigned: false,
    selectionConfirmed: false,
    customerPrimaryLanguage: undefined as 'EN' | 'ES' | undefined,
    membershipNumber: null as string | null,
    customerMembershipValidUntil: null as string | null,
    membershipPurchaseIntent: null as 'PURCHASE' | 'RENEW' | null,
    membershipChoice: null as 'ONE_TIME' | 'SIX_MONTH' | null,
    flowStep: null as any,
    ...overrides,
  };
}

describe('deriveCheckinStage', () => {
  it('returns null when no session', () => {
    expect(deriveCheckinStage(makeInput({ currentSessionId: null }))).toBeNull();
  });

  it('returns null when no customer name', () => {
    expect(deriveCheckinStage(makeInput({ customerName: '' }))).toBeNull();
  });

  it('returns stage 5 when resource is assigned', () => {
    const result = deriveCheckinStage(
      makeInput({ assignedResourceType: 'room', assignedResourceNumber: '101' })
    );
    expect(result).toEqual({ number: 5, label: 'Locker/Room Assigned' });
  });

  it('returns stage 3 for RENTAL flowStep', () => {
    const result = deriveCheckinStage(makeInput({ flowStep: 'RENTAL' }));
    expect(result).toEqual({ number: 3, label: 'Rental Options' });
  });

  it('returns stage 3 for WAITLIST_PREFERENCES flowStep', () => {
    const result = deriveCheckinStage(makeInput({ flowStep: 'WAITLIST_PREFERENCES' }));
    expect(result).toEqual({ number: 3, label: 'Rental Options' });
  });

  it('returns stage 3 for WAITLIST_BACKUP flowStep', () => {
    const result = deriveCheckinStage(makeInput({ flowStep: 'WAITLIST_BACKUP' }));
    expect(result).toEqual({ number: 3, label: 'Rental Options' });
  });

  it('returns stage 4 (Payment) for PAYMENT flowStep', () => {
    const result = deriveCheckinStage(makeInput({ flowStep: 'PAYMENT' }));
    expect(result).toEqual({ number: 4, label: 'Payment' });
  });

  it('returns stage 4 (Signing) for AGREEMENT flowStep', () => {
    const result = deriveCheckinStage(makeInput({ flowStep: 'AGREEMENT' }));
    expect(result).toEqual({ number: 4, label: 'Signing Member Agreement' });
  });

  it('returns stage 5 for COMPLETE flowStep', () => {
    const result = deriveCheckinStage(makeInput({ flowStep: 'COMPLETE' }));
    expect(result).toEqual({ number: 5, label: 'Locker/Room Assigned' });
  });

  it('returns stage 5 when agreement is signed (no flowStep)', () => {
    const result = deriveCheckinStage(makeInput({ agreementSigned: true }));
    expect(result).toEqual({ number: 5, label: 'Locker/Room Assigned' });
  });

  it('returns stage 4 when selection is confirmed (no flowStep)', () => {
    const result = deriveCheckinStage(makeInput({ selectionConfirmed: true }));
    expect(result).toEqual({ number: 4, label: 'Signing Member Agreement' });
  });

  it('returns stage 2 when no membership and no membership choice', () => {
    const result = deriveCheckinStage(makeInput());
    expect(result).toEqual({ number: 2, label: 'Membership Options' });
  });

  it('returns stage 3 when membership intent is set (RENEW)', () => {
    const result = deriveCheckinStage(
      makeInput({
        membershipPurchaseIntent: 'RENEW',
      })
    );
    expect(result).toEqual({ number: 3, label: 'Rental Options' });
  });

  it('returns stage 3 when membershipChoice is set', () => {
    const result = deriveCheckinStage(makeInput({ membershipChoice: 'ONE_TIME' }));
    expect(result).toEqual({ number: 3, label: 'Rental Options' });
  });

  it('returns stage 3 when membershipPurchaseIntent is set', () => {
    const result = deriveCheckinStage(makeInput({ membershipPurchaseIntent: 'PURCHASE' }));
    expect(result).toEqual({ number: 3, label: 'Rental Options' });
  });
});
