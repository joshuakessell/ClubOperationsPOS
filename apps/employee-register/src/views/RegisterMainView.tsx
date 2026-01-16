import type { FormEvent } from 'react';
import { AssignmentBar, type PaymentQuote, type SelectedInventoryItem } from '../components/register/AssignmentBar';
import { CustomerInfoPanel } from '../components/register/CustomerInfoPanel';
import { LaneSessionPanel } from '../components/register/LaneSessionPanel';
import { InventorySummaryBar, type InventoryAvailableCounts, type InventorySummarySection } from '../components/inventory/InventorySummaryBar';
import { Button } from '../ui/Button';

export function RegisterMainView(props: {
  currentSessionId: string | null;
  customerName: string | null;
  customerPrimaryLanguage: string | null;
  customerDobMonthDay: string | null;
  customerLastVisitAt: string | null;
  pastDueBalance: number;
  customerNotes: string | null;
  onAddNote(): void;

  waitlistDesiredTier: string | null;
  waitlistBackupType: string | null;

  proposedRentalType: string | null;
  proposedBy: 'CUSTOMER' | 'EMPLOYEE' | null;
  selectionConfirmed: boolean;
  selectionConfirmedBy: 'CUSTOMER' | 'EMPLOYEE' | null;
  onConfirmSelection(): void;

  pastDueBlocked: boolean;
  isSubmitting: boolean;
  onProposeSelection(rentalType: string): void;

  inventoryAvailable: InventoryAvailableCounts;
  onOpenInventorySection(section: InventorySummarySection): void;

  selectedInventoryItem: SelectedInventoryItem | null;
  customerSelectedType: string | null;
  showCustomerConfirmationPending: boolean;
  agreementSigned: boolean;
  paymentStatus: 'DUE' | 'PAID' | null;
  paymentQuote: PaymentQuote | null;
  onAssign(): void;
  onManualSignatureOverride(): void;
  onClearSelection(): void;
  onMarkPaid(): void;

  customerSearch: string;
  setCustomerSearch(next: string): void;
  customerSearchLoading: boolean;
  customerSuggestions: Array<{
    id: string;
    firstName: string;
    lastName: string;
    dobMonthDay?: string | null;
    membershipNumber?: string | null;
  }>;
  selectedCustomerId: string | null;
  selectedCustomerLabel: string | null;
  setSelectedCustomerId(next: string | null): void;
  setSelectedCustomerLabel(next: string | null): void;
  onConfirmCustomerSelection(): void;

  manualEntry: boolean;
  setManualEntry(next: boolean): void;
  manualFirstName: string;
  setManualFirstName(next: string): void;
  manualLastName: string;
  setManualLastName(next: string): void;
  manualDobDigits: string;
  setManualDobDigits(next: string): void;
  onManualSubmit(e: FormEvent): void;
  manualEntrySubmitting: boolean;
  onClearSession(): void;

  membershipNumber: string | null;
}) {
  const {
    currentSessionId,
    customerName,
    customerPrimaryLanguage,
    customerDobMonthDay,
    customerLastVisitAt,
    pastDueBalance,
    customerNotes,
    onAddNote,
    waitlistDesiredTier,
    waitlistBackupType,
    proposedRentalType,
    proposedBy,
    selectionConfirmed,
    selectionConfirmedBy,
    onConfirmSelection,
    pastDueBlocked,
    isSubmitting,
    onProposeSelection,
    inventoryAvailable,
    onOpenInventorySection,
    selectedInventoryItem,
    customerSelectedType,
    showCustomerConfirmationPending,
    agreementSigned,
    paymentStatus,
    paymentQuote,
    onAssign,
    onManualSignatureOverride,
    onClearSelection,
    onMarkPaid,
    customerSearch,
    setCustomerSearch,
    customerSearchLoading,
    customerSuggestions,
    selectedCustomerId,
    selectedCustomerLabel,
    setSelectedCustomerId,
    setSelectedCustomerLabel,
    onConfirmCustomerSelection,
    manualEntry,
    setManualEntry,
    manualFirstName,
    setManualFirstName,
    manualLastName,
    setManualLastName,
    manualDobDigits,
    setManualDobDigits,
    onManualSubmit,
    manualEntrySubmitting,
    onClearSession,
    membershipNumber,
  } = props;

  return (
    <main className="main">
      {/* Customer Info Panel */}
      {currentSessionId && customerName && (
        <CustomerInfoPanel
          customerName={customerName}
          customerPrimaryLanguage={customerPrimaryLanguage}
          customerDobMonthDay={customerDobMonthDay}
          customerLastVisitAt={customerLastVisitAt}
          pastDueBalance={pastDueBalance}
          customerNotes={customerNotes}
          onAddNote={onAddNote}
        />
      )}

      {/* Waitlist Banner */}
      {waitlistDesiredTier && waitlistBackupType && (
        <div
          style={{
            padding: '1rem',
            background: '#fef3c7',
            border: '2px solid #f59e0b',
            borderRadius: '8px',
            marginBottom: '1rem',
            color: '#92400e',
          }}
        >
          <div className="er-text-md" style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
            ⚠️ Customer Waitlisted
          </div>
          <div className="er-text-sm">
            Customer requested <strong>{waitlistDesiredTier}</strong> but it's unavailable. Assigning{' '}
            <strong>{waitlistBackupType}</strong> as backup. If {waitlistDesiredTier} becomes available, customer can upgrade.
          </div>
        </div>
      )}

      {/* Selection State Display */}
      {currentSessionId && customerName && (proposedRentalType || selectionConfirmed) && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            background: selectionConfirmed ? '#10b981' : '#3b82f6',
            borderRadius: '8px',
            color: 'white',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
            {selectionConfirmed
              ? `✓ Selection Locked: ${proposedRentalType} (by ${selectionConfirmedBy === 'CUSTOMER' ? 'Customer' : 'You'})`
              : `Proposed: ${proposedRentalType} (by ${proposedBy === 'CUSTOMER' ? 'Customer' : 'You'})`}
          </div>
          {!selectionConfirmed && proposedBy === 'EMPLOYEE' && (
            <Button onClick={onConfirmSelection} disabled={isSubmitting} className="mt-2">
              {isSubmitting ? 'Confirming...' : 'Confirm Selection'}
            </Button>
          )}
          {!selectionConfirmed && proposedBy === 'CUSTOMER' && (
            <Button onClick={onConfirmSelection} disabled={isSubmitting} className="mt-2">
              {isSubmitting ? 'Confirming...' : 'Confirm Customer Selection'}
            </Button>
          )}
        </div>
      )}

      {/* Quick Selection Buttons */}
      {currentSessionId && customerName && !selectionConfirmed && !pastDueBlocked && (
        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '1rem',
            flexWrap: 'wrap',
          }}
        >
          {['LOCKER', 'STANDARD', 'DOUBLE', 'SPECIAL'].map((rental) => (
            <Button
              key={rental}
              onClick={() => onProposeSelection(rental)}
              disabled={isSubmitting}
              variant={proposedRentalType === rental ? 'primary' : 'secondary'}
              className="px-4"
            >
              Propose {rental}
            </Button>
          ))}
        </div>
      )}

      {/* Inventory Selector */}
      {currentSessionId && customerName && !pastDueBlocked && (
        <InventorySummaryBar counts={inventoryAvailable} onOpenInventorySection={onOpenInventorySection} />
      )}

      {/* Assignment Bar */}
      {selectedInventoryItem && (
        <AssignmentBar
          selectedInventoryItem={selectedInventoryItem}
          customerSelectedType={customerSelectedType}
          showCustomerConfirmationPending={showCustomerConfirmationPending}
          agreementSigned={agreementSigned}
          paymentStatus={paymentStatus}
          paymentQuote={paymentQuote}
          isSubmitting={isSubmitting}
          onAssign={onAssign}
          onManualSignatureOverride={onManualSignatureOverride}
          onClearSelection={onClearSelection}
          onMarkPaid={onMarkPaid}
        />
      )}

      <LaneSessionPanel
        customerSearch={customerSearch}
        setCustomerSearch={setCustomerSearch}
        customerSearchLoading={customerSearchLoading}
        customerSuggestions={customerSuggestions}
        selectedCustomerId={selectedCustomerId}
        selectedCustomerLabel={selectedCustomerLabel}
        setSelectedCustomerId={setSelectedCustomerId}
        setSelectedCustomerLabel={setSelectedCustomerLabel}
        onConfirmCustomerSelection={onConfirmCustomerSelection}
        manualEntry={manualEntry}
        setManualEntry={setManualEntry}
        manualFirstName={manualFirstName}
        setManualFirstName={setManualFirstName}
        manualLastName={manualLastName}
        setManualLastName={setManualLastName}
        manualDobDigits={manualDobDigits}
        setManualDobDigits={setManualDobDigits}
        onManualSubmit={onManualSubmit}
        manualEntrySubmitting={manualEntrySubmitting}
        onClearSession={onClearSession}
        isSubmitting={isSubmitting}
        customerName={customerName}
        membershipNumber={membershipNumber}
        currentSessionId={currentSessionId}
        agreementSigned={agreementSigned}
      />
    </main>
  );
}

