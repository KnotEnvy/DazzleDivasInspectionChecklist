import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexReactClient } from "convex/react";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { Toaster } from "react-hot-toast";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./index.css";
registerSW({ immediate: true });
const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL);
ReactDOM.createRoot(document.getElementById("root")).render(_jsx(React.StrictMode, { children: _jsx(ConvexAuthProvider, { client: convex, children: _jsxs(BrowserRouter, { children: [_jsx(App, {}), _jsx(Toaster, { position: "top-center", toastOptions: {
                        duration: 2600,
                        style: {
                            borderRadius: "12px",
                            background: "#0f172a",
                            color: "#fff",
                        },
                    } })] }) }) }));
