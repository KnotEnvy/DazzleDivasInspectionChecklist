import { type FormEvent, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useConvexAuth, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";
import { api } from "convex/_generated/api";
import {
  clearStoredPasswordSetupCode,
  getStoredPasswordSetupCode,
} from "@/lib/passwordSetupCode";

function formatPasswordSetupError(error: unknown) {
  if (!(error instanceof Error)) {
    return "Password setup failed";
  }

  if (
    error.message.includes("Invalid code") ||
    error.message.includes("Could not verify code")
  ) {
    return "This password setup link is invalid or expired. Ask an admin to resend it.";
  }

  if (error.message.includes("newPassword")) {
    return "Enter a valid password to continue.";
  }

  return error.message;
}

export function SetPasswordPage() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const completePasswordSetup = useMutation(api.users.completePasswordSetup);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [pending, setPending] = useState(false);
  const [finishingSetup, setFinishingSetup] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const email = useMemo(
    () => (searchParams.get("email") ?? "").trim().toLowerCase(),
    [searchParams]
  );
  const code = useMemo(
    () => searchParams.get("code") ?? getStoredPasswordSetupCode(),
    [searchParams]
  );

  useEffect(() => {
    if (!finishingSetup || !isAuthenticated) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await completePasswordSetup({});
        if (cancelled) {
          return;
        }
        toast.success("Password set. Welcome.");
      } catch (error) {
        if (!cancelled) {
          toast.error(
            error instanceof Error
              ? error.message
              : "Password setup completed, but status sync failed."
          );
        }
      } finally {
        if (!cancelled) {
          setFinishingSetup(false);
          setPending(false);
          navigate("/", { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [completePasswordSetup, finishingSetup, isAuthenticated, navigate]);

  if (isLoading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (isAuthenticated && !finishingSetup) {
    return <Navigate to="/" replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    if (!email || !code) {
      toast.error("This password setup link is missing required information.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setPending(true);

    try {
      await signIn("password", {
        flow: "reset-verification",
        email,
        code,
        newPassword: password,
      });
      clearStoredPasswordSetupCode();
      setFinishingSetup(true);
    } catch (error) {
      toast.error(formatPasswordSetupError(error));
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md items-center px-4">
      <div className="glass-panel w-full p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">
          Dazzle Divas
        </p>
        <h1 className="mt-1 text-2xl font-bold">Set your password</h1>
        <p className="mt-1 text-sm text-slate-600">
          Finish your account setup and sign in to Dazzle Divas Cleaning Hub.
        </p>

        {!email || !code ? (
          <div className="mt-5 space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-semibold">This invite link is incomplete.</p>
            <p>Ask an admin to resend your invite email.</p>
            <Link className="field-button secondary mt-2 px-4 py-2" to="/login">
              Back to Login
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              Account: <span className="font-semibold">{email}</span>
            </div>

            <form className="mt-5 space-y-3" onSubmit={onSubmit}>
              <label className="block text-sm font-medium text-slate-700">
                New password
                <div className="relative mt-1">
                  <input
                    className="input pr-10"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                  />
                  <button
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:text-slate-700"
                    onClick={() => setShowPassword((current) => !current)}
                    type="button"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Confirm password
                <div className="relative mt-1">
                  <input
                    className="input pr-10"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={8}
                    placeholder="Re-enter your password"
                  />
                  <button
                    aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:text-slate-700"
                    onClick={() => setShowConfirmPassword((current) => !current)}
                    type="button"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </label>

              <button className="field-button primary w-full" disabled={pending} type="submit">
                {pending ? "Setting Password..." : "Set Password"}
              </button>
            </form>

            <div className="mt-4 text-sm text-slate-600">
              Already have your password? <Link className="font-semibold underline" to="/login">Go to login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
