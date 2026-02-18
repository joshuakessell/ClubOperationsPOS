/**
 * Sidebar icons — sourced from TailAdmin Pro icon pack.
 * Each icon is an inline SVG React component using currentColor.
 */

interface IconProps {
  className?: string;
}

/** Sign-in arrow icon */
export const SignInIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Scan — box-tapped (barcode scan) */
export const ScanIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M7.75586 5.50098C7.75586 5.08676 8.09165 4.75098 8.50586 4.75098H18.4985C18.9127 4.75098 19.2485 5.08676 19.2485 5.50098L19.2485 15.4956C19.2485 15.9098 18.9127 16.2456 18.4985 16.2456H8.50586C8.09165 16.2456 7.75586 15.9098 7.75586 15.4956V5.50098ZM8.50586 3.25098C7.26322 3.25098 6.25586 4.25834 6.25586 5.50098V6.26318H5.50195C4.25931 6.26318 3.25195 7.27054 3.25195 8.51318V18.4995C3.25195 19.7422 4.25931 20.7495 5.50195 20.7495H15.4883C16.7309 20.7495 17.7383 19.7421 17.7383 18.4995L17.7383 17.7456H18.4985C19.7411 17.7456 20.7485 16.7382 20.7485 15.4956L20.7485 5.50097C20.7485 4.25833 19.7411 3.25098 18.4985 3.25098H8.50586ZM16.2383 17.7456H8.50586C7.26322 17.7456 6.25586 16.7382 6.25586 15.4956V7.76318H5.50195C5.08774 7.76318 4.75195 8.09897 4.75195 8.51318V18.4995C4.75195 18.9137 5.08774 19.2495 5.50195 19.2495H15.4883C15.9025 19.2495 16.2383 18.9137 16.2383 18.4995L16.2383 17.7456Z" fill="currentColor" />
  </svg>
);

/** Search — magnifying glass (user-line) */
export const SearchIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Rentals — key (lock icon adapted) */
export const KeyIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15.75 5.25a3.75 3.75 0 11-4.886 5.093L6.75 14.457V17.25h2.625v-1.5H11.25V14.25l.614-.614A3.75 3.75 0 0115.75 5.25zm1.125 2.625a1.125 1.125 0 10-2.25 0 1.125 1.125 0 002.25 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Upgrades — shooting star */
export const UpgradeIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2l2.09 6.26L20.18 9l-5 4.09L16.82 20 12 16.27 7.18 20l1.64-6.91L3.82 9l6.09-.74L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Retail — cart */
export const CartIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2.316 4H3.497c.748 0 1.381.551 1.485 1.291L5.134 6.372M5.134 6.372L6.236 14.21c.104.74.738 1.291 1.486 1.291l9.361-.001c.597 0 1.137-.354 1.376-.901L21.126 8.47c.431-.99-.295-2.099-1.375-2.099H5.134z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M7.783 19.5h.01M16.32 19.5h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Checkout — check circle */
export const CheckCircleIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M2.702 11c0-4.583 3.715-8.298 8.298-8.298 4.583 0 8.298 3.715 8.298 8.298 0 4.583-3.715 8.298-8.298 8.298-4.583 0-8.298-3.715-8.298-8.298zM11 .902C5.423.902.902 5.423.902 11S5.423 21.098 11 21.098 21.098 16.577 21.098 11 16.577.902 11 .902zm3.62 8.838a.9.9 0 00-1.273-1.273l-3.158 3.158-1.536-1.536a.9.9 0 10-1.273 1.273l2.173 2.172a.9.9 0 001.272 0l3.794-3.794z" fill="currentColor" />
  </svg>
);

/** Customer Account — user circle */
export const UserCircleIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 3.5C7.306 3.5 3.5 7.306 3.5 12c0 2.153.8 4.118 2.119 5.616C5.977 15.373 8.049 13.596 10.725 13.596h2.55c2.476 0 4.552 1.714 5.105 4.021A8.465 8.465 0 0020.5 12c0-4.694-3.806-8.5-8.5-8.5zm5.025 15.357v-.012c0-2.07-1.679-3.75-3.75-3.75h-2.55c-2.071 0-3.75 1.68-3.75 3.75v.012A8.465 8.465 0 0012 20.5a8.465 8.465 0 005.025-1.643zM2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10S2 17.523 2 12zm9.999-4.75a2.018 2.018 0 00-2.018 2.018 2.018 2.018 0 002.018 2.018 2.018 2.018 0 002.018-2.018A2.018 2.018 0 0011.999 7.25zm-3.518 2.018a3.518 3.518 0 117.036 0 3.518 3.518 0 01-7.036 0z" fill="currentColor" />
  </svg>
);

/** Club Log — docs */
export const DocsIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M19.5 19.75c0 1.243-1.007 2.25-2.25 2.25H6.75A2.25 2.25 0 014.5 19.75V9.621c0-.597.237-1.169.659-1.59l5.367-5.372A1.75 1.75 0 0112.118 2H17.25A2.25 2.25 0 0119.5 4.25v15.5zM17.25 20.5c.414 0 .75-.336.75-.75V4.25a.75.75 0 00-.75-.75H12.248l.003 3.999a2.251 2.251 0 01-2.25 2.251H6v10.001c0 .414.336.75.75.75h10.5zM7.06 8.25l3.689-3.692.003 2.942a.75.75 0 01-.75.75H7.06zM8.25 14.5a.75.75 0 01.75-.75h6a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75zm0 3a.75.75 0 01.75-.75h3a.75.75 0 010 1.5H9a.75.75 0 01-.75-.75z" fill="currentColor" />
  </svg>
);

/** Manual Entry — pencil */
export const PencilIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M17.091 3.532a2.25 2.25 0 00-3.182 0l-8.302 8.302a2.25 2.25 0 00-.61 1.127l-.735 3.485a.75.75 0 00.888.888l3.485-.735a2.25 2.25 0 001.127-.61l8.301-8.302a2.25 2.25 0 000-3.182l-.972-.973zm-2.121 1.06a.75.75 0 011.06 0l.972.973a.75.75 0 010 1.06l-.898.899-2.033-2.033.899-.899zm-.96 1.959L7.668 12.894a.75.75 0 00-.204.375l-.497 2.359 2.358-.498a.75.75 0 00.376-.203l6.342-6.343-2.033-2.033z" fill="currentColor" />
  </svg>
);

/** Room Cleaning — task icon */
export const TaskIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Three horizontal dots — used for collapsed sidebar header */
export const HorizontalDotsIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="5" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="19" cy="12" r="1" fill="currentColor" />
  </svg>
);
