import {
  QueryCtx,
  MutationCtx,
} from "../_generated/server";
import { Doc } from "../_generated/dataModel";

/**
 * Get the currently authenticated user or throw.
 */
export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", identity.email!))
    .unique();

  if (!user) {
    throw new Error("User not found");
  }

  if (!user.isActive) {
    throw new Error("Account is deactivated");
  }

  return user;
}

/**
 * Get the currently authenticated admin user or throw.
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuth(ctx);
  if (user.role !== "ADMIN") {
    throw new Error("Admin access required");
  }
  return user;
}
