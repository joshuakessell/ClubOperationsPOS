import type { ComponentProps } from 'react';
import { Button as UiButton } from '@club-ops/ui';

export type ButtonProps = ComponentProps<typeof UiButton>;

export function Button(props: ButtonProps) {
  const { size, className, variant, ...rest } = props;
  return (
    <UiButton
      {...rest}
      variant={variant}
      size={size ?? 'touch'}
      data-variant={variant ?? 'primary'}
      className={['er-btn', className].filter(Boolean).join(' ')}
    />
  );
}

