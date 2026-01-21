import { type HTMLAttributes } from 'react';

export function KioskPage({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  const cls = ['ck-page', className].filter(Boolean).join(' ');
  return <div className={cls} {...rest} />;
}

