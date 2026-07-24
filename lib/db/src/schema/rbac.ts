import { pgTable, serial, text, boolean, integer, timestamp, unique } from "drizzle-orm/pg-core";

export const rolesTable = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const rolePermissionsTable = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").notNull().references(() => rolesTable.id, { onDelete: "cascade" }),
  module: text("module").notNull(),
  action: text("action").notNull(),
  allowed: boolean("allowed").notNull().default(false),
}, (t) => ({
  uniq: unique("role_module_action_uniq").on(t.roleId, t.module, t.action),
}));

export const loginHistoryTable = pgTable("login_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  username: text("username").notNull(),
  userType: text("user_type").notNull().default("admin"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  status: text("status").notNull().default("success"),
  loggedInAt: timestamp("logged_in_at", { withTimezone: true }).notNull().defaultNow(),
  loggedOutAt: timestamp("logged_out_at", { withTimezone: true }),
});

export const activityLogsTable = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  username: text("username").notNull(),
  userType: text("user_type").notNull().default("admin"),
  module: text("module").notNull(),
  action: text("action").notNull(),
  entityId: integer("entity_id"),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Role = typeof rolesTable.$inferSelect;
export type RolePermission = typeof rolePermissionsTable.$inferSelect;
export type LoginHistory = typeof loginHistoryTable.$inferSelect;
export type ActivityLog = typeof activityLogsTable.$inferSelect;
