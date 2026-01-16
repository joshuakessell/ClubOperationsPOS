import type { ComponentProps } from 'react';
import { Button as UiButton } from '@club-ops/ui';

export type ButtonProps = ComponentProps<typeof UiButton>;

export function Button(props: ButtonProps) {
  const { size, ...rest } = props;
  return <UiButton {...rest} size={size ?? 'kiosk'} />;
}

