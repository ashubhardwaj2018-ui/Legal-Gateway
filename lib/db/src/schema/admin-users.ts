import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const adminUsersTable = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("admin"),
  isActive: boolean("is_active").default(true),
  forcePasswordChange: boolean("force_password_change").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminUser = typeof adminUsersTable.$inferSelect;
