import { useState, useEffect } from 'react';
import type { StaffSession } from '../LockScreen';
import './EmployeesView.css';

const API_BASE = '/api';

interface StaffMember {
  id: string;
  name: string;
  role: 'STAFF' | 'ADMIN';
  active: boolean;
  createdAt: string;
  lastLogin: string | null;
}

interface EmployeesViewProps {
  session: StaffSession;
}

export function EmployeesView({ session }: EmployeesViewProps) {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadStaff();
  }, [search]);

  const loadStaff = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const response = await fetch(`${API_BASE}/v1/admin/staff?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.sessionToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStaff(data.staff || []);
      }
    } catch (error) {
      console.error('Failed to load staff:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="employees-view">
      <div className="view-header">
        <div className="header-content">
          <h2>Employee Management</h2>
          <p className="view-subtitle">View and manage all employees in the system</p>
        </div>
        <div className="search-container">
          <input
            type="text"
            placeholder="Search employees..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading employees...</p>
        </div>
      ) : staff.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">👥</span>
          <p>No employees found</p>
        </div>
      ) : (
        <div className="employees-grid">
          {staff.map((member) => (
            <div
              key={member.id}
              className="employee-card"
              onClick={() => setSelectedStaff(member)}
            >
              <div className="employee-avatar">
                <span>{member.name.charAt(0).toUpperCase()}</span>
              </div>
              <div className="employee-info">
                <h3 className="employee-name">{member.name}</h3>
                <div className="employee-meta">
                  <span className={`role-badge ${member.role.toLowerCase()}`}>
                    {member.role}
                  </span>
                  <span className={`status-badge ${member.active ? 'active' : 'inactive'}`}>
                    {member.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {member.lastLogin && (
                  <p className="employee-last-login">
                    Last login: {new Date(member.lastLogin).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="employee-arrow">→</div>
            </div>
          ))}
        </div>
      )}

      {/* Employee Detail Modal */}
      {selectedStaff && (
        <div className="employee-modal-overlay" onClick={() => setSelectedStaff(null)}>
          <div className="employee-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedStaff.name}</h2>
              <button className="modal-close" onClick={() => setSelectedStaff(null)}>
                ×
              </button>
            </div>
            <div className="modal-content">
              <div className="employee-detail-section">
                <h3>Employee Details</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Name:</span>
                    <span className="detail-value">{selectedStaff.name}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Role:</span>
                    <span className={`role-badge ${selectedStaff.role.toLowerCase()}`}>
                      {selectedStaff.role}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Status:</span>
                    <span className={`status-badge ${selectedStaff.active ? 'active' : 'inactive'}`}>
                      {selectedStaff.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Created:</span>
                    <span className="detail-value">
                      {new Date(selectedStaff.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {selectedStaff.lastLogin && (
                    <div className="detail-item">
                      <span className="detail-label">Last Login:</span>
                      <span className="detail-value">
                        {new Date(selectedStaff.lastLogin).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="modal-note">
                  <p>Full employee management features coming soon</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
