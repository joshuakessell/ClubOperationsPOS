import { Button } from '@club-ops/ui/tailadmin';
import { extractDobDigits, formatDobMmDdYyyy } from '../../utils/dob';
import { useEmployeeRegisterState } from '../../app/state/useEmployeeRegisterState';
import { PanelHeader } from '../../views/PanelHeader';
import { PanelShell } from '../../views/PanelShell';

/* Reusable TailAdmin-style input classes */
const inputClass =
  'h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-white/30';

const selectClass =
  'h-11 w-full appearance-none rounded-lg border border-gray-200 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white';

const labelClass = 'mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400';

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
    selectNavTab,
  } = useEmployeeRegisterState();

  const submitDisabled =
    isSubmitting ||
    manualEntrySubmitting ||
    !manualFirstName.trim() ||
    !manualLastName.trim() ||
    !manualDobIso ||
    !manualIdExpirationIso ||
    !manualIdType ||
    (manualIdType === 'OTHER' && !manualIdTypeOther.trim());

  return (
    <PanelShell as="form" align="top" onSubmit={(e: React.FormEvent) => void handleManualSubmit(e)}>
      <PanelHeader
        title="First Time Customer"
        subtitle="Enter customer details from alternate ID."
      />

      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
        {/* First Name */}
        <div>
          <label htmlFor="manualFirstName" className={labelClass}>
            First Name <span className="text-error-500">*</span>
          </label>
          <input
            id="manualFirstName"
            type="text"
            className={inputClass}
            value={manualFirstName}
            onChange={(e) => setManualFirstName(e.target.value)}
            placeholder="Enter first name"
            disabled={isSubmitting}
            required
          />
        </div>

        {/* Last Name */}
        <div>
          <label htmlFor="manualLastName" className={labelClass}>
            Last Name <span className="text-error-500">*</span>
          </label>
          <input
            id="manualLastName"
            type="text"
            className={inputClass}
            value={manualLastName}
            onChange={(e) => setManualLastName(e.target.value)}
            placeholder="Enter last name"
            disabled={isSubmitting}
            required
          />
        </div>

        {/* DOB */}
        <div>
          <label htmlFor="manualDob" className={labelClass}>
            Date of Birth <span className="text-error-500">*</span>
          </label>
          <input
            id="manualDob"
            type="text"
            inputMode="numeric"
            className={inputClass}
            value={formatDobMmDdYyyy(manualDobDigits)}
            onChange={(e) => setManualDobDigits(extractDobDigits(e.target.value))}
            placeholder="MM/DD/YYYY"
            disabled={isSubmitting}
            required
          />
        </div>

        {/* ID Type */}
        <div>
          <label htmlFor="manualIdType" className={labelClass}>
            ID Type <span className="text-error-500">*</span>
          </label>
          <select
            id="manualIdType"
            className={selectClass}
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

        {/* ID Type Other (conditional) */}
        {manualIdType === 'OTHER' ? (
          <div className="col-span-2">
            <label htmlFor="manualIdTypeOther" className={labelClass}>
              Specify ID Type <span className="text-error-500">*</span>
            </label>
            <input
              id="manualIdTypeOther"
              type="text"
              className={inputClass}
              value={manualIdTypeOther}
              onChange={(e) => setManualIdTypeOther(e.target.value)}
              placeholder="Enter ID type"
              disabled={isSubmitting}
              required
            />
          </div>
        ) : null}

        {/* ID Number */}
        <div>
          <label htmlFor="manualIdNumber" className={labelClass}>
            License / ID Number
          </label>
          <input
            id="manualIdNumber"
            type="text"
            className={inputClass}
            value={manualIdNumber}
            onChange={(e) => setManualIdNumber(e.target.value)}
            placeholder="Enter license or ID number"
            disabled={isSubmitting}
          />
        </div>

        {/* ID Expiration */}
        <div>
          <label htmlFor="manualIdExpiration" className={labelClass}>
            ID Expiration Date <span className="text-error-500">*</span>
          </label>
          <input
            id="manualIdExpiration"
            type="text"
            inputMode="numeric"
            className={inputClass}
            value={formatDobMmDdYyyy(manualIdExpirationDigits)}
            onChange={(e) => setManualIdExpirationDigits(extractDobDigits(e.target.value))}
            placeholder="MM/DD/YYYY"
            disabled={isSubmitting}
            required
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-6 flex justify-end gap-3">
        <Button type="submit" disabled={submitDisabled}>
          {isSubmitting || manualEntrySubmitting ? 'Submitting...' : 'Add Customer'}
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            setManualEntry(false);
            setManualFirstName('');
            setManualLastName('');
            setManualDobDigits('');
            setManualIdExpirationDigits('');
            setManualIdType('');
            setManualIdTypeOther('');
            setManualIdNumber('');
            selectNavTab('scan');
          }}
          disabled={isSubmitting || manualEntrySubmitting}
        >
          Cancel
        </Button>
      </div>
    </PanelShell>
  );
}
