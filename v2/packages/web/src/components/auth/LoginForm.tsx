import { useState, type FormEvent } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import toast from "react-hot-toast";

export function LoginForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    formData.set("flow", flow);

    try {
      await signIn("password", formData);
      toast.success(flow === "signIn" ? "Welcome back!" : "Account created!");
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {flow === "signUp" && (
        <Input
          name="name"
          label="Full Name"
          placeholder="Enter your name"
          required
        />
      )}

      <Input
        name="email"
        type="email"
        label="Email"
        placeholder="you@dazzledivas.com"
        required
      />

      <Input
        name="password"
        type="password"
        label="Password"
        placeholder="Enter your password"
        required
        minLength={6}
      />

      {error && (
        <p className="text-sm text-danger">{error}</p>
      )}

      <Button type="submit" loading={loading} className="w-full">
        {flow === "signIn" ? "Sign In" : "Create Account"}
      </Button>

      <div className="text-center">
        <button
          type="button"
          className="text-sm text-primary-500 hover:text-primary-600"
          onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
        >
          {flow === "signIn"
            ? "Need an account? Sign up"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </form>
  );
}
