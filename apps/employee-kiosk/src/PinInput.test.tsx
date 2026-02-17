import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiquidGlassPinInput } from '@club-ops/ui';

/**
 * Count filled PIN dots via the `is-filled` class applied by LiquidGlassPinInput.
 */
function countFilledDots(container: HTMLElement) {
  return container.querySelectorAll('.is-filled').length;
}

describe('LiquidGlassPinInput', () => {
  it('enters digits, backspaces, clears, and submits when complete', () => {
    const onChange = vi.fn();
    const onSubmit = vi.fn();

    const { container } = render(
      <LiquidGlassPinInput length={4} onChange={onChange} onSubmit={onSubmit} />
    );

    // Initially empty — four dots but none filled
    expect(countFilledDots(container)).toBe(0);

    // Type 1-2-3
    fireEvent.click(screen.getByRole('button', { name: 'Digit 1' }));
    fireEvent.click(screen.getByRole('button', { name: 'Digit 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Digit 3' }));
    expect(countFilledDots(container)).toBe(3);

    // Submit disabled until length is reached
    const submit = screen.getByRole<HTMLButtonElement>('button', { name: 'Enter' });
    expect(submit.disabled).toBe(true);

    // Type 4 → full
    fireEvent.click(screen.getByRole('button', { name: 'Digit 4' }));
    expect(countFilledDots(container)).toBe(4);
    expect(submit.disabled).toBe(false);

    // Submit
    fireEvent.click(submit);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith('1234');

    // Backspace removes last digit
    fireEvent.click(screen.getByRole('button', { name: 'Backspace' }));
    expect(countFilledDots(container)).toBe(3);

    // Clear resets to empty
    fireEvent.click(screen.getByRole('button', { name: 'Clear PIN' }));
    expect(countFilledDots(container)).toBe(0);

    // onChange called throughout interaction
    expect(onChange).toHaveBeenCalled();
  });

  it('does not exceed the specified length', () => {
    const onChange = vi.fn();

    const { container } = render(<LiquidGlassPinInput length={2} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Digit 5' }));
    fireEvent.click(screen.getByRole('button', { name: 'Digit 6' }));
    fireEvent.click(screen.getByRole('button', { name: 'Digit 7' }));

    // Should cap at 2 filled dots
    expect(countFilledDots(container)).toBe(2);
  });

  it('renders the PIN display with the correct aria-label', () => {
    render(<LiquidGlassPinInput length={4} displayAriaLabel="Security PIN" />);

    expect(screen.getByRole('textbox', { name: 'Security PIN' })).toBeDefined();
  });
});
