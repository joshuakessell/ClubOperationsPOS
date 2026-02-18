import { useCallback, useEffect, useState } from 'react';
import type { StaffSession } from './LockScreen';
import { ReAuthModal } from './ReAuthModal';
import { CreateStaffModal } from './staff/CreateStaffModal';
import { PinResetModal } from './staff/PinResetModal';
import { StaffDetailModal } from './staff/StaffDetailModal';
import type { PasskeyCredential, StaffMember } from './staff/types';
import { createStaff, fetchStaff, resetStaffPin, updateStaff } from './api/staffAdmin';
import { fetchWebAuthnCredentials, revokeWebAuthnCredential } from './api/webauthnAdmin';

interface StaffManagementProps {
  session: StaffSession;
}

export function StaffManagement({ session }: StaffManagementProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([]);
  const [showPasskeyModal, setShowPasskeyModal] = useState(false);
  const [showPinResetModal, setShowPinResetModal] = useState(false);
  const [showReAuthModal, setShowReAuthModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [, setPendingPinReset] = useState<{ staffId: string; newPin: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const loadStaff = useCallback(async () => {
    if (!session.sessionToken) return;

    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (roleFilter) params.set('role', roleFilter);
      if (activeFilter) params.set('active', activeFilter);

      const data = await fetchStaff(session.sessionToken, params);
      setStaff(data.staff || []);
    } catch (error) {
      console.error('Failed to load staff:', error);
      showToast('Failed to load staff', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, roleFilter, search, session.sessionToken, showToast]);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const loadPasskeys = async (staffId: string) => {
    if (!session.sessionToken) return;

    try {
      const data = await fetchWebAuthnCredentials(session.sessionToken, staffId);
      setPasskeys(data.credentials || []);
    } catch (error) {
      console.error('Failed to load passkeys:', error);
      showToast('Failed to load passkeys', 'error');
    }
  };

  const handleCreateStaff = async (formData: {
    name: string;
    role: 'STAFF' | 'ADMIN';
    pin: string;
    active: boolean;
  }) => {
    if (!session.sessionToken) return;

    try {
      await createStaff(session.sessionToken, formData);
      showToast('Staff created successfully', 'success');
      setShowCreateModal(false);
      loadStaff();
    } catch (error) {
      console.error('Failed to create staff:', error);
      showToast('Failed to create staff', 'error');
    }
  };

  const handleToggleActive = async (staffId: string, currentActive: boolean) => {
    if (!session.sessionToken) return;

    try {
      await updateStaff(session.sessionToken, staffId, { active: !currentActive });
      showToast(`Staff ${!currentActive ? 'activated' : 'deactivated'}`, 'success');
      loadStaff();
    } catch (error) {
      console.error('Failed to update staff:', error);
      showToast('Failed to update staff', 'error');
    }
  };

  const handleRevokePasskey = async (credentialId: string) => {
    if (!session.sessionToken) return;

    if (!confirm('Are you sure you want to revoke this passkey?')) return;

    // Request re-auth before proceeding
    setPendingAction(() => async () => {
      await performRevokePasskey(credentialId);
    });
    setShowReAuthModal(true);
  };

  const performRevokePasskey = async (credentialId: string) => {
    if (!session.sessionToken) return;

    try {
      await revokeWebAuthnCredential(session.sessionToken, credentialId);
      showToast('Passkey revoked', 'success');
      if (selectedStaff) {
        loadPasskeys(selectedStaff.id);
      }
    } catch (error) {
      console.error('Failed to revoke passkey:', error);
      showToast('Failed to revoke passkey', 'error');
    }
  };

  const handlePinReset = async (staffId: string, newPin: string) => {
    if (!session.sessionToken) return;

    // Store the PIN reset data and request re-auth
    setPendingPinReset({ staffId, newPin });
    setPendingAction(() => async () => {
      // Use the parameters directly instead of captured state to avoid stale closures
      const success = await performPinReset(staffId, newPin);
      if (success) {
        // Only clear state on successful completion
        setPendingPinReset(null);
      }
      // On failure (including re-auth errors), keep the state so user can retry
    });
    setShowReAuthModal(true);
  };

  const performPinReset = async (staffId: string, newPin: string): Promise<boolean> => {
    if (!session.sessionToken) return false;

    try {
      await resetStaffPin(session.sessionToken, staffId, newPin);
      showToast('PIN reset successfully', 'success');
      setShowPinResetModal(false);
      return true;
    } catch (error) {
      console.error('Failed to reset PIN:', error);
      showToast('Failed to reset PIN', 'error');
      return false;
    }
  };

  const openStaffDetail = (staffMember: StaffMember) => {
    setSelectedStaff(staffMember);
    setShowPasskeyModal(true);
    loadPasskeys(staffMember.id);
  };

  return (
    <div
      className="staff-management"
      style={{ padding: '2rem', maxWidth: '1400px', margin: '0 auto' }}
    >
      <div
        className="staff-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <h1 style={{ fontSize: '2rem', fontWeight: 600 }}>Staff Management</h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => (window.location.href = '/admin')}
            className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 font-semibold text-gray-300 transition hover:bg-gray-700 disabled:opacity-50"
          >
            ← Back to Admin
          </button>
          <button onClick={() => setShowCreateModal(true)} className="rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50">
            + Create Staff
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        className="staff-filters"
        style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}
      >
        <div className="relative w-full" style={{ flex: 1, minWidth: '200px' }}>
          <input
            className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2 pl-9 pr-4 text-white placeholder:text-gray-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            type="text"
            placeholder="Search by name or ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 14L11.1 11.1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{
            padding: '0.75rem',
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '6px',
            color: '#f9fafb',
            fontSize: '1rem',
          }}
        >
          <option value="">All Roles</option>
          <option value="STAFF">STAFF</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          style={{
            padding: '0.75rem',
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '6px',
            color: '#f9fafb',
            fontSize: '1rem',
          }}
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      {/* Staff Table */}
      <div
        className="staff-table-container"
        style={{ background: '#1f2937', borderRadius: '8px', overflow: 'hidden' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#111827', borderBottom: '1px solid #374151' }}>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Name</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Role</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Active</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Created</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Last Login</th>
              <th style={{ padding: '1rem', textAlign: 'left', fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                  Loading...
                </td>
              </tr>
            ) : staff.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#9ca3af' }}>
                  No staff members found
                </td>
              </tr>
            ) : (
              staff.map((member) => (
                <tr key={member.id} style={{ borderBottom: '1px solid #374151' }}>
                  <td style={{ padding: '1rem' }}>{member.name}</td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        background: member.role === 'ADMIN' ? '#7c3aed' : '#374151',
                        color: '#f9fafb',
                      }}
                    >
                      {member.role}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span
                      style={{
                        padding: '0.25rem 0.75rem',
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        background: member.active ? '#10b981' : '#ef4444',
                        color: '#f9fafb',
                      }}
                    >
                      {member.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', color: '#9ca3af' }}>
                    {new Date(member.createdAt).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '1rem', color: '#9ca3af' }}>
                    {member.lastLogin ? new Date(member.lastLogin).toLocaleDateString() : 'Never'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        onClick={() => openStaffDetail(member)}
                        className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 font-semibold text-gray-300 transition hover:bg-gray-700 disabled:opacity-50"
                      >
                        View
                      </button>
                      <button
                        onClick={() => handleToggleActive(member.id, member.active)}
                        className={
                          member.active
                            ? 'rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 font-semibold text-red-400 transition hover:bg-red-500/20 disabled:opacity-50'
                            : 'rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50'
                        }
                      >
                        {member.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Staff Modal */}
      {showCreateModal && (
        <CreateStaffModal onClose={() => setShowCreateModal(false)} onCreate={handleCreateStaff} />
      )}

      {/* Staff Detail Modal */}
      {showPasskeyModal && selectedStaff && (
        <StaffDetailModal
          staff={selectedStaff}
          passkeys={passkeys}
          onClose={() => {
            setShowPasskeyModal(false);
            setSelectedStaff(null);
          }}
          onRevokePasskey={handleRevokePasskey}
          onPinReset={() => setShowPinResetModal(true)}
          sessionToken={session.sessionToken}
        />
      )}

      {/* PIN Reset Modal */}
      {showPinResetModal && selectedStaff && (
        <PinResetModal
          staffId={selectedStaff.id}
          staffName={selectedStaff.name}
          onClose={() => setShowPinResetModal(false)}
          onReset={(staffId, newPin) => {
            setShowPinResetModal(false);
            handlePinReset(staffId, newPin);
          }}
        />
      )}

      {/* Re-auth Modal */}
      {showReAuthModal && session.sessionToken && (
        <ReAuthModal
          sessionToken={session.sessionToken}
          onSuccess={() => {
            setShowReAuthModal(false);
            if (pendingAction) {
              pendingAction();
              setPendingAction(null);
            }
          }}
          onCancel={() => {
            setShowReAuthModal(false);
            setPendingAction(null);
            setPendingPinReset(null);
          }}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            padding: '1rem 1.5rem',
            background: toast.type === 'success' ? '#10b981' : '#ef4444',
            color: '#f9fafb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
            zIndex: 1000,
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
