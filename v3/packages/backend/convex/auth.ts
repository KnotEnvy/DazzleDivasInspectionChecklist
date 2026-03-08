import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel, Id } from "./_generated/dataModel";

export type UserRole = "ADMIN" | "CLEANER" | "INSPECTOR";
export type PasswordSetupStatus = "SELF_SIGNUP" | "ADMIN_BOOTSTRAP";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function buildUserProfile(params: {
  name?: string;
  email: string;
  role?: UserRole;
  isActive?: boolean;
  createdById?: Id<"users">;
  provisionedByAdmin?: boolean;
  passwordSetupStatus?: PasswordSetupStatus;
}) {
  return {
    name: params.name?.trim() || "User",
    email: normalizeEmail(params.email),
    role: params.role ?? ("CLEANER" as const),
    isActive: params.isActive ?? true,
    createdAt: Date.now(),
    createdById: params.createdById,
    provisionedByAdmin: params.provisionedByAdmin ?? false,
    passwordSetupStatus: params.passwordSetupStatus ?? ("SELF_SIGNUP" as const),
  };
}

const CustomPassword = Password<DataModel>({
  profile(params) {
    if (params.flow === "signUp") {
      throw new Error("Self-signup is disabled. Ask an admin to create your account.");
    }

    return buildUserProfile({
      name: params.name as string | undefined,
      email: params.email as string,
      // New self-serve accounts always start as cleaners.
      // Role changes are handled through admin-only mutations.
      role: "CLEANER",
      isActive: true,
      provisionedByAdmin: false,
      passwordSetupStatus: "SELF_SIGNUP",
    });
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [CustomPassword],
});

