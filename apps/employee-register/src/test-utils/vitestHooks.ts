import { afterAll } from 'vitest';

export function registerHangingProcessDiagnostics() {
  // Only enable in CI to keep local runs clean.
  if (!process.env.CI) return;

  afterAll(() => {
    const handles = (process as any)
      ._getActiveHandles?.()
      ?.filter((h: any) => h !== process.stdout && h !== process.stderr) ?? [];
    if (handles.length === 0) return;

    // Pipes are often used for stdio under test runners; not useful for diagnosing hangs.
    const nonPipeHandles = handles.filter((h: any) => h?.constructor?.name !== 'Pipe');
    if (nonPipeHandles.length === 0) return;

    // eslint-disable-next-line no-console
    console.error(
      '[vitest] Active handles after tests:',
      nonPipeHandles.map((h: any) => h?.constructor?.name ?? typeof h)
    );
  });
}
