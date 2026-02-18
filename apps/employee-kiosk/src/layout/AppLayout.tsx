import type { ReactNode } from "react";
import AppHeader from "./AppHeader";
import AppSidebar from "./AppSidebar";
import type { NavTab } from "../app/state/shared/types";

export interface AppLayoutProps {
  children?: ReactNode;
  /** The currently active navigation tab — passed to AppSidebar */
  activeTab: NavTab;
  /** Called when user clicks a sidebar nav item */
  onNavigate: (tab: NavTab) => void;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children, activeTab, onNavigate }) => {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-900">
      {/* Permanent sidebar — always 240px, never collapses */}
      <AppSidebar activeTab={activeTab} onNavigate={onNavigate} />

      {/* Right side: header + bounded content */}
      <div className="flex flex-1 flex-col min-w-0">
        <AppHeader />

        {/* Content area — fills remaining space, no page-level scroll */}
        <div className="flex-1 min-h-0 p-3">
          <div
            className="flex h-full w-full items-start justify-center overflow-hidden"
            data-main-content
          >
            <div className="flex h-full w-full max-w-full flex-col p-4">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
