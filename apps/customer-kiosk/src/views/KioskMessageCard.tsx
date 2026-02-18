import type { ReactNode } from 'react';

type MessageCardTone = 'glass' | 'muted';
type MessageCardSize = 'compact' | 'wide';

export interface KioskMessageCardProps {
  title: ReactNode;
  body?: ReactNode;
  tone?: MessageCardTone;
  size?: MessageCardSize;
  className?: string;
  titleClassName?: string;
  bodyClassName?: string;
}

export function KioskMessageCard({
  title,
  body,
  tone = 'glass',
  size = 'wide',
  className,
  titleClassName,
  bodyClassName,
}: KioskMessageCardProps) {
  const toneClasses =
    tone === 'glass'
      ? 'border-gray-700 bg-gray-800/80 backdrop-blur-sm'
      : 'border-gray-700/50 bg-gray-800/40';

  const sizeClasses = size === 'wide' ? 'max-w-2xl' : 'max-w-md';

  const base = 'rounded-2xl border p-8 shadow-xl';

  const classes = [base, toneClasses, sizeClasses, className].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      <div
        className={[
          size === 'wide' ? 'text-3xl' : 'text-xl',
          'font-bold text-white text-center',
          titleClassName,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {title}
      </div>
      {body ? (
        <div
          className={[
            'mt-4 text-center text-gray-400',
            size === 'wide' ? 'text-lg' : 'text-base',
            bodyClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {body}
        </div>
      ) : null}
    </div>
  );
}
