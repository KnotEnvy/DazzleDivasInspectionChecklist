import { type FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import { LoadingQuip } from "@/components/LoadingQuip";

function formatAuthErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return "Authentication failed";
  }

  if (error.message === "InvalidAccountId") {
    return "No account found for this email. Ask an admin to create your staff account.";
  }

  if (error.message === "InvalidSecret") {
    return "Incorrect password. Please try again.";
  }

  return error.message;
}

export function LoginPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();

  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (isLoading) {
    return <LoadingQuip />;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const formData = new FormData(event.currentTarget);
    formData.set("flow", "signIn");

    try {
      await signIn("password", formData);
      toast.success("Welcome back");
    } catch (error) {
      toast.error(formatAuthErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="glass-panel w-full p-6 sm:p-8">
        <div className="mb-4 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl bg-white/90 p-1 shadow-sm ring-1 ring-brand-100">
            <img
              alt="Dazzle Divas logo"
              className="h-full w-full object-contain"
              src="/pink-dazzleLogo.WEBP"
            />
          </div>
        </div>
        <p className="text-center text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
          Dazzle Divas
        </p>
        <h1 className="mt-1 text-center text-2xl font-bold">Cleaning Hub</h1>
        <p className="mt-1 text-center text-sm text-slate-600">
          Staff sign-in for cleaners, inspectors, and admins.
        </p>
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Accounts are provisioned by admin. Open self-signup is disabled for production use.
        </div>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              autoFocus
              className="input mt-1"
              name="email"
              type="email"
              required
              placeholder="you@dazzledivas.com"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Password
            <div className="relative mt-1">
              <input
                className="input pr-10"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                placeholder="********"
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:text-slate-700"
                onClick={() => setShowPassword(!showPassword)}
                type="button"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </label>

          <button className="field-button primary w-full" disabled={pending} type="submit">
            {pending ? "Please wait..." : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
