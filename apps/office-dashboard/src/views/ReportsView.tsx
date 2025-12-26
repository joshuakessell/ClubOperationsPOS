import type { StaffSession } from '../LockScreen';
import './ReportsView.css';

interface ReportsViewProps {
  session: StaffSession;
}

export function ReportsView({ session }: ReportsViewProps) {
  return (
    <div className="reports-view">
      <div className="view-header">
        <div className="header-content">
          <h2>Reports</h2>
          <p className="view-subtitle">Generate and view operational reports</p>
        </div>
      </div>

      <div className="reports-placeholder">
        <div className="placeholder-content">
          <span className="placeholder-icon">📊</span>
          <h3>Reports Coming Soon</h3>
          <p>
            This section will allow you to generate and view various reports based on
            information obtained from accounting applications and operational data.
          </p>
          <div className="placeholder-features">
            <div className="feature-item">
              <span className="feature-icon">📈</span>
              <span>Financial Reports</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📋</span>
              <span>Operational Metrics</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">💰</span>
              <span>Revenue Analysis</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">⏱️</span>
              <span>Performance Reports</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
