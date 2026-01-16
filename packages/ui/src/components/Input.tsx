import type { InputHTMLAttributes } from 'react';

export type InputSize = 'kiosk' | 'touch' | 'md';

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  size?: InputSize;
};

function cn(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(' ');
}

const SIZE_CLASS: Record<InputSize, string> = {
  md: 'h-10 px-3 text-sm',
  touch: 'h-12 px-4 text-base',
  kiosk: 'h-14 px-5 text-lg',
};

export function Input({ size = 'md', className, ...props }: InputProps) {
  return (
    <input
      className={cn(
        'form-input block w-full rounded-md border-gray-300 shadow-sm',
        'focus:border-indigo-600 focus:ring-indigo-600/30',
        'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500',
        SIZE_CLASS[size],
        className
      )}
      {...props}
    />
  );
}

