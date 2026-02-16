/**
 * TailAdmin Pro Button — adapted for @club-ops use.
 * Upstream: components/ui/button/Button.tsx
 * Added: lg size, secondary/danger/success/ghost variants, type + fullWidth props
 */
import { ReactNode } from "react";

export interface ButtonProps {
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  variant?: "primary" | "outline" | "secondary" | "danger" | "success" | "ghost";
  startIcon?: ReactNode;
  endIcon?: ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit" | "reset";
  fullWidth?: boolean;
}

const sizeClasses = {
  sm: "px-4 py-3 text-sm",
  md: "px-5 py-3.5 text-sm",
  lg: "px-6 py-4 text-base",
};

const variantClasses = {
  primary:
    "bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300",
  outline:
    "bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700 dark:hover:bg-white/[0.03] dark:hover:text-gray-300",
  secondary:
    "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
  danger:
    "bg-error-500 text-white shadow-theme-xs hover:bg-error-600 disabled:bg-error-300",
  success:
    "bg-success-500 text-white shadow-theme-xs hover:bg-success-600 disabled:bg-success-300",
  ghost:
    "bg-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/[0.05]",
};

const Button: React.FC<ButtonProps> = ({
  children,
  size = "md",
  variant = "primary",
  startIcon,
  endIcon,
  onClick,
  className = "",
  disabled = false,
  type = "button",
  fullWidth = false,
}) => {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition ${sizeClasses[size]} ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${disabled ? "cursor-not-allowed opacity-50" : ""} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {startIcon && <span className="flex items-center">{startIcon}</span>}
      {children}
      {endIcon && <span className="flex items-center">{endIcon}</span>}
    </button>
  );
};

export default Button;
