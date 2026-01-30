type FatalEnvScreenProps = {
  message: string;
};

export function FatalEnvScreen({ message }: FatalEnvScreenProps) {
  return (
    <div className="max-w-2xl p-10 font-sans">
      <h1 className="text-2xl font-semibold">Fatal configuration error</h1>
      <p className="mt-4 text-sm text-muted-foreground">{message}</p>
      <pre className="mt-6 rounded-2xl bg-slate-900 p-4 text-xs text-white">
        {'Required: VITE_KIOSK_TOKEN\nFix: set it in your .env / env vars and restart dev server.'}
      </pre>
    </div>
  );
}
