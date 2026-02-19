
import { SignInPanel } from '../components/sign-in/SignInPanel';
import { useRegisterSignInContext } from '../RegisterSignIn';
import { GridShape } from '../components/auth/GridShape';
import clubLogo from '../assets/logo_vector_transparent_hi.svg';

/**
 * Full-screen sign-in page using TailAdmin AuthPageLayout pattern.
 * Left: PIN-based sign-in flow.
 * Right: Club Dallas branding panel with GridShape decoration.
 *
 * Uses min-h-screen + flex-1 for proper auto-sizing at any display size.
 * Responsive: stacks vertically on mobile, side-by-side at lg breakpoint.
 */
export default function SignInPage() {
  const signInContext = useRegisterSignInContext();

  if (!signInContext) return null;

  return (
    <div className="relative bg-white p-6 dark:bg-gray-900 sm:p-0">
      <div className="relative flex min-h-screen w-full flex-col lg:flex-row dark:bg-gray-900">
        {/* ── Left: Sign-In Panel ─────────────────────────── */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-8">
          <div className="w-full max-w-md pt-10">
            {/* Kiosk badge */}
            <div className="mb-8">
              <span className="inline-flex items-center gap-2 rounded-full bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-500 ring-1 ring-brand-500/20 dark:text-brand-400 dark:ring-brand-400/20">
                <span className="h-1.5 w-1.5 rounded-full bg-brand-500 dark:bg-brand-400" />
                Employee Kiosk
              </span>
            </div>

            {/* Title */}
            <div className="mb-5 sm:mb-8">
              <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
                Sign In
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Select your name and enter your PIN to get started.
              </p>
            </div>

            {/* Sign-in flow */}
            <SignInPanel
              deviceId={signInContext.deviceId}
              onSignedIn={signInContext.onSignedIn}
            />
          </div>
        </div>

        {/* ── Right: Club Dallas Branding ─────────────────── */}
        <div className="relative hidden w-full items-center bg-brand-950 dark:bg-white/5 lg:grid lg:w-1/2">
          <div className="relative z-1 flex items-center justify-center">
            {/* Corner grid decorations */}
            <GridShape />

            {/* Centered content */}
            <div className="flex max-w-xs flex-col items-center gap-6">
              {/* Logo */}
              <div className="flex h-48 w-48 items-center justify-center rounded-3xl border border-white/[0.08] bg-white/[0.04] p-6 shadow-2xl backdrop-blur-sm">
                <img
                  src={clubLogo}
                  alt="Club Dallas Logo"
                  className="h-full w-full object-contain drop-shadow-lg"
                />
              </div>

              {/* Club name */}
              <div className="text-center">
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
              <p className="text-center text-gray-400 dark:text-white/60">
                Manage check-ins, rentals, upgrades, and customer accounts — all from one place.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
