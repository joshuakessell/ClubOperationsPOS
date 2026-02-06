import { extractDobDigits, formatDobMmDdYyyy } from '../../utils/dob';
import { useEmployeeRegisterState } from '../../app/state/useEmployeeRegisterState';
import { PanelHeader } from '../../views/PanelHeader';
import { PanelShell } from '../../views/PanelShell';

export function ScanPanel() {
  const {
    currentSessionId,
    customerName,
    selectHomeTab,
    scanReady,
    scanBlockedReason,
    scanOverlayActive,
    scanInputRef,
    scanInputHandlers,
    scanInputEnabled,
    scanFormData,
    scanFormActiveField,
    scanFormSubmitting,
    scanFormError,
    scanFormCanSubmit,
    setScanFormEditing,
    updateScanFormField,
    submitScanForm,
    clearScanForm,
  } = useEmployeeRegisterState();

  const fieldClassName = (field: typeof scanFormActiveField, fullWidth?: boolean) => {
    const isActive = field ? scanFormActiveField === field : false;
    return [
      'form-group',
      'er-form-field',
      isActive ? 'er-form-field--active' : '',
      fullWidth ? 'er-form-field--full' : '',
    ]
      .filter(Boolean)
      .join(' ');
  };

  return (
    <PanelShell
      as="form"
      align="top"
      className="er-scan-panel"
      onSubmit={(event) => {
        event.preventDefault();
        if (!scanFormCanSubmit || scanFormSubmitting) return;
        void submitScanForm();
      }}
    >
      <div className="er-scan-header">
        <div className="er-scan-icon" aria-hidden="true">
          📷
        </div>
        <PanelHeader
          align="center"
          spacing="sm"
          title="Scan Now"
          subtitle="Scan a membership ID or Driver Licence."
        />
      </div>

      <textarea
        ref={scanInputRef}
        className={['er-scan-input', scanOverlayActive ? 'er-scan-input--visible' : '']
          .filter(Boolean)
          .join(' ')}
        aria-label="Scan input"
        tabIndex={-1}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="none"
        disabled={!scanInputEnabled}
        {...scanInputHandlers}
      />

      <div className="er-scan-status">
        {scanReady ? 'Scanner ready' : `Scanner paused: ${scanBlockedReason || 'Unavailable'}`}
      </div>

      <div
        className="er-scan-form"
        onPointerDownCapture={() => setScanFormEditing(true)}
        onFocusCapture={() => setScanFormEditing(true)}
        onBlurCapture={(event) => {
          const next = event.relatedTarget as Node | null;
          if (next && event.currentTarget.contains(next)) return;
          setScanFormEditing(false);
        }}
      >
        <div className="er-form-grid">
          <div className={fieldClassName('firstName')}>
            <label htmlFor="scanFirstName">First Name *</label>
            <input
              id="scanFirstName"
              type="text"
              className="cs-liquid-input"
              value={scanFormData.firstName}
              onChange={(e) => updateScanFormField('firstName', e.target.value)}
              placeholder="Enter first name"
              disabled={scanFormSubmitting}
              required
            />
          </div>
          <div className={fieldClassName('lastName')}>
            <label htmlFor="scanLastName">Last Name *</label>
            <input
              id="scanLastName"
              type="text"
              className="cs-liquid-input"
              value={scanFormData.lastName}
              onChange={(e) => updateScanFormField('lastName', e.target.value)}
              placeholder="Enter last name"
              disabled={scanFormSubmitting}
              required
            />
          </div>
          <div className={fieldClassName('dob')}>
            <label htmlFor="scanDob">Date of Birth *</label>
            <input
              id="scanDob"
              type="text"
              inputMode="numeric"
              className="cs-liquid-input"
              value={formatDobMmDdYyyy(scanFormData.dobDigits)}
              onChange={(e) => updateScanFormField('dobDigits', extractDobDigits(e.target.value))}
              placeholder="MM/DD/YYYY"
              disabled={scanFormSubmitting}
              required
            />
          </div>
          <div className="form-group er-form-field">
            <label htmlFor="scanIdType">ID Type *</label>
            <select
              id="scanIdType"
              className="cs-liquid-input"
              value={scanFormData.idType}
              onChange={(e) => {
                const next = e.target.value as typeof scanFormData.idType;
                updateScanFormField('idType', next);
              }}
              disabled={scanFormSubmitting}
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
          {scanFormData.idType === 'OTHER' ? (
            <div className={fieldClassName(null, true)}>
              <label htmlFor="scanIdTypeOther">Specify ID Type *</label>
              <input
                id="scanIdTypeOther"
                type="text"
                className="cs-liquid-input"
                value={scanFormData.idTypeOther}
                onChange={(e) => updateScanFormField('idTypeOther', e.target.value)}
                placeholder="Enter ID type"
                disabled={scanFormSubmitting}
                required
              />
            </div>
          ) : null}
          <div className={fieldClassName('idNumber')}>
            <label htmlFor="scanIdNumber">License / ID Number</label>
            <input
              id="scanIdNumber"
              type="text"
              className="cs-liquid-input"
              value={scanFormData.idNumber}
              onChange={(e) => updateScanFormField('idNumber', e.target.value)}
              placeholder="Enter license or ID number"
              disabled={scanFormSubmitting}
            />
          </div>
          <div className={fieldClassName('idExpirationDate')}>
            <label htmlFor="scanIdExpiration">ID Expiration Date *</label>
            <input
              id="scanIdExpiration"
              type="text"
              inputMode="numeric"
              className="cs-liquid-input"
              value={formatDobMmDdYyyy(scanFormData.idExpirationDigits)}
              onChange={(e) =>
                updateScanFormField('idExpirationDigits', extractDobDigits(e.target.value))
              }
              placeholder="MM/DD/YYYY"
              disabled={scanFormSubmitting}
              required
            />
          </div>
        </div>

        {scanFormError ? <div className="er-form-error">{scanFormError}</div> : null}

        <div className="form-actions er-scan-actions">
          <button
            type="submit"
            className="submit-btn cs-liquid-button"
            disabled={scanFormSubmitting || !scanFormCanSubmit}
          >
            {scanFormSubmitting ? 'Searching...' : 'Search'}
          </button>
          <button
            type="button"
            className="cancel-btn cs-liquid-button cs-liquid-button--secondary"
            onClick={() => clearScanForm()}
            disabled={scanFormSubmitting}
          >
            Clear
          </button>
        </div>
      </div>

      {currentSessionId && customerName ? (
        <div style={{ marginTop: '1.5rem', display: 'grid', gap: '0.5rem' }}>
          <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
            Active lane session: <span style={{ color: '#e2e8f0' }}>{customerName}</span>
          </div>
          <button
            type="button"
            className="cs-liquid-button"
            onClick={() => selectHomeTab('account')}
            style={{ width: '100%', padding: '0.75rem', fontWeight: 900 }}
          >
            Open Customer Account
          </button>
        </div>
      ) : null}
    </PanelShell>
  );
}
