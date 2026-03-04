import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="mx-auto mt-24 max-w-md space-y-3 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-slate-600">That page is not in this checklist.</p>
      <Link className="field-button primary inline-flex items-center px-4" to="/">
        Back to Dashboard
      </Link>
    </div>
  );
}

