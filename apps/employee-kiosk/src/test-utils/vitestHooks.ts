import { afterAll } from 'vitest';

interface ActiveHandle {
  constructor?: {
    name?: string;
  };
}

interface ProcessWithInternals extends NodeJS.Process {
  _getActiveHandles?: () => ActiveHandle[];
}

export function registerHangingProcessDiagnostics() {
  // Only enable in CI to keep local runs clean.
  if (!process.env.CI) return;

  afterAll(() => {
    const p = process as unknown as ProcessWithInternals;
    const handles =
      p._getActiveHandles?.()?.filter((h) => h !== process.stdout && h !== process.stderr) ?? [];

    if (handles.length === 0) return;

    // Pipes are often used for stdio under test runners; not useful for diagnosing hangs.
    const nonPipeHandles = handles.filter((h) => h?.constructor?.name !== 'Pipe');
    if (nonPipeHandles.length === 0) return;

    console.error(
      '[vitest] Active handles after tests:',
      nonPipeHandles.map((h) => h?.constructor?.name ?? typeof h)
    );
  });
}
