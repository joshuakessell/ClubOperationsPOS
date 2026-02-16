/**
 * Spinner — simple loading indicator using TailAdmin Pro color tokens.
 * Not present as a reusable component in upstream (SpinnerOne is a demo),
 * so this is a custom component using TailAdmin token classes.
 */

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "h-5 w-5 border-2",
  md: "h-8 w-8 border-[3px]",
  lg: "h-12 w-12 border-4",
};

export const Spinner: React.FC<SpinnerProps> = ({ size = "md", className = "" }) => {
  return (
    <div
      className={`animate-spin rounded-full border-gray-200 border-t-brand-500 dark:border-gray-800 dark:border-t-brand-400 ${sizeClasses[size]} ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
};

export default Spinner;
