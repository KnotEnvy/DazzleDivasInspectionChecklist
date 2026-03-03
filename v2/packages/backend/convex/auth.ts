import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import { DataModel } from "./_generated/dataModel";

/**
 * Custom Password provider that sets app-specific fields on user creation.
 * New users default to INSPECTOR role and active status.
 */
const CustomPassword = Password<DataModel>({
  profile(params) {
    const role =
      params.role === "ADMIN" ? ("ADMIN" as const) : ("INSPECTOR" as const);
    return {
      name: (params.name as string) ?? "User",
      email: params.email as string,
      role,
      isActive: true,
    };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [CustomPassword],
});
