import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
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
  createdAt?: number;
  provisionedByAdmin?: boolean;
  passwordSetupStatus?: "SELF_SIGNUP" | "ADMIN_BOOTSTRAP";
};

export function AdminPage() {
  const stats = useQuery(api.admin.stats) as AdminStats | undefined;
  const users = useQuery(api.users.list) as AdminUser[] | undefined;
  const updateUser = useMutation(api.users.update);
  const createStaffAccount = useAction(api.users.createStaffAccount);

  const [savingUserId, setSavingUserId] = useState<Id<"users"> | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);

  const sortedUsers = useMemo(() => {
    return (users ?? []).slice().sort((a, b) => a.email.localeCompare(b.email));
  }, [users]);

  async function handleUserUpdate(
    userId: Id<"users">,
    updates: Partial<Pick<AdminUser, "role" | "isActive">>,
    successMessage: string
  ) {
    const existing = sortedUsers.find((user) => user._id === userId);
    if (
      !existing ||
      (updates.role === undefined || updates.role === existing.role) &&
        (updates.isActive === undefined || updates.isActive === existing.isActive)
    ) {
      return;
    }

    setSavingUserId(userId);

    try {
      await updateUser({ userId, ...updates });
      toast.success(successMessage);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update user");
    } finally {
      setSavingUserId(null);
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingUser(true);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      await createStaffAccount({
        name: String(formData.get("name") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
        password: String(formData.get("password") ?? ""),
        role: String(formData.get("role") ?? "CLEANER") as UserRole,
        isActive: String(formData.get("status") ?? "ACTIVE") === "ACTIVE",
      });
      form.reset();
      toast.success("Staff account created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create user");
    } finally {
      setCreatingUser(false);
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Operations Setup</h2>
            <p className="text-sm text-slate-600">
              Manage property records, recurring service plans, and live dispatch.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="field-button secondary px-4 py-2 text-sm" to="/schedule">
              Open Dispatch Board
            </Link>
            <Link className="field-button secondary px-4 py-2 text-sm" to="/admin/templates">
              Open Checklist Templates
            </Link>
            <Link className="field-button primary px-4 py-2 text-sm" to="/admin/properties">
              Open Property Management
            </Link>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <div className="mb-4">
          <h2 className="text-lg font-bold">Create Staff Account</h2>
          <p className="text-sm text-slate-600">
            Bootstrap cleaner, inspector, and admin accounts without self-signup.
          </p>
        </div>

        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-5" onSubmit={handleCreateUser}>
          <label className="text-sm font-medium text-slate-700">
            Full name
            <input
              className="input mt-1"
              name="name"
              placeholder="Alex Rivera"
              required
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Email
            <input
              className="input mt-1"
              name="email"
              type="email"
              placeholder="alex@dazzledivas.com"
              required
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Initial password
            <input
              className="input mt-1"
              name="password"
              type="password"
              minLength={8}
              placeholder="At least 8 characters"
              required
            />
          </label>

          <label className="text-sm font-medium text-slate-700">
            Initial role
            <select className="input mt-1" defaultValue="CLEANER" name="role">
              <option value="CLEANER">CLEANER</option>
              <option value="INSPECTOR">INSPECTOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>

          <label className="text-sm font-medium text-slate-700">
            Activation state
            <select className="input mt-1" defaultValue="ACTIVE" name="status">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>

          <div className="md:col-span-2 xl:col-span-5">
            <button
              className="field-button primary px-5"
              disabled={creatingUser}
              type="submit"
            >
              {creatingUser ? "Creating..." : "Create Staff Account"}
            </button>
          </div>
        </form>
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
                    <p className="text-xs text-slate-500">
                      {user.provisionedByAdmin ? "Admin bootstrap" : "Self-signup"}
                      {user.createdAt
                        ? ` | ${new Date(user.createdAt).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <label className="text-sm font-medium text-slate-700">
                      Role
                      <select
                        className="input mt-1 min-w-36"
                        value={user.role}
                        disabled={savingUserId === user._id}
                        onChange={(event) =>
                          void handleUserUpdate(
                            user._id,
                            { role: event.target.value as UserRole },
                            "Role updated"
                          )
                        }
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="CLEANER">CLEANER</option>
                        <option value="INSPECTOR">INSPECTOR</option>
                      </select>
                    </label>

                    <label className="text-sm font-medium text-slate-700">
                      Status
                      <select
                        className="input mt-1 min-w-36"
                        value={user.isActive ? "ACTIVE" : "INACTIVE"}
                        disabled={savingUserId === user._id}
                        onChange={(event) =>
                          void handleUserUpdate(
                            user._id,
                            { isActive: event.target.value === "ACTIVE" },
                            "Status updated"
                          )
                        }
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="INACTIVE">INACTIVE</option>
                      </select>
                    </label>
                  </div>
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
