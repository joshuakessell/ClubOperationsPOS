import { useEffect, useState, type CSSProperties } from 'react';
import type { InternalMessage } from '@club-ops/shared';
import type { StaffSession } from './LockScreen';

interface AdminMessage {
  message: InternalMessage;
  ackCount: number;
  createdByName: string | null;
}

interface StaffOption {
  id: string;
  name: string;
  role: string;
}

interface MessagesViewProps {
  session: StaffSession;
}

const API_BASE = '/api';

export function MessagesView({ session }: MessagesViewProps) {
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    body: '',
    severity: 'INFO',
    targetType: 'ALL',
    targetRole: 'STAFF',
    targetStaffId: '',
    targetDeviceId: '',
    expiresAt: '',
    pinned: false,
  });

  useEffect(() => {
    loadMessages();
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      const res = await fetch(`${API_BASE}/v1/admin/staff`, {
        headers: { Authorization: `Bearer ${session.sessionToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStaff(data.staff || []);
      }
    } catch (err) {
      console.error('Failed to load staff', err);
    }
  };

  const loadMessages = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/v1/admin/messages`, {
        headers: { Authorization: `Bearer ${session.sessionToken}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to load messages');
      }
      const data = await res.json();
      setMessages(data.messages || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload: any = {
        title: form.title,
        body: form.body,
        severity: form.severity,
        target_type: form.targetType,
        pinned: form.pinned,
      };
      if (form.targetType === 'ROLE') payload.target_role = form.targetRole;
      if (form.targetType === 'STAFF') payload.target_staff_id = form.targetStaffId || undefined;
      if (form.targetType === 'DEVICE') payload.target_device_id = form.targetDeviceId || undefined;
      if (form.expiresAt) payload.expires_at = new Date(form.expiresAt).toISOString();

      const res = await fetch(`${API_BASE}/v1/admin/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.sessionToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to send message');
      }

      setForm({
        title: '',
        body: '',
        severity: 'INFO',
        targetType: 'ALL',
        targetRole: 'STAFF',
        targetStaffId: '',
        targetDeviceId: '',
        expiresAt: '',
        pinned: false,
      });
      await loadMessages();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSubmitting(false);
    }
  };

  const renderTargetFields = () => {
    if (form.targetType === 'ROLE') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem' }}>Target Role</label>
          <select
            value={form.targetRole}
            onChange={(e) => setForm((f) => ({ ...f, targetRole: e.target.value }))}
            style={inputStyle}
          >
            <option value="STAFF">STAFF</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>
      );
    }
    if (form.targetType === 'STAFF') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem' }}>Target Staff</label>
          <select
            value={form.targetStaffId}
            onChange={(e) => setForm((f) => ({ ...f, targetStaffId: e.target.value }))}
            style={inputStyle}
          >
            <option value="">Select staff...</option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.role})
              </option>
            ))}
          </select>
        </div>
      );
    }
    if (form.targetType === 'DEVICE') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <label style={{ fontSize: '0.9rem' }}>Target Device ID</label>
          <input
            value={form.targetDeviceId}
            onChange={(e) => setForm((f) => ({ ...f, targetDeviceId: e.target.value }))}
            style={inputStyle}
            placeholder="device-123"
          />
        </div>
      );
    }
    return null;
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Internal Messages</h1>
        <button
          onClick={loadMessages}
          style={{ padding: '0.5rem 1rem', background: '#374151', color: '#f9fafb', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
        >
          Refresh
        </button>
      </div>

      {error && (
        <div style={{ background: '#7f1d1d', color: '#fecdd3', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem' }}>
          {error}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
        <form onSubmit={handleSubmit} style={{ background: '#111827', border: '1px solid #1f2937', borderRadius: '12px', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '1rem' }}>Compose Message</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem' }}>Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                style={inputStyle}
                required
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.9rem' }}>Body</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                style={{ ...inputStyle, minHeight: '120px' }}
                required
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.9rem' }}>Severity</label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="INFO">Info</option>
                  <option value="WARNING">Warning</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.9rem' }}>Target</label>
                <select
                  value={form.targetType}
                  onChange={(e) => setForm((f) => ({ ...f, targetType: e.target.value }))}
                  style={inputStyle}
                >
                  <option value="ALL">All devices</option>
                  <option value="ROLE">By role</option>
                  <option value="STAFF">Specific staff</option>
                  <option value="DEVICE">Specific device</option>
                </select>
              </div>
            </div>
            {renderTargetFields()}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.9rem' }}>Expires At (optional)</label>
                <input
                  type="datetime-local"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '1.2rem' }}>
                <input
                  type="checkbox"
                  checked={form.pinned}
                  onChange={(e) => setForm((f) => ({ ...f, pinned: e.target.checked }))}
                />
                <span>Pinned</span>
              </label>
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                padding: '0.85rem 1.25rem',
                background: submitting ? '#6b7280' : '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                marginTop: '0.5rem',
              }}
            >
              {submitting ? 'Sending...' : 'Send Message'}
            </button>
          </div>
        </form>

        <div style={{ background: '#0f172a', border: '1px solid #1f2937', borderRadius: '12px', padding: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600 }}>Recent Messages</h2>
            {loading && <span style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Loading...</span>}
          </div>
          {messages.length === 0 && !loading && (
            <div style={{ color: '#9ca3af' }}>No messages yet.</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.map(({ message, ackCount, createdByName }) => (
              <div key={message.id} style={{ border: '1px solid #1f2937', borderRadius: '10px', padding: '1rem', background: message.pinned ? '#1e293b' : '#111827' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{message.title}</div>
                  <span style={{
                    padding: '0.25rem 0.6rem',
                    borderRadius: '6px',
                    background: badgeColor(message.severity),
                    color: '#0b1221',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                  }}>
                    {message.severity}
                  </span>
                </div>
                <div style={{ color: '#e5e7eb', marginBottom: '0.35rem' }}>{message.body}</div>
                <div style={{ display: 'flex', gap: '1rem', color: '#9ca3af', fontSize: '0.85rem' }}>
                  <span>Target: {message.targetType}{message.targetRole ? ` (${message.targetRole})` : ''}</span>
                  <span>Ack: {ackCount}</span>
                  {message.expiresAt && <span>Expires: {new Date(message.expiresAt).toLocaleString()}</span>}
                  <span>Sent: {new Date(message.createdAt).toLocaleString()}</span>
                  {createdByName && <span>By: {createdByName}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = {
  padding: '0.65rem 0.75rem',
  background: '#0b1221',
  border: '1px solid #1f2937',
  borderRadius: '8px',
  color: '#f9fafb',
};

function badgeColor(severity: string): string {
  if (severity === 'URGENT') return '#f87171';
  if (severity === 'WARNING') return '#f59e0b';
  return '#60a5fa';
}

