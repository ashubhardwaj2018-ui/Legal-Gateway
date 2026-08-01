import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const passwordResetTokensTable = pgTable(
  "password_reset_tokens",
  {
    id: serial("id").primaryKey(),
    token: text("token").notNull().unique(),
    userId: integer("user_id").notNull(),
    userType: text("user_type").notNull(), // "admin" | "employee"
    email: text("email").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenIdx: index("prt_token_idx").on(table.token),
    emailIdx: index("prt_email_idx").on(table.email),
  }),
);
