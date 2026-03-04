import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel";

const CustomPassword = Password<DataModel>({
  profile(params) {
    const role =
      params.role === "ADMIN"
        ? ("ADMIN" as const)
        : params.role === "INSPECTOR"
          ? ("INSPECTOR" as const)
          : ("CLEANER" as const);

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

