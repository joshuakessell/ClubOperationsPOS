import type { ComponentProps } from 'react';
import { Modal as UiModal } from '@club-ops/ui';

export type ModalProps = ComponentProps<typeof UiModal>;

export function Modal(props: ModalProps) {
  const { width, panelClassName, ...rest } = props;
  return (
    <UiModal
      {...rest}
      width={width ?? 'xl'}
      panelClassName={panelClassName ?? 'p-8'}
    />
  );
}

