import { useState } from 'react';
import type { StaffSession } from '../LockScreen';
import './MessagesView.css';

interface MessagesViewProps {
  session: StaffSession;
}

interface Message {
  id: string;
  from: string;
  subject: string;
  preview: string;
  date: string;
  unread: boolean;
}

export function MessagesView({ session }: MessagesViewProps) {
  const [activeTab, setActiveTab] = useState<'email' | 'internal'>('email');
  const [messages, setMessages] = useState<Message[]>([]);

  // TODO: Implement email fetching from club.dallas@aol.com
  // TODO: Implement internal messaging system

  return (
    <div className="messages-view">
      <div className="view-header">
        <div className="header-content">
          <h2>Messages</h2>
          <p className="view-subtitle">Email and internal messaging</p>
        </div>
      </div>

      <div className="messages-container">
        <div className="messages-tabs">
          <button
            className={`tab-button ${activeTab === 'email' ? 'active' : ''}`}
            onClick={() => setActiveTab('email')}
          >
            <span className="tab-icon">📧</span>
            <span>Email</span>
          </button>
          <button
            className={`tab-button ${activeTab === 'internal' ? 'active' : ''}`}
            onClick={() => setActiveTab('internal')}
          >
            <span className="tab-icon">💬</span>
            <span>Internal Messages</span>
          </button>
        </div>

        <div className="messages-content">
          {activeTab === 'email' ? (
            <div className="messages-placeholder">
              <div className="placeholder-content">
                <span className="placeholder-icon">📧</span>
                <h3>Email Integration</h3>
                <p>
                  This section will retrieve emails from club.dallas@aol.com and display
                  them here for management review.
                </p>
                <div className="placeholder-note">
                  <span className="note-icon">ℹ️</span>
                  <span>Email integration coming soon</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="messages-placeholder">
              <div className="placeholder-content">
                <span className="placeholder-icon">💬</span>
                <h3>Internal Messaging</h3>
                <p>
                  This section will allow management and employees to communicate
                  internally through the system.
                </p>
                <div className="placeholder-note">
                  <span className="note-icon">ℹ️</span>
                  <span>Internal messaging coming soon</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
