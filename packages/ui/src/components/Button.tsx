import type { ButtonHTMLAttributes } from 'react';

export type ButtonSize = 'kiosk' | 'touch' | 'md';
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> & {
  size?: ButtonSize;
  variant?: ButtonVariant;
  type?: ButtonHTMLAttributes<HTMLButtonElement>['type'];
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(' ');
}

const SIZE_CLASS: Record<ButtonSize, string> = {
  md: 'h-10 px-4 text-sm',
  touch: 'h-12 px-5 text-base',
  kiosk: 'h-14 px-6 text-lg',
};

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary:
    'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-600/40 disabled:bg-indigo-600/60',
  secondary:
    'bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus-visible:ring-indigo-600/30',
  danger:
    'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600/40 disabled:bg-red-600/60',
  ghost:
    'bg-transparent text-gray-900 hover:bg-gray-100 focus-visible:ring-indigo-600/30 disabled:text-gray-400',
};

export function Button({
  size = 'md',
  variant = 'primary',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold shadow-sm',
        'transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-60',
        SIZE_CLASS[size],
        VARIANT_CLASS[variant],
        className
      )}
      {...props}
    />
  );
}

