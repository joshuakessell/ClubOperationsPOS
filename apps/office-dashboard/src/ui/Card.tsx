import type { ComponentProps } from 'react';
import { Card as UiCard } from '@club-ops/ui';

export type CardProps = ComponentProps<typeof UiCard>;

export function Card(props: CardProps) {
  const { padding, ...rest } = props;
  return <UiCard {...rest} padding={padding ?? 'md'} />;
}

