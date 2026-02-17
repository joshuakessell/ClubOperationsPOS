import { useMemo } from 'react';
import { Button, Badge, Alert } from '@club-ops/ui/tailadmin';
import { useEmployeeRegisterState } from '../../app/state/useEmployeeRegisterState';
import { useClubLogState } from '../../app/state/slices/useClubLogState';

const ACTION_CATEGORIES = [
  '',
  'CHECKIN',
  'CHECKOUT',
  'UPGRADE',
  'PURCHASE',
  'RESOURCE_CHANGE',
  'NOTE',
  'ADMIN',
];

const inputClass =
  'h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-white/30';

const selectClass =
  'h-11 w-full appearance-none rounded-lg border border-gray-200 bg-transparent px-4 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white';

export function ClubLogPanel() {
  const { openCustomerAccount } = useEmployeeRegisterState();
  const { items, loading, error, q, category, setQ, setCategory, reload, loadMore, nextCursor } =
    useClubLogState({ pageSize: 60 });

  const rows = useMemo(() => items.slice(0, 600), [items]);

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      {/* Filter bar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
              htmlFor="club-log-search"
            >
              Search
            </label>
            <input
              id="club-log-search"
              className={inputClass}
              value={q}
              placeholder="customer name, order id, visit id, etc"
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="w-[200px]">
            <label
              className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-400"
              htmlFor="club-log-category"
            >
              Category
            </label>
            <select
              id="club-log-category"
              className={selectClass}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {ACTION_CATEGORIES.map((c) => (
                <option key={c || 'ALL'} value={c}>
                  {c ? c : 'All'}
                </option>
              ))}
            </select>
          </div>

          <Button variant="outline" size="sm" onClick={() => void reload()}>
            Refresh
          </Button>
        </div>

        {error ? (
          <div className="mt-3">
            <Alert variant="error" title="Error" message={error} />
          </div>
        ) : null}
      </div>

      {/* Data table */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="h-full overflow-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 dark:border-gray-800">
              <tr className="text-left">
                <th className="w-[160px] px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                  Time
                </th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                  Customer
                </th>
                <th className="w-[130px] px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                  Category
                </th>
                <th className="w-[160px] px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                  Type
                </th>
                <th className="px-4 py-3 text-sm font-medium text-gray-500 dark:text-gray-400">
                  Summary
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {rows.map((it) => (
                <tr key={it.id} className="transition hover:bg-gray-50 dark:hover:bg-white/[0.03]">
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {new Date(it.occurredAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="text-sm font-bold text-brand-500 hover:text-brand-600 dark:text-brand-400"
                      onClick={() =>
                        openCustomerAccount(it.customerId, it.customerName, { autoStart: false })
                      }
                    >
                      {it.customerName}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Badge color="light" variant="light" size="sm">
                      {it.actionCategory}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {it.actionType}
                  </td>
                  <td className="max-w-[520px] px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                    {it.summary}
                  </td>
                </tr>
              ))}

              {rows.length === 0 && !loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400"
                  >
                    No log entries found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          {/* Load more */}
          <div className="flex justify-center p-4">
            {nextCursor ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadMore()}
                disabled={loading}
              >
                {loading ? 'Loading…' : 'Load more'}
              </Button>
            ) : (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {loading ? 'Loading…' : 'End of stream'}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
