import { type FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import toast from "react-hot-toast";

export function LoginPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();

  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [pending, setPending] = useState(false);

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);

    const formData = new FormData(event.currentTarget);
    formData.set("flow", flow);

    try {
      await signIn("password", formData);
      toast.success(flow === "signIn" ? "Welcome back" : "Account created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="glass-panel w-full p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
          Dazzle Divas
        </p>
        <h1 className="mt-1 text-2xl font-bold">Field Checklist</h1>
        <p className="mt-1 text-sm text-slate-600">
          Offline-ready workflow for cleaners and inspectors.
        </p>

        <form className="mt-5 space-y-3" onSubmit={onSubmit}>
          {flow === "signUp" && (
            <label className="block text-sm font-medium text-slate-700">
              Full name
              <input className="input mt-1" name="name" required placeholder="Alex Rivera" />
            </label>
          )}

          <label className="block text-sm font-medium text-slate-700">
            Email
            <input
              className="input mt-1"
              name="email"
              type="email"
              required
              placeholder="you@dazzledivas.com"
            />
          </label>

          <label className="block text-sm font-medium text-slate-700">
            Password
            <input
              className="input mt-1"
              name="password"
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
            />
          </label>

          <button className="field-button primary w-full" disabled={pending} type="submit">
            {pending ? "Please wait..." : flow === "signIn" ? "Sign In" : "Create Account"}
          </button>

          <button
            type="button"
            className="field-button secondary w-full"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Need an account?" : "Already have an account?"}
          </button>
        </form>
      </div>
    </div>
  );
}

