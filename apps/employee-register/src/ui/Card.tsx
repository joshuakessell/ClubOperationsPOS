import type { ComponentProps } from 'react';
import { Card as UiCard } from '@club-ops/ui';

export type CardProps = ComponentProps<typeof UiCard>;

export function Card(props: CardProps) {
  const { padding, className, ...rest } = props;
  return (
    <UiCard
      {...rest}
      padding={padding ?? 'lg'}
      className={['er-card', className].filter(Boolean).join(' ')}
    />
  );
}

