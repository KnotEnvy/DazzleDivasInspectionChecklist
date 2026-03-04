import { useQuery } from "convex/react";
import { api } from "convex/_generated/api";

type AdminStats = {
  users: number;
  activeProperties: number;
  activeInspections: number;
  completedInspections: number;
};

type AdminUser = {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

export function AdminPage() {
  const stats = useQuery(api.admin.stats) as AdminStats | undefined;
  const users = useQuery(api.users.list) as AdminUser[] | undefined;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Admin Console</h1>
        <p className="text-sm text-slate-600">
          Starter controls for operations and staffing.
        </p>
      </div>

      <section className="grid gap-3 lg:grid-cols-4">
        <Card label="Users" value={stats?.users} />
        <Card label="Active Properties" value={stats?.activeProperties} />
        <Card label="In Progress" value={stats?.activeInspections} />
        <Card label="Completed" value={stats?.completedInspections} />
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <h2 className="mb-2 text-lg font-bold">Users</h2>

        {users === undefined ? (
          <p className="text-sm text-slate-500">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-slate-500">No users yet.</p>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <div key={user._id} className="rounded-xl border border-border p-3">
                <p className="font-semibold">{user.name}</p>
                <p className="text-sm text-slate-600">{user.email}</p>
                <p className="text-xs font-semibold text-brand-700">
                  {user.role} • {user.isActive ? "Active" : "Inactive"}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="text-2xl font-bold">{value ?? "..."}</p>
    </div>
  );
}