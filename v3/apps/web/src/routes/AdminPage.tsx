import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import toast from "react-hot-toast";

type AdminStats = {
  users: number;
  activeProperties: number;
  activeInspections: number;
  completedInspections: number;
};

type UserRole = "ADMIN" | "CLEANER" | "INSPECTOR";

type AdminUser = {
  _id: Id<"users">;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
};

export function AdminPage() {
  const stats = useQuery(api.admin.stats) as AdminStats | undefined;
  const users = useQuery(api.users.list) as AdminUser[] | undefined;
  const updateUser = useMutation(api.users.update);

  const [savingUserId, setSavingUserId] = useState<Id<"users"> | null>(null);

  const sortedUsers = useMemo(() => {
    return (users ?? []).slice().sort((a, b) => a.email.localeCompare(b.email));
  }, [users]);

  async function handleRoleChange(userId: Id<"users">, nextRole: UserRole) {
    const existing = sortedUsers.find((user) => user._id === userId);
    if (!existing || existing.role === nextRole) {
      return;
    }

    setSavingUserId(userId);

    try {
      await updateUser({ userId, role: nextRole });
      toast.success("Role updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role");
    } finally {
      setSavingUserId(null);
    }
  }

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
        ) : sortedUsers.length === 0 ? (
          <p className="text-sm text-slate-500">No users yet.</p>
        ) : (
          <div className="space-y-2">
            {sortedUsers.map((user) => (
              <div key={user._id} className="rounded-xl border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{user.name}</p>
                    <p className="text-sm text-slate-600">{user.email}</p>
                    <p className="text-xs font-semibold text-brand-700">
                      {user.role} - {user.isActive ? "Active" : "Inactive"}
                    </p>
                  </div>

                  <label className="text-sm font-medium text-slate-700">
                    Role
                    <select
                      className="input mt-1 min-w-36"
                      value={user.role}
                      disabled={savingUserId === user._id}
                      onChange={(event) =>
                        void handleRoleChange(user._id, event.target.value as UserRole)
                      }
                    >
                      <option value="ADMIN">ADMIN</option>
                      <option value="CLEANER">CLEANER</option>
                      <option value="INSPECTOR">INSPECTOR</option>
                    </select>
                  </label>
                </div>
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
