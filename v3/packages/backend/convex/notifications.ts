import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/permissions";

export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const notifications = await ctx.db
      .query("adminNotifications")
      .withIndex("by_recipient_created", (q) => q.eq("recipientUserId", admin._id))
      .order("desc")
      .take(30);

    return {
      notifications,
      unreadCount: notifications.filter((notification) => notification.readAt === undefined).length,
    };
  },
});

export const markRead = mutation({
  args: { notificationId: v.id("adminNotifications") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const notification = await ctx.db.get(args.notificationId);
    if (!notification || notification.recipientUserId !== admin._id) {
      throw new Error("Notification not found");
    }
    if (notification.readAt === undefined) {
      await ctx.db.patch(notification._id, { readAt: Date.now() });
    }
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const admin = await requireAdmin(ctx);
    const unread = await ctx.db
      .query("adminNotifications")
      .withIndex("by_recipient_read", (q) =>
        q.eq("recipientUserId", admin._id).eq("readAt", undefined)
      )
      .collect();
    const readAt = Date.now();
    await Promise.all(unread.map((notification) => ctx.db.patch(notification._id, { readAt })));
  },
});
