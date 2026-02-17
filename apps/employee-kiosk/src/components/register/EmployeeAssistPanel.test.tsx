import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmployeeAssistPanel } from './EmployeeAssistPanel';

function baseProps() {
  return {
    sessionId: 'session-1',
    customerName: 'Test Customer',
    customerPrimaryLanguage: 'EN' as const,
    membershipNumber: null,
    customerMembershipValidUntil: null,
    membershipPurchaseIntent: null,
    membershipChoice: null,
    allowedRentals: ['LOCKER', 'STANDARD', 'DOUBLE', 'SPECIAL'],
    proposedRentalType: null,
    proposedBy: null,
    selectionConfirmed: false,
    waitlistDesiredTier: null,
    waitlistBackupType: null,
    inventoryAvailable: { rooms: { STANDARD: 10, DOUBLE: 8, SPECIAL: 2 }, lockers: 12 },
    isSubmitting: false,
    onHighlightMembership: vi.fn(),
    onConfirmMembershipOneTime: vi.fn(),
    onConfirmMembershipSixMonth: vi.fn(),
    onHighlightRental: vi.fn(),
    onSelectRentalAsCustomer: vi.fn(),
    onHighlightWaitlistBackup: vi.fn(),
    onSelectWaitlistBackupAsCustomer: vi.fn(),
    onApproveRental: vi.fn(),
  };
}

describe('EmployeeAssistPanel', () => {
  it('Skips MEMBERSHIP when customer is already a member (ACTIVE)', () => {
    const props = {
      ...baseProps(),
      customerPrimaryLanguage: 'EN' as const,
      membershipNumber: '12345',
      customerMembershipValidUntil: '2999-01-01',
      membershipChoice: null,
    };
    render(<EmployeeAssistPanel {...props} />);
    expect(screen.queryByRole('button', { name: 'Add 6-Month Membership' })).toBeNull();
    expect(screen.getByText('Step: RENTAL')).toBeTruthy();
  });

  it('RENTAL step: first tap highlights, second tap confirms 6-month add-on', () => {
    const props = {
      ...baseProps(),
      customerPrimaryLanguage: 'EN' as const,
    };
    render(<EmployeeAssistPanel {...props} />);

    const addMembership = screen.getByRole('button', { name: 'Add 6-Month Membership' });
    fireEvent.click(addMembership);
    expect(props.onHighlightMembership).toHaveBeenCalledWith('SIX_MONTH');
    expect(props.onConfirmMembershipSixMonth).not.toHaveBeenCalled();

    fireEvent.click(addMembership);
    expect(props.onHighlightMembership).toHaveBeenCalledWith(null);
    expect(props.onConfirmMembershipSixMonth).toHaveBeenCalled();
  });

  it('RENTAL step: buttons are in required order and show exact counts', () => {
    const props = {
      ...baseProps(),
      customerPrimaryLanguage: 'EN' as const,
      membershipChoice: 'ONE_TIME' as const,
    };
    render(<EmployeeAssistPanel {...props} />);

    const buttons = screen.getAllByRole('button');
    const rentalButtons = buttons.filter((b) =>
      /Propose (Locker|Private|Double|Special)/.test(b.textContent || '')
    );

    expect(rentalButtons.map((b) => b.textContent)).toEqual([
      expect.stringContaining('Propose Locker'),
      expect.stringContaining('Propose Private'),
      expect.stringContaining('Propose Double'),
      expect.stringContaining('Propose Special'),
    ]);

    expect(screen.getByText(/\b12 remaining\b/)).toBeTruthy();
    expect(screen.getByText(/\b10 remaining\b/)).toBeTruthy();
    expect(screen.getByText(/\b8 remaining\b/)).toBeTruthy();
    expect(screen.getByText(/\b2 remaining\b/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Join the Waiting List' })).toBeNull();
  });

  it('RENTAL step: disables unavailable rentals and shows Join the Waiting List', () => {
    const props = {
      ...baseProps(),
      customerPrimaryLanguage: 'EN' as const,
      membershipChoice: 'ONE_TIME' as const,
      inventoryAvailable: { rooms: { STANDARD: 0, DOUBLE: 8, SPECIAL: 2 }, lockers: 12 },
    };
    render(<EmployeeAssistPanel {...props} />);

    // When STANDARD count is 0, the button is not rendered at all (filtered out).
    expect(screen.queryByRole('button', { name: /Propose Private/i })).toBeNull();

    const joinWaitlist = screen.getByRole('button', { name: 'Join the Waiting List' });
    fireEvent.click(joinWaitlist);
    expect(props.onHighlightRental).toHaveBeenCalledWith('STANDARD');
    expect(props.onApproveRental).not.toHaveBeenCalled();

    // Second click on waitlist calls onSelectRentalAsCustomer (not onApproveRental)
    fireEvent.click(joinWaitlist);
    expect(props.onSelectRentalAsCustomer).toHaveBeenCalledWith('STANDARD');
  });

  it('RENTAL step: first tap proposes, second tap confirms', () => {
    const props = {
      ...baseProps(),
      customerPrimaryLanguage: 'EN' as const,
      membershipChoice: 'ONE_TIME' as const,
    };
    render(<EmployeeAssistPanel {...props} />);

    const locker = screen.getByRole('button', { name: /Propose Locker/i });
    fireEvent.click(locker);
    expect(props.onHighlightRental).toHaveBeenCalledWith('LOCKER');
    expect(props.onApproveRental).not.toHaveBeenCalled();

    fireEvent.click(locker);
    expect(props.onApproveRental).toHaveBeenCalled();
  });

  it('skips approval when customer already selected a rental', () => {
    const props = {
      ...baseProps(),
      customerPrimaryLanguage: 'EN' as const,
      membershipChoice: 'ONE_TIME' as const,
      proposedBy: 'CUSTOMER' as const,
      proposedRentalType: 'LOCKER',
      selectionConfirmed: false,
    };
    render(<EmployeeAssistPanel {...props} />);

    expect(screen.getByText('Step: DONE')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'OK' })).toBeNull();
  });
});
