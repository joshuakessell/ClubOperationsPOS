import { useState } from 'react';
import type { StaffSession } from './LockScreen';
import { EmployeesView } from './views/EmployeesView';
import { OperationsView } from './views/OperationsView';
import { ReportsView } from './views/ReportsView';
import { MessagesView } from './views/MessagesView';
import './Dashboard.css';

interface DashboardProps {
  session: StaffSession;
  onLogout: () => void;
}

type DashboardSection = 'employees' | 'operations' | 'reports' | 'messages';

export function Dashboard({ session, onLogout }: DashboardProps) {
  const [activeSection, setActiveSection] = useState<DashboardSection>('employees');

  return (
    <div className="dashboard-container">
      {/* Left Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-circle">
              <span className="logo-text">CD</span>
            </div>
            <span className="logo-label">Club Dallas</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-button ${activeSection === 'employees' ? 'active' : ''}`}
            onClick={() => setActiveSection('employees')}
          >
            <span className="nav-icon">👥</span>
            <span className="nav-label">Employees</span>
          </button>
          <button
            className={`nav-button ${activeSection === 'operations' ? 'active' : ''}`}
            onClick={() => setActiveSection('operations')}
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">Operations</span>
          </button>
          <button
            className={`nav-button ${activeSection === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveSection('reports')}
          >
            <span className="nav-icon">📊</span>
            <span className="nav-label">Reports</span>
          </button>
          <button
            className={`nav-button ${activeSection === 'messages' ? 'active' : ''}`}
            onClick={() => setActiveSection('messages')}
          >
            <span className="nav-icon">💬</span>
            <span className="nav-label">Messages</span>
          </button>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="dashboard-main">
        {/* Top Bar */}
        <header className="dashboard-header">
          <h1 className="section-title">
            {activeSection === 'employees' && 'Employees'}
            {activeSection === 'operations' && 'Operations'}
            {activeSection === 'reports' && 'Reports'}
            {activeSection === 'messages' && 'Messages'}
          </h1>
          <div className="header-user">
            <div className="user-info">
              <span className="user-name">{session.name}</span>
              <span className="user-role">{session.role}</span>
            </div>
            <button className="sign-out-button" onClick={onLogout}>
              Sign Out
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="dashboard-content">
          {activeSection === 'employees' && <EmployeesView session={session} />}
          {activeSection === 'operations' && <OperationsView session={session} />}
          {activeSection === 'reports' && <ReportsView session={session} />}
          {activeSection === 'messages' && <MessagesView session={session} />}
        </div>
      </main>
    </div>
  );
}
