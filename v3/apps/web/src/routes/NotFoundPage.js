import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from "react-router-dom";
export function NotFoundPage() {
    return (_jsxs("div", { className: "mx-auto mt-24 max-w-md space-y-3 text-center", children: [_jsx("h1", { className: "text-4xl font-bold", children: "404" }), _jsx("p", { className: "text-slate-600", children: "That page is not in this checklist." }), _jsx(Link, { className: "field-button primary inline-flex items-center px-4", to: "/", children: "Back to Dashboard" })] }));
}
