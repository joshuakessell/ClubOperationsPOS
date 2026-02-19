import { useCallback, useEffect, useState } from 'react';
import type { StaffSession } from './LockScreen';
import { apiJson } from './api';
import { PanelContent } from './views/PanelContent';
import { PanelHeader } from './views/PanelHeader';
import { PanelShell } from './views/PanelShell';
import { RaisedCard } from './views/RaisedCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Product = {
  id: string;
  sku: string | null;
  name: string;
  priceCents: number;
  category: string;
  isActive: boolean;
  sortOrder: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ProductManagementView({ session }: { session: StaffSession }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [priceDollars, setPriceDollars] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState('RETAIL');

  // Edit mode
  const [editId, setEditId] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiJson<{ products: Product[] }>(
        '/v1/admin/products?includeInactive=true',
        { sessionToken: session.sessionToken }
      );
      setProducts(data.products ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [session.sessionToken]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const resetForm = () => {
    setName('');
    setPriceDollars('');
    setSku('');
    setCategory('RETAIL');
    setEditId(null);
  };

  const startEdit = (p: Product) => {
    setEditId(p.id);
    setName(p.name);
    setPriceDollars((p.priceCents / 100).toFixed(2));
    setSku(p.sku ?? '');
    setCategory(p.category);
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const cents = Math.round(parseFloat(priceDollars || '0') * 100);
    if (!Number.isFinite(cents) || cents < 0) {
      setError('Invalid price');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (editId) {
        await apiJson(`/v1/admin/products/${editId}`, {
          sessionToken: session.sessionToken,
          method: 'PATCH',
          body: {
            name: trimmedName,
            priceCents: cents,
            sku: sku.trim() || null,
            category,
          },
        });
      } else {
        await apiJson('/v1/admin/products', {
          sessionToken: session.sessionToken,
          method: 'POST',
          body: {
            name: trimmedName,
            priceCents: cents,
            sku: sku.trim() || null,
            category,
          },
        });
      }
      resetForm();
      await loadProducts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (p: Product) => {
    setSaving(true);
    setError(null);
    try {
      await apiJson(`/v1/admin/products/${p.id}`, {
        sessionToken: session.sessionToken,
        method: 'PATCH',
        body: { isActive: !p.isActive },
      });
      await loadProducts();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    'w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder:text-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40';
  const btnPrimary =
    'rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50';
  const btnSecondary =
    'rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 font-semibold text-gray-300 transition hover:bg-gray-700 disabled:opacity-50';

  return (
    <PanelShell spacing="md">
      <PanelHeader title="Product Management" />
      <PanelContent padding="md">
        {error && (
          <div
            style={{
              marginBottom: '1rem',
              padding: '0.75rem',
              border: '1px solid var(--error)',
              borderRadius: 8,
              color: 'var(--error)',
            }}
          >
            {error}
          </div>
        )}

        {/* ───── Add / Edit Product Form ───── */}
        <RaisedCard style={{ marginBottom: '1.5rem' }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.75rem' }}>
            {editId ? '✏️ Edit Product' : '➕ Add Product'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.875rem' }}>
                Name *
              </label>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Monster Energy"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.875rem' }}>
                Price ($)
              </label>
              <input
                className={inputClass}
                type="number"
                step="0.01"
                min="0"
                value={priceDollars}
                onChange={(e) => setPriceDollars(e.target.value)}
                placeholder="10.00"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.875rem' }}>
                SKU
              </label>
              <input
                className={inputClass}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontWeight: 600, fontSize: '0.875rem' }}>
                Category
              </label>
              <select
                className={inputClass}
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="RETAIL">Retail</option>
                <option value="FOOD">Food</option>
                <option value="BEVERAGE">Beverage</option>
                <option value="ACCESSORY">Accessory</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
            <button className={btnPrimary} disabled={saving || !name.trim()} onClick={() => void handleSubmit()}>
              {saving ? 'Saving…' : editId ? 'Update Product' : 'Add Product'}
            </button>
            {editId && (
              <button className={btnSecondary} onClick={resetForm}>
                Cancel
              </button>
            )}
          </div>
        </RaisedCard>

        {/* ───── Product List ───── */}
        <RaisedCard>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '0.75rem' }}>
            🏪 Products ({products.filter((p) => p.isActive).length} active)
          </div>

          {loading ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading products…</div>
          ) : products.length === 0 ? (
            <div style={{ color: 'var(--text-muted)' }}>No products found. Add one above.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="rooms-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>SKU</th>
                    <th>Category</th>
                    <th style={{ textAlign: 'right' }}>Price</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr
                      key={p.id}
                      style={{
                        opacity: p.isActive ? 1 : 0.5,
                        background: editId === p.id ? 'rgba(43, 102, 184, 0.12)' : undefined,
                      }}
                    >
                      <td className="room-number">{p.name}</td>
                      <td style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                        {p.sku || '—'}
                      </td>
                      <td>{p.category}</td>
                      <td style={{ textAlign: 'right', fontWeight: 800 }}>{formatCurrency(p.priceCents)}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 999,
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            background: p.isActive ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: p.isActive ? '#22c55e' : '#ef4444',
                          }}
                        >
                          {p.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                          <button
                            className={btnSecondary}
                            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                            onClick={() => startEdit(p)}
                          >
                            Edit
                          </button>
                          <button
                            className={btnSecondary}
                            style={{ fontSize: '0.8rem', padding: '4px 10px' }}
                            disabled={saving}
                            onClick={() => void toggleActive(p)}
                          >
                            {p.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </RaisedCard>
      </PanelContent>
    </PanelShell>
  );
}
