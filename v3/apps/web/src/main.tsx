import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Toaster } from "react-hot-toast";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { getValidatedConvexUrl } from "@/lib/runtimeConfig";
import "./index.css";
import { stashPasswordSetupCodeFromUrl } from "@/lib/passwordSetupCode";

registerSW({ immediate: true });
stashPasswordSetupCodeFromUrl();

function BootstrapError({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-300">
          Deployment Configuration Error
        </p>
        <h1 className="mt-3 text-3xl font-bold">Frontend environment is not ready</h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">{message}</p>
        <div className="mt-6 rounded-2xl border border-white/10 bg-slate-900/80 p-4 text-sm text-slate-200">
          <p>Expected variable:</p>
          <p className="mt-2 font-mono text-emerald-300">VITE_CONVEX_URL=https://&lt;your-deployment&gt;.convex.cloud</p>
        </div>
      </div>
    </div>
  );
}

const configuredConvexUrl = (() => {
  try {
    return {
      url: getValidatedConvexUrl(import.meta.env.VITE_CONVEX_URL),
      error: null,
    };
  } catch (error) {
    return {
      url: null,
      error:
        error instanceof Error
          ? error.message
          : "The Convex frontend environment could not be loaded.",
    };
  }
})();

if (configuredConvexUrl.error || !configuredConvexUrl.url) {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <BootstrapError message={configuredConvexUrl.error ?? "Missing frontend configuration."} />
    </React.StrictMode>
  );
} else {
  const convex = new ConvexReactClient(configuredConvexUrl.url);

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <App />
          <Toaster
            position="top-center"
            toastOptions={{
              duration: 2600,
              style: {
                borderRadius: "14px",
                background: "#0f172a",
                color: "#fff",
                boxShadow: "0 8px 24px rgba(15, 23, 42, 0.18)",
              },
            }}
          />
        </BrowserRouter>
      </ConvexAuthProvider>
    </React.StrictMode>
  );
}

