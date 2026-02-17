import { Spinner } from '@club-ops/ui/tailadmin';
import { useEmployeeRegisterState } from '../../app/state/useEmployeeRegisterState';
import { PanelHeader } from '../../views/PanelHeader';
import { PanelShell } from '../../views/PanelShell';

export function SearchPanel() {
  const {
    customerSearch,
    setCustomerSearch,
    customerSearchLoading,
    customerSuggestions,
    setCustomerSuggestions,
    openCustomerAccount,
    isSubmitting,
  } = useEmployeeRegisterState();

  return (
    <PanelShell align="top" scroll="hidden">
      <PanelHeader
        layout="inline"
        spacing="sm"
        title={<label htmlFor="customer-search">Search Customer</label>}
        subtitle="(type at least 3 letters)"
      />

      {/* Search input */}
      <input
        id="customer-search"
        type="text"
        className="mt-3 h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:text-white dark:placeholder:text-white/30"
        value={customerSearch}
        onChange={(e) => setCustomerSearch(e.target.value)}
        placeholder="Start typing name..."
        disabled={isSubmitting}
      />

      {/* Loading indicator */}
      {customerSearchLoading && (
        <div className="mt-2 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
          <Spinner size="sm" />
          Searching...
        </div>
      )}

      {/* Results list */}
      {customerSuggestions.length > 0 && (
        <div className="mt-3 flex-1 overflow-y-auto rounded-lg border border-gray-200 dark:border-gray-800">
          {customerSuggestions.map(
            (s: {
              id: string;
              firstName: string;
              lastName: string;
              dobMonthDay?: string;
              membershipNumber?: string;
            }) => {
              const label = `${s.lastName}, ${s.firstName}`;
              return (
                <button
                  key={s.id}
                  type="button"
                  className="flex w-full items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 text-left transition hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.03]"
                  onClick={() => {
                    openCustomerAccount(s.id, label, {
                      autoStart: true,
                      summary: {
                        name: `${s.firstName} ${s.lastName}`.trim(),
                        dobMonthDay: s.dobMonthDay,
                        membershipNumber: s.membershipNumber,
                      },
                    });
                    setCustomerSearch('');
                    setCustomerSuggestions([]);
                  }}
                >
                  <span className="text-sm font-semibold text-gray-800 dark:text-white/90">
                    {label}
                  </span>
                  <span className="flex flex-wrap gap-3 text-xs text-gray-500 dark:text-gray-400">
                    {s.dobMonthDay && <span>DOB: {s.dobMonthDay}</span>}
                    {s.membershipNumber && <span>Membership: {s.membershipNumber}</span>}
                  </span>
                </button>
              );
            }
          )}
        </div>
      )}
    </PanelShell>
  );
}
