import { extractDobDigits, formatDobMmDdYyyy } from '../../utils/dob';
import { useEmployeeRegisterState } from '../../app/state/useEmployeeRegisterState';
import { PanelHeader } from '../../views/PanelHeader';
import { PanelShell } from '../../views/PanelShell';

export function ManualEntryPanel() {
  const {
    handleManualSubmit,
    manualFirstName,
    setManualFirstName,
    manualLastName,
    setManualLastName,
    manualDobDigits,
    setManualDobDigits,
    manualDobIso,
    manualIdExpirationDigits,
    setManualIdExpirationDigits,
    manualIdExpirationIso,
    manualIdType,
    setManualIdType,
    manualIdTypeOther,
    setManualIdTypeOther,
    manualIdNumber,
    setManualIdNumber,
    isSubmitting,
    manualEntrySubmitting,
    setManualEntry,
    selectHomeTab,
  } = useEmployeeRegisterState();

  return (
    <PanelShell
      as="form"
      align="top"
      className="manual-entry-form"
      onSubmit={(e) => void handleManualSubmit(e)}
    >
      <PanelHeader
        title="First Time Customer"
        subtitle="Enter customer details from alternate ID."
      />

      <div className="er-form-grid">
        <div className="form-group er-form-field">
          <label htmlFor="manualFirstName">First Name *</label>
          <input
            id="manualFirstName"
            type="text"
            className="cs-liquid-input"
            value={manualFirstName}
            onChange={(e) => setManualFirstName(e.target.value)}
            placeholder="Enter first name"
            disabled={isSubmitting}
            required
          />
        </div>
        <div className="form-group er-form-field">
          <label htmlFor="manualLastName">Last Name *</label>
          <input
            id="manualLastName"
            type="text"
            className="cs-liquid-input"
            value={manualLastName}
            onChange={(e) => setManualLastName(e.target.value)}
            placeholder="Enter last name"
            disabled={isSubmitting}
            required
          />
        </div>
        <div className="form-group er-form-field">
          <label htmlFor="manualDob">Date of Birth *</label>
          <input
            id="manualDob"
            type="text"
            inputMode="numeric"
            className="cs-liquid-input"
            value={formatDobMmDdYyyy(manualDobDigits)}
            onChange={(e) => setManualDobDigits(extractDobDigits(e.target.value))}
            placeholder="MM/DD/YYYY"
            disabled={isSubmitting}
            required
          />
        </div>
        <div className="form-group er-form-field">
          <label htmlFor="manualIdType">ID Type *</label>
          <select
            id="manualIdType"
            className="cs-liquid-input"
            value={manualIdType}
            onChange={(e) => {
              const next = e.target.value as typeof manualIdType;
              setManualIdType(next);
              if (next !== 'OTHER') {
                setManualIdTypeOther('');
              }
            }}
            disabled={isSubmitting}
            required
          >
            <option value="" disabled>
              Select ID type
            </option>
            <option value="STATE_ID">State ID</option>
            <option value="DRIVERS_LICENSE">Drivers License</option>
            <option value="PASSPORT">Passport</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        {manualIdType === 'OTHER' ? (
          <div className="form-group er-form-field er-form-field--full">
            <label htmlFor="manualIdTypeOther">Specify ID Type *</label>
            <input
              id="manualIdTypeOther"
              type="text"
              className="cs-liquid-input"
              value={manualIdTypeOther}
              onChange={(e) => setManualIdTypeOther(e.target.value)}
              placeholder="Enter ID type"
              disabled={isSubmitting}
              required
            />
          </div>
        ) : null}
        <div className="form-group er-form-field">
          <label htmlFor="manualIdNumber">License / ID Number</label>
          <input
            id="manualIdNumber"
            type="text"
            className="cs-liquid-input"
            value={manualIdNumber}
            onChange={(e) => setManualIdNumber(e.target.value)}
            placeholder="Enter license or ID number"
            disabled={isSubmitting}
          />
        </div>
        <div className="form-group er-form-field">
          <label htmlFor="manualIdExpiration">ID Expiration Date *</label>
          <input
            id="manualIdExpiration"
            type="text"
            inputMode="numeric"
            className="cs-liquid-input"
            value={formatDobMmDdYyyy(manualIdExpirationDigits)}
            onChange={(e) => setManualIdExpirationDigits(extractDobDigits(e.target.value))}
            placeholder="MM/DD/YYYY"
            disabled={isSubmitting}
            required
          />
        </div>
      </div>

      <div className="form-actions">
        <button
          type="submit"
          className="submit-btn cs-liquid-button"
          disabled={
            isSubmitting ||
            manualEntrySubmitting ||
            !manualFirstName.trim() ||
            !manualLastName.trim() ||
            !manualDobIso ||
            !manualIdExpirationIso ||
            !manualIdType ||
            (manualIdType === 'OTHER' && !manualIdTypeOther.trim())
          }
        >
          {isSubmitting || manualEntrySubmitting ? 'Submitting...' : 'Add Customer'}
        </button>
        <button
          type="button"
          className="cancel-btn cs-liquid-button cs-liquid-button--danger"
          onClick={() => {
            setManualEntry(false);
            setManualFirstName('');
            setManualLastName('');
            setManualDobDigits('');
            setManualIdExpirationDigits('');
            setManualIdType('');
            setManualIdTypeOther('');
            setManualIdNumber('');
            selectHomeTab('scan');
          }}
          disabled={isSubmitting || manualEntrySubmitting}
        >
          Cancel
        </button>
      </div>
    </PanelShell>
  );
}
