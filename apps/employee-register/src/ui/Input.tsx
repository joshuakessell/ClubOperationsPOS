import type { ComponentProps } from 'react';
import { Input as UiInput } from '@club-ops/ui';

export type InputProps = ComponentProps<typeof UiInput>;

export function Input(props: InputProps) {
  const { size, className, ...rest } = props;
  return (
    <UiInput
      {...rest}
      size={size ?? 'touch'}
      className={['er-input', className].filter(Boolean).join(' ')}
    />
  );
}

