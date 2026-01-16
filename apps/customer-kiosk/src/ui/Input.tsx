import type { ComponentProps } from 'react';
import { Input as UiInput } from '@club-ops/ui';

export type InputProps = ComponentProps<typeof UiInput>;

export function Input(props: InputProps) {
  const { size, ...rest } = props;
  return <UiInput {...rest} size={size ?? 'kiosk'} />;
}

