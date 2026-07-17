import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function notifyAdminsOfJobEvent(
  ctx: MutationCtx,
  params: {
    jobId: Id<"jobs">;
    actorId: Id<"users">;
    actorName: string;
    propertyName: string;
    eventType: "JOB_STARTED" | "JOB_COMPLETED";
  }
) {
  const admins = await ctx.db
    .query("users")
    .withIndex("by_role", (q) => q.eq("role", "ADMIN"))
    .collect();
  const verb = params.eventType === "JOB_STARTED" ? "started" : "completed";
  const title = params.eventType === "JOB_STARTED" ? "Job started" : "Job completed";
  const createdAt = Date.now();

  await Promise.all(
    admins
      .filter((admin) => admin.isActive)
      .map((admin) =>
        ctx.db.insert("adminNotifications", {
          recipientUserId: admin._id,
          jobId: params.jobId,
          eventType: params.eventType,
          title,
          message: `${params.actorName} ${verb} ${params.propertyName}.`,
          actorId: params.actorId,
          createdAt,
        })
      )
  );
}
