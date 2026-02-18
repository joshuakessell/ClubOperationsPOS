
import { SignInPanel } from '../components/sign-in/SignInPanel';
import { useRegisterSignInContext } from '../RegisterSignIn';
import clubLogo from '../assets/logo_vector_transparent_hi.svg';

/**
 * Full-screen sign-in page with TailAdmin Pro–style split layout.
 * Left: PIN-based sign-in flow.
 * Right: Club Dallas branding panel with logo.
 */
export default function SignInPage() {
  const signInContext = useRegisterSignInContext();

  if (!signInContext) return null;

  return (
    <div className="flex h-screen w-screen bg-gray-950">
      {/* ── Left: Sign-In Panel ─────────────────────────── */}
      <div className="flex w-full flex-col items-center justify-center px-6 py-8 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Kiosk badge */}
          <div className="mb-8">
            <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-400 ring-1 ring-brand-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
              Employee Kiosk
            </span>
          </div>

          {/* Title */}
          <h1 className="mb-2 text-3xl font-bold tracking-tight text-white">
            Sign In
          </h1>
          <p className="mb-8 text-sm text-gray-400">
            Select your name and enter your PIN to get started.
          </p>

          {/* Sign-in flow */}
          <SignInPanel
            deviceId={signInContext.deviceId}
            onSignedIn={signInContext.onSignedIn}
          />
        </div>
      </div>

      {/* ── Right: Club Dallas Branding ─────────────────── */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-1/2 lg:items-center lg:justify-center">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-600/30 via-brand-800/20 to-gray-950" />

        {/* Decorative grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,.1) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Decorative glow circles */}
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-brand-600/10 blur-3xl" />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-8 px-12 text-center">
          {/* Logo */}
          <div className="flex h-48 w-48 items-center justify-center rounded-3xl border border-white/[0.08] bg-white/[0.04] p-6 shadow-2xl backdrop-blur-sm">
            <img
              src={clubLogo}
              alt="Club Dallas Logo"
              className="h-full w-full object-contain drop-shadow-lg"
            />
          </div>

          {/* Club name */}
          <div>
            <h2 className="text-4xl font-black tracking-tight text-white">
              Club Dallas
            </h2>
            <p className="mt-2 text-lg font-medium text-white/60">
              Operations Platform
            </p>
          </div>

          {/* Divider */}
          <div className="h-px w-24 bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          {/* Tagline */}
          <p className="max-w-xs text-sm leading-relaxed text-white/40">
            Manage check-ins, rentals, upgrades, and customer accounts — all from one place.
          </p>
        </div>
      </div>
    </div>
  );
}
