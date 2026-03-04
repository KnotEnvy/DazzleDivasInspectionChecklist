import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

type CompletedInspection = {
  _id: string;
  _creationTime: number;
  propertyName: string;
  type: string;
};

export function HistoryPage() {
  const items = useQuery(api.inspections.listCompleted) as
    | CompletedInspection[]
    | undefined;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Completed Checklists</h1>

      {items === undefined ? (
        <p className="text-sm text-slate-500">Loading history...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">No completed checklist yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <Link
              key={item._id}
              to={`/checklists/${item._id}`}
              className="block rounded-xl border border-border bg-white p-3 transition hover:border-brand-400"
            >
              <p className="font-semibold">{item.propertyName}</p>
              <p className="text-sm text-slate-600">
                {item.type} • {new Date(item._creationTime).toLocaleString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}