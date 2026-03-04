import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import toast from "react-hot-toast";
export function LoginPage() {
    const { isAuthenticated, isLoading } = useConvexAuth();
    const { signIn } = useAuthActions();
    const [flow, setFlow] = useState("signIn");
    const [pending, setPending] = useState(false);
    if (isLoading) {
        return _jsx("div", { className: "p-8 text-center", children: "Loading..." });
    }
    if (isAuthenticated) {
        return _jsx(Navigate, { to: "/", replace: true });
    }
    async function onSubmit(event) {
        event.preventDefault();
        setPending(true);
        const formData = new FormData(event.currentTarget);
        formData.set("flow", flow);
        try {
            await signIn("password", formData);
            toast.success(flow === "signIn" ? "Welcome back" : "Account created");
        }
        catch (error) {
            toast.error(error instanceof Error ? error.message : "Authentication failed");
        }
        finally {
            setPending(false);
        }
    }
    return (_jsx("div", { className: "mx-auto flex min-h-screen max-w-md items-center px-4", children: _jsxs("div", { className: "glass-panel w-full p-6", children: [_jsx("p", { className: "text-xs font-semibold uppercase tracking-[0.2em] text-brand-700", children: "Dazzle Divas" }), _jsx("h1", { className: "mt-1 text-2xl font-bold", children: "Field Checklist" }), _jsx("p", { className: "mt-1 text-sm text-slate-600", children: "Offline-ready workflow for cleaners and inspectors." }), _jsxs("form", { className: "mt-5 space-y-3", onSubmit: onSubmit, children: [flow === "signUp" && (_jsxs("label", { className: "block text-sm font-medium text-slate-700", children: ["Full name", _jsx("input", { className: "input mt-1", name: "name", required: true, placeholder: "Alex Rivera" })] })), _jsxs("label", { className: "block text-sm font-medium text-slate-700", children: ["Email", _jsx("input", { className: "input mt-1", name: "email", type: "email", required: true, placeholder: "you@dazzledivas.com" })] }), _jsxs("label", { className: "block text-sm font-medium text-slate-700", children: ["Password", _jsx("input", { className: "input mt-1", name: "password", type: "password", required: true, minLength: 6, placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" })] }), _jsx("button", { className: "field-button primary w-full", disabled: pending, type: "submit", children: pending ? "Please wait..." : flow === "signIn" ? "Sign In" : "Create Account" }), _jsx("button", { type: "button", className: "field-button secondary w-full", onClick: () => setFlow(flow === "signIn" ? "signUp" : "signIn"), children: flow === "signIn" ? "Need an account?" : "Already have an account?" })] })] }) }));
}
