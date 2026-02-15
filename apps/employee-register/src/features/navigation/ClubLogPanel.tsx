import { useMemo } from 'react';
import { useEmployeeRegisterState } from '../../app/state/useEmployeeRegisterState';
import { useClubLogState } from '../../app/state/slices/useClubLogState';

const ACTION_CATEGORIES = ['', 'CHECKIN', 'CHECKOUT', 'UPGRADE', 'PURCHASE', 'RESOURCE_CHANGE', 'NOTE', 'ADMIN'];

export function ClubLogPanel() {
  const { openCustomerAccount } = useEmployeeRegisterState();
  const {
    items,
    loading,
    error,
    q,
    category,
    setQ,
    setCategory,
    reload,
    loadMore,
    nextCursor,
  } = useClubLogState({ pageSize: 60 });

  const rows = useMemo(() => items.slice(0, 600), [items]);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
      <div className="cs-card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 260px', minWidth: 220 }}>
            <label className="cs-label" htmlFor="club-log-search">
              Search
            </label>
            <input
              id="club-log-search"
              className="cs-input"
              value={q}
              placeholder="customer name, order id, visit id, etc"
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div style={{ width: 200 }}>
            <label className="cs-label" htmlFor="club-log-category">
              Category
            </label>
            <select
              id="club-log-category"
              className="cs-input"
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

          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <button type="button" className="cs-liquid-button cs-liquid-button--secondary" onClick={() => void reload()}>
              Refresh
            </button>
          </div>
        </div>

        {error ? <div className="cs-alert cs-alert--error" style={{ marginTop: 10 }}>{error}</div> : null}
      </div>

      <div className="cs-card" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <div style={{ height: '100%', overflow: 'auto' }}>
          <table className="cs-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 160 }}>Time</th>
                <th>Customer</th>
                <th style={{ width: 130 }}>Category</th>
                <th style={{ width: 160 }}>Type</th>
                <th>Summary</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((it) => (
                <tr key={it.id}>
                  <td>{new Date(it.occurredAt).toLocaleString()}</td>
                  <td>
                    <button
                      type="button"
                      className="cs-link"
                      onClick={() =>
                        openCustomerAccount(it.customerId, it.customerName, { autoStart: false })
                      }
                      style={{ fontWeight: 900 }}
                    >
                      {it.customerName}
                    </button>
                  </td>
                  <td>{it.actionCategory}</td>
                  <td>{it.actionType}</td>
                  <td style={{ maxWidth: 520 }}>{it.summary}</td>
                </tr>
              ))}

              {rows.length === 0 && !loading ? (
                <tr>
                  <td colSpan={5} style={{ opacity: 0.8, padding: 12 }}>
                    No log entries found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>

          <div style={{ padding: 12, display: 'flex', gap: 8, justifyContent: 'center' }}>
            {nextCursor ? (
              <button
                type="button"
                className="cs-liquid-button cs-liquid-button--secondary"
                onClick={() => void loadMore()}
                disabled={loading}
              >
                {loading ? 'Loading…' : 'Load more'}
              </button>
            ) : (
              <div style={{ opacity: 0.7 }}>{loading ? 'Loading…' : 'End of stream'}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
