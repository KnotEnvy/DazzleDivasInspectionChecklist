import { type FormEvent, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "convex/_generated/api";
import type { Id } from "convex/_generated/dataModel";
import toast from "react-hot-toast";
import { Mail, Users } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

type AdminStats = {
  users: number;
  activeProperties: number;
  activeInspections: number;
  completedInspections: number;
};

type UserRole = "ADMIN" | "CLEANER" | "INSPECTOR";
type PasswordSetupStatus = "SELF_SIGNUP" | "ADMIN_BOOTSTRAP" | "INVITED" | "PASSWORD_SET";

type AdminUser = {
  _id: Id<"users">;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: number;
  provisionedByAdmin?: boolean;
  passwordSetupStatus?: PasswordSetupStatus;
  inviteSentAt?: number;
  inviteDeliveryError?: string;
};

type StaffInviteResult = {
  userId: Id<"users">;
  email: string;
  role: UserRole;
  isActive: boolean;
  inviteSent: boolean;
  inviteSentAt?: number;
  inviteError?: string;
};

type WorkerPayProfile = {
  _id: Id<"workerPayProfiles">;
  userId: Id<"users">;
  role: "CLEANER" | "INSPECTOR";
  perRoomComboRate: number;
  unitBonus: number;
  effectiveStart: number;
};

function onboardingLabel(status?: PasswordSetupStatus) {
  switch (status) {
    case "INVITED":
      return "Invite Pending";
    case "PASSWORD_SET":
      return "Password Set";
    case "ADMIN_BOOTSTRAP":
      return "Bootstrap Password";
    case "SELF_SIGNUP":
      return "Self-Signup";
    default:
      return "Unknown";
  }
}

function onboardingTone(status?: PasswordSetupStatus) {
  switch (status) {
    case "INVITED":
      return "bg-amber-100 text-amber-800";
    case "PASSWORD_SET":
      return "bg-emerald-100 text-emerald-700";
    case "ADMIN_BOOTSTRAP":
      return "bg-brand-100 text-brand-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export function AdminPage() {
  const stats = useQuery(api.admin.stats) as AdminStats | undefined;
  const users = useQuery(api.users.list) as AdminUser[] | undefined;
  const payProfiles = useQuery(api.finance.listWorkerPayProfiles) as WorkerPayProfile[] | undefined;
  const updateUser = useMutation(api.users.update);
  const upsertWorkerPayProfile = useMutation(api.finance.upsertWorkerPayProfile);
  const createStaffAccount = useAction(api.users.createStaffAccount);
  const resendStaffInvite = useAction(api.users.resendStaffInvite);

  const [savingUserId, setSavingUserId] = useState<Id<"users"> | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [sendingInviteUserId, setSendingInviteUserId] = useState<Id<"users"> | null>(null);
  const [savingPayProfileUserId, setSavingPayProfileUserId] = useState<Id<"users"> | null>(null);

  const sortedUsers = useMemo(() => {
    return (users ?? []).slice().sort((a, b) => a.email.localeCompare(b.email));
  }, [users]);

  const payProfileByUserId = useMemo(() => {
    return new Map((payProfiles ?? []).map((profile) => [profile.userId, profile] as const));
  }, [payProfiles]);

  async function handleUserUpdate(
    userId: Id<"users">,
    updates: Partial<Pick<AdminUser, "role" | "isActive">>,
    successMessage: string
  ) {
    const existing = sortedUsers.find((user) => user._id === userId);
    if (
      !existing ||
      ((updates.role === undefined || updates.role === existing.role) &&
        (updates.isActive === undefined || updates.isActive === existing.isActive))
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
      const result = (await createStaffAccount({
        name: String(formData.get("name") ?? "").trim(),
        email: String(formData.get("email") ?? "").trim(),
        role: String(formData.get("role") ?? "CLEANER") as UserRole,
        isActive: String(formData.get("status") ?? "ACTIVE") === "ACTIVE",
      })) as StaffInviteResult;
      form.reset();
      toast.success(
        result.inviteSent ? "Staff account created and invite sent" : "Staff account created"
      );
      if (result.inviteError) {
        toast.error(result.inviteError);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  }

  async function handleResendInvite(user: AdminUser) {
    setSendingInviteUserId(user._id);
    try {
      const result = (await resendStaffInvite({ userId: user._id })) as StaffInviteResult;
      if (result.inviteSent) {
        toast.success("Invite email sent");
      } else {
        toast.error(result.inviteError ?? "Failed to send invite email");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send invite email");
    } finally {
      setSendingInviteUserId(null);
    }
  }

  async function handleSavePayProfile(event: FormEvent<HTMLFormElement>, user: AdminUser) {
    event.preventDefault();

    if (user.role !== "CLEANER") {
      return;
    }

    const formData = new FormData(event.currentTarget);
    const perRoomComboRate = Number(String(formData.get("perRoomComboRate") ?? ""));
    const unitBonus = Number(String(formData.get("unitBonus") ?? ""));

    if (!Number.isFinite(perRoomComboRate) || perRoomComboRate <= 0) {
      toast.error("Per-room combo rate must be greater than 0");
      return;
    }

    if (!Number.isFinite(unitBonus) || unitBonus < 0) {
      toast.error("Unit bonus cannot be negative");
      return;
    }

    setSavingPayProfileUserId(user._id);
    try {
      await upsertWorkerPayProfile({
        userId: user._id,
        role: "CLEANER",
        perRoomComboRate,
        unitBonus,
      });
      toast.success("Cleaner pay profile saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save pay profile");
    } finally {
      setSavingPayProfileUserId(null);
    }
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Admin Console</h1>
        <p className="text-sm text-slate-600">
          Starter controls for operations, staffing, onboarding, and cleaner pay setup.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Users" value={stats?.users} />
        <Card label="Active Properties" value={stats?.activeProperties} />
        <Card label="In Progress" value={stats?.activeInspections} />
        <Card label="Completed" value={stats?.completedInspections} />
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <div className="mb-3">
          <h2 className="text-lg font-bold">Operations Setup</h2>
          <p className="text-sm text-slate-600">
            Manage property records, recurring service plans, dispatch, and the finance module.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <Link className="field-button secondary px-4 py-2 text-center text-sm" to="/schedule">
            Open Dispatch Board
          </Link>
          <Link className="field-button secondary px-4 py-2 text-center text-sm" to="/admin/templates">
            Open Checklist Templates
          </Link>
          <Link className="field-button primary px-4 py-2 text-center text-sm" to="/admin/properties">
            Open Property Management
          </Link>
          <Link className="field-button secondary px-4 py-2 text-center text-sm" to="/finance">
            Open Finance Hub
          </Link>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <div className="mb-4">
          <h2 className="text-lg font-bold">Invite Staff User</h2>
          <p className="text-sm text-slate-600">
            Create cleaner, inspector, and admin accounts, then email a password setup link instead of sharing temporary credentials manually.
          </p>
        </div>

        <form className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" onSubmit={handleCreateUser}>
          <label className="text-sm font-medium text-slate-700">
            Full name
            <input className="input mt-1" name="name" placeholder="Alex Rivera" required />
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

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 md:col-span-2 xl:col-span-4">
            New active users receive an email invite with a secure password setup link. Inactive users are created without sending the invite until you activate them.
          </div>

          <div className="md:col-span-2 xl:col-span-4">
            <button className="field-button primary px-5" disabled={creatingUser} type="submit">
              {creatingUser ? "Creating..." : "Create Staff Account"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-border bg-white p-4">
        <h2 className="mb-2 text-lg font-bold">Users</h2>

        {users === undefined ? (
          <div className="space-y-3">
            <div className="skeleton h-16 rounded-xl" />
            <div className="skeleton h-16 rounded-xl" />
            <div className="skeleton h-16 rounded-xl" />
          </div>
        ) : sortedUsers.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            heading="No staff accounts yet"
            description="Create your first staff account using the form above."
          />
        ) : (
          <div className="space-y-2">
            {sortedUsers.map((user) => {
              const payProfile = payProfileByUserId.get(user._id);

              return (
                <div key={user._id} className="rounded-xl border border-border p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{user.name}</p>
                      <p className="truncate text-sm text-slate-600">{user.email}</p>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          user.role === "ADMIN"
                            ? "bg-brand-100 text-brand-700"
                            : user.role === "CLEANER"
                              ? "bg-cyan-100 text-cyan-700"
                              : "bg-slate-100 text-slate-600"
                        }`}>
                          {user.role}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          user.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}>
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${onboardingTone(user.passwordSetupStatus)}`}>
                          {onboardingLabel(user.passwordSetupStatus)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {user.provisionedByAdmin ? "Admin provisioned" : "Self-signup"}
                        {user.createdAt ? ` | ${new Date(user.createdAt).toLocaleDateString()}` : ""}
                        {user.inviteSentAt ? ` | invite sent ${new Date(user.inviteSentAt).toLocaleString()}` : ""}
                      </p>
                      {user.inviteDeliveryError ? (
                        <p className="mt-1 text-xs text-rose-600">Last invite error: {user.inviteDeliveryError}</p>
                      ) : null}

                      {user.role === "CLEANER" ? (
                        <form
                          key={`${user._id}:${payProfile?._id ?? "none"}:${payProfile?.perRoomComboRate ?? ""}:${payProfile?.unitBonus ?? ""}`}
                          className="mt-3 rounded-xl border border-border bg-slate-50 p-3"
                          onSubmit={(event) => void handleSavePayProfile(event, user)}
                        >
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cleaner Pay Profile</p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            <label className="text-sm font-medium text-slate-700">
                              Per-room combo rate
                              <input
                                className="input mt-1"
                                defaultValue={payProfile ? String(payProfile.perRoomComboRate) : ""}
                                name="perRoomComboRate"
                                step="0.01"
                                type="number"
                              />
                            </label>
                            <label className="text-sm font-medium text-slate-700">
                              Unit bonus
                              <input
                                className="input mt-1"
                                defaultValue={payProfile ? String(payProfile.unitBonus) : "15"}
                                name="unitBonus"
                                step="0.01"
                                type="number"
                              />
                            </label>
                            <div className="flex items-end">
                              <button
                                className="field-button secondary w-full px-4"
                                disabled={savingPayProfileUserId === user._id}
                                type="submit"
                              >
                                {savingPayProfileUserId === user._id ? "Saving..." : "Save Pay Profile"}
                              </button>
                            </div>
                          </div>
                          <p className="mt-2 text-xs text-slate-500">
                            Current formula: room combo units x worker rate + unit bonus.
                          </p>
                        </form>
                      ) : null}
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3">
                      <label className="text-sm font-medium text-slate-700">
                        Role
                        <select
                          className="input mt-1"
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
                          className="input mt-1"
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

                      {user.passwordSetupStatus === "INVITED" ? (
                        <button
                          className="field-button secondary col-span-2 inline-flex items-center justify-center gap-2 px-4 sm:col-span-1"
                          disabled={sendingInviteUserId === user._id || !user.isActive}
                          onClick={() => void handleResendInvite(user)}
                          type="button"
                        >
                          <Mail className="h-4 w-4" />
                          {sendingInviteUserId === user._id ? "Sending..." : "Resend Invite"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value ?? "..."}</p>
    </div>
  );
}
