import { useCallback, useEffect } from "react";
import {
  ScanIcon,
  SearchIcon,
  KeyIcon,
  UpgradeIcon,
  CartIcon,
  CheckCircleIcon,
  UserCircleIcon,
  DocsIcon,
  PencilIcon,
  TaskIcon,
} from "../icons";
import type { NavTab } from "../app/state/shared/types";

/* ── Nav item type ────────────────────────────────── */

type NavItem = {
  name: string;
  icon: React.FC<{ className?: string }>;
  navTab: NavTab;
  fKey: string;        // e.g. "F1"
  fKeyNumber: number;  // e.g. 1
};

/* ── 10 operational items (matches NavigationRoot) ── */

const navItems: NavItem[] = [
  { icon: ScanIcon,        name: "Scan",             navTab: "scan",         fKey: "F1",  fKeyNumber: 1 },
  { icon: SearchIcon,      name: "Search Customer",  navTab: "search",       fKey: "F2",  fKeyNumber: 2 },
  { icon: KeyIcon,         name: "Rentals",          navTab: "inventory",    fKey: "F3",  fKeyNumber: 3 },
  { icon: UpgradeIcon,     name: "Upgrades",         navTab: "upgrades",     fKey: "F4",  fKeyNumber: 4 },
  { icon: CartIcon,        name: "Retail",           navTab: "retail",       fKey: "F5",  fKeyNumber: 5 },
  { icon: CheckCircleIcon, name: "Checkout",         navTab: "checkout",     fKey: "F6",  fKeyNumber: 6 },
  { icon: UserCircleIcon,  name: "Customer Account", navTab: "account",      fKey: "F7",  fKeyNumber: 7 },
  { icon: DocsIcon,        name: "Club Log",         navTab: "clubLog",      fKey: "F8",  fKeyNumber: 8 },
  { icon: PencilIcon,      name: "Manual Entry",     navTab: "firstTime",    fKey: "F9",  fKeyNumber: 9 },
  { icon: TaskIcon,        name: "Room Cleaning",    navTab: "roomCleaning", fKey: "F10", fKeyNumber: 10 },
];

/* ── Auto-focus helper ─────────────────────────────── */

function focusFirstInteractive() {
  requestAnimationFrame(() => {
    setTimeout(() => {
      const mainContent = document.querySelector('[data-main-content]');
      if (!mainContent) return;
      const focusable = mainContent.querySelector<HTMLElement>(
        'input:not([disabled]):not([type="hidden"]), ' +
        'button:not([disabled]), ' +
        'select:not([disabled]), ' +
        'textarea:not([disabled]), ' +
        '[tabindex]:not([tabindex="-1"]):not([disabled])'
      );
      focusable?.focus();
    }, 100);
  });
}

/* ── Props ─────────────────────────────────────────── */

export interface AppSidebarProps {
  /** The currently active navigation tab */
  activeTab: NavTab;
  /** Called when a nav item is clicked */
  onNavigate: (tab: NavTab) => void;
}

/* ── Sidebar component — always expanded at 240px ── */

const AppSidebar: React.FC<AppSidebarProps> = ({ activeTab, onNavigate }) => {

  /* ── Handle item click ────────────────────────────── */
  const handleNavClick = useCallback((item: NavItem) => {
    onNavigate(item.navTab);
    focusFirstInteractive();
  }, [onNavigate]);

  /* ── Global F-key listener ────────────────────────── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const fKeyMap: Record<string, number> = {
        F1: 1, F2: 2, F3: 3, F4: 4, F5: 5,
        F6: 6, F7: 7, F8: 8, F9: 9, F10: 10,
      };
      const num = fKeyMap[e.key];
      if (num === undefined) return;

      // Don't hijack if a modal is open or focus is in an input
      if (document.querySelector('[role="dialog"], [data-modal], .modal-backdrop')) return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;

      const item = navItems.find((n) => n.fKeyNumber === num);
      if (!item) return;

      e.preventDefault();
      onNavigate(item.navTab);
      focusFirstInteractive();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onNavigate]);

  /* ── Render a single menu item ────────────────────── */
  const renderItem = (item: NavItem) => {
    const isActive = activeTab === item.navTab;
    const IconComponent = item.icon;

    return (
      <button
        onClick={() => handleNavClick(item)}
        className={`menu-item group cursor-pointer w-full ${
          isActive ? "menu-item-active" : "menu-item-inactive"
        }`}
        tabIndex={0}
      >
        <span
          className={`menu-item-icon-size ${
            isActive ? "menu-item-icon-active" : "menu-item-icon-inactive"
          }`}
        >
          <IconComponent />
        </span>
        <span className="menu-item-text flex w-full items-center justify-between">
          <span>{item.name}</span>
          <span className="text-[10px] opacity-50">({item.fKey})</span>
        </span>
      </button>
    );
  };

  return (
    <aside
      className="flex w-[240px] shrink-0 flex-col bg-gray-900 border-r border-gray-800 text-white h-screen px-3"
    >
      {/* Logo */}
      <div className="py-3 flex justify-start">
        <span className="text-lg font-bold text-white">Employee Kiosk</span>
      </div>

      {/* Nav items */}
      <div className="flex flex-col flex-1 min-h-0 no-scrollbar">
        <nav className="flex flex-col flex-1">
          <div className="flex flex-col flex-1">
            <div className="flex flex-col flex-1">
              <h2 className="mb-1 text-xs uppercase leading-[20px] text-gray-500">
                Menu
              </h2>

              <ul className="flex flex-col flex-1">
                {navItems.map((item) => (
                  <li key={item.navTab} className="flex flex-1">{renderItem(item)}</li>
                ))}
              </ul>
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
