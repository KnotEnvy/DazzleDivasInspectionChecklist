import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { DataModel } from "./_generated/dataModel";

const CustomPassword = Password<DataModel>({
  profile(params) {
    return {
      name: (params.name as string) ?? "User",
      email: params.email as string,
      // New self-serve accounts always start as cleaners.
      // Role changes are handled through admin-only mutations.
      role: "CLEANER" as const,
      isActive: true,
    };
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [CustomPassword],
});

