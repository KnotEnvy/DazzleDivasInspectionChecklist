import { Email } from "@convex-dev/auth/providers/Email";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel, Id } from "./_generated/dataModel";
import { sendPasswordSetupEmail } from "./lib/onboardingEmail";

export type UserRole = "ADMIN" | "CLEANER" | "INSPECTOR";
export type PasswordSetupStatus =
  | "SELF_SIGNUP"
  | "ADMIN_BOOTSTRAP"
  | "INVITED"
  | "PASSWORD_SET";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function buildPasswordSetupRedirectPath(email: string) {
  const normalizedEmail = normalizeEmail(email);
  return `/set-password?email=${encodeURIComponent(normalizedEmail)}`;
}

export function buildUserProfile(params: {
  name?: string;
  email: string;
  role?: UserRole;
  isActive?: boolean;
  createdById?: Id<"users">;
  provisionedByAdmin?: boolean;
  passwordSetupStatus?: PasswordSetupStatus;
  inviteSentAt?: number;
  inviteDeliveryError?: string;
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
    inviteSentAt: params.inviteSentAt,
    inviteDeliveryError: params.inviteDeliveryError,
  };
}

export const passwordResetEmailProvider = Email<DataModel>({
  id: "staff-invite",
  name: "Staff Invite",
  maxAge: 60 * 60 * 24 * 3,
  from: process.env.RESEND_FROM_EMAIL?.trim() || "Dazzle Divas <onboarding@resend.dev>",
  async sendVerificationRequest(params: { identifier: string; url: string; expires: Date }) {
    await sendPasswordSetupEmail({
      inviteUrl: params.url,
      recipientEmail: params.identifier,
      expires: params.expires,
    });
  },
});

const CustomPassword = Password<DataModel>({
  reset: passwordResetEmailProvider as any,
  profile(params) {
    if (params.flow === "signUp") {
      throw new Error("Self-signup is disabled. Ask an admin to create your account.");
    }

    return buildUserProfile({
      name: params.name as string | undefined,
      email: params.email as string,
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
