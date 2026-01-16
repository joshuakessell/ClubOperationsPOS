import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PinInput } from '@club-ops/ui';

function countFilledDots(container: HTMLElement) {
  return container.querySelectorAll('[data-filled=\"true\"]').length;
}

describe('PinInput', () => {
  it('enters digits, backspaces, clears, and submits when complete', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    const { container } = render(
      <PinInput length={4} onChange={onChange} onSubmit={onSubmit} />
    );

    // Initially empty
    expect(countFilledDots(container)).toBe(0);

    fireEvent.click(screen.getByRole('button', { name: '1' }));
    fireEvent.click(screen.getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: '3' }));
    expect(countFilledDots(container)).toBe(3);

    // Submit disabled until length is reached
    const submit = screen.getByRole('button', { name: 'Enter' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '4' }));
    expect(countFilledDots(container)).toBe(4);
    expect(submit.disabled).toBe(false);

    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('1234');

    // Backspace
    fireEvent.click(screen.getByRole('button', { name: '⌫' }));
    expect(countFilledDots(container)).toBe(3);

    // Clear
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(countFilledDots(container)).toBe(0);

    // Sanity: onChange called along the way
    expect(onChange).toHaveBeenCalled();
  });
});

