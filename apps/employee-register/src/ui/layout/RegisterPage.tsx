import { type HTMLAttributes } from 'react';

export function RegisterPage({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const cls = ['er-page', className].filter(Boolean).join(' ');
  return <div className={cls} {...rest} />;
}

