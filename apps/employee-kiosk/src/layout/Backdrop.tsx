import { useSidebar } from "../context/SidebarContext";

const Backdrop: React.FC = () => {
  const { isMobileOpen, setIsMobileOpen } = useSidebar();

  if (!isMobileOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-gray-900/50 xl:hidden"
      onClick={() => setIsMobileOpen(false)}
    />
  );
};

export default Backdrop;
