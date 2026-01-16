import type { FormEvent } from 'react';
import { extractDobDigits, formatDobMmDdYyyy, parseDobDigitsToIso } from '../../utils/dob';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';

type CustomerSuggestion = {
  id: string;
  firstName: string;
  lastName: string;
  dobMonthDay?: string | null;
  membershipNumber?: string | null;
};

export function LaneSessionPanel(props: {
  customerSearch: string;
  setCustomerSearch(next: string): void;
  customerSearchLoading: boolean;
  customerSuggestions: CustomerSuggestion[];
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

  isSubmitting: boolean;

  customerName: string | null;
  membershipNumber: string | null;
  currentSessionId: string | null;
  agreementSigned: boolean;
}) {
  const {
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
    isSubmitting,
    customerName,
    membershipNumber,
    currentSessionId,
    agreementSigned,
  } = props;

  return (
    <section className="actions-panel">
      <h2>Lane Session</h2>

      {/* Customer lookup (typeahead) */}
      <div className="er-search-section-half">
        <Card padding="md" className="typeahead-section mt-0 mb-4 bg-slate-900/70 text-white ring-slate-700">
          <div
            style={{
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              marginBottom: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            <label htmlFor="customer-search" style={{ fontWeight: 600 }}>
              Search Customer
            </label>
            <span className="er-search-help">(type at least 3 letters)</span>
          </div>
          <Input
            id="customer-search"
            type="text"
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder="Start typing name..."
            disabled={isSubmitting}
          />
          {customerSearchLoading && (
            <div className="er-text-sm" style={{ marginTop: '0.25rem', color: '#94a3b8' }}>
              Searching...
            </div>
          )}
          {customerSuggestions.length > 0 && (
            <Card
              padding="none"
              className="mt-2 max-h-[180px] overflow-y-auto bg-slate-900/70 text-white ring-slate-700"
            >
              {customerSuggestions.map((s) => {
                const label = `${s.lastName}, ${s.firstName}`;
                const active = selectedCustomerId === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedCustomerId(s.id);
                      setSelectedCustomerLabel(label);
                    }}
                    style={{
                      padding: '0.5rem 0.75rem',
                      cursor: 'pointer',
                      background: active ? '#1e293b' : 'transparent',
                      borderBottom: '1px solid #1f2937',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{label}</div>
                    <div
                      className="er-text-sm"
                      style={{
                        color: '#94a3b8',
                        display: 'flex',
                        gap: '0.75rem',
                        flexWrap: 'wrap',
                      }}
                    >
                      {s.dobMonthDay && <span>DOB: {s.dobMonthDay}</span>}
                      {s.membershipNumber && <span>Membership: {s.membershipNumber}</span>}
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              gap: '0.75rem',
              marginTop: '0.75rem',
              alignItems: 'center',
              flexDirection: 'column',
            }}
          >
            <div className="er-search-help">
              {selectedCustomerLabel ? `Selected: ${selectedCustomerLabel}` : 'Select a customer above'}
            </div>
            <Button onClick={onConfirmCustomerSelection} disabled={!selectedCustomerId || isSubmitting}>
              Confirm
            </Button>
          </div>
        </Card>
      </div>

      <div className="action-buttons">
        <Button
          className={`action-btn ${manualEntry ? 'active' : ''}`}
          variant={manualEntry ? 'primary' : 'secondary'}
          onClick={() => {
            const next = !manualEntry;
            setManualEntry(next);
            if (!next) {
              setManualFirstName('');
              setManualLastName('');
              setManualDobDigits('');
            }
          }}
        >
          <span className="btn-icon">✏️</span>
          <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.1 }}>
            <span>First Time Customer</span>
            <span className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 700 }}>
              Alternate ID
            </span>
          </span>
        </Button>
        <Button className="action-btn" variant="danger" onClick={onClearSession} disabled={isSubmitting}>
          <span className="btn-icon">🗑️</span>
          Clear Session
        </Button>
      </div>

      {manualEntry && (
        <form
          className="manual-entry-form rounded-xl bg-slate-900/70 p-4 text-white ring-1 ring-slate-700"
          onSubmit={onManualSubmit}
        >
          <div className="form-group">
            <label htmlFor="manualFirstName">First Name *</label>
            <Input
              id="manualFirstName"
              type="text"
              value={manualFirstName}
              onChange={(e) => setManualFirstName(e.target.value)}
              placeholder="Enter first name"
              disabled={isSubmitting}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="manualLastName">Last Name *</label>
            <Input
              id="manualLastName"
              type="text"
              value={manualLastName}
              onChange={(e) => setManualLastName(e.target.value)}
              placeholder="Enter last name"
              disabled={isSubmitting}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="manualDob">Date of Birth *</label>
            <Input
              id="manualDob"
              type="text"
              inputMode="numeric"
              value={formatDobMmDdYyyy(manualDobDigits)}
              onChange={(e) => setManualDobDigits(extractDobDigits(e.target.value))}
              placeholder="MM/DD/YYYY"
              disabled={isSubmitting}
              required
            />
          </div>
          <div className="form-actions">
            <Button
              type="submit"
              className="submit-btn"
              disabled={
                isSubmitting ||
                manualEntrySubmitting ||
                !manualFirstName.trim() ||
                !manualLastName.trim() ||
                !parseDobDigitsToIso(manualDobDigits)
              }
            >
              {isSubmitting || manualEntrySubmitting ? 'Submitting...' : 'Add Customer'}
            </Button>
            <Button
              type="button"
              variant="danger"
              className="cancel-btn"
              onClick={() => {
                setManualEntry(false);
                setManualFirstName('');
                setManualLastName('');
                setManualDobDigits('');
              }}
              disabled={isSubmitting || manualEntrySubmitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {(customerName || membershipNumber) && !manualEntry && (
        <div className="current-session">
          <p>
            <strong>Current Session:</strong>
          </p>
          <p>Name: {customerName || 'Not set'}</p>
          {membershipNumber && <p>Membership: {membershipNumber}</p>}
          {currentSessionId && (
            <p className={agreementSigned ? 'agreement-status signed' : 'agreement-status unsigned'}>
              {agreementSigned ? 'Agreement signed ✓' : 'Agreement pending'}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

