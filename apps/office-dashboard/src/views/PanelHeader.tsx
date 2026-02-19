import type { ReactNode } from 'react';

export interface PanelHeaderProps {
  title: ReactNode;
  titleAs?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
}

export function PanelHeader({
  title,
  titleAs = 'h2',
  actions,
  className,
  titleClassName,
}: PanelHeaderProps) {
  const TitleTag = titleAs;
  return (
    <div
      className={[
        'flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 px-6 py-4 dark:border-gray-800',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <TitleTag
        className={['text-base font-semibold text-gray-800 dark:text-white/90', titleClassName]
          .filter(Boolean)
          .join(' ')}
      >
        {title}
      </TitleTag>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
