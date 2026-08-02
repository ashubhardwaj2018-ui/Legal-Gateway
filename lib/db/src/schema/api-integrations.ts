import { pgTable, serial, text, boolean, timestamp, index } from "drizzle-orm/pg-core";

export const apiIntegrationsTable = pgTable("api_integrations", {
  id:            serial("id").primaryKey(),
  slug:          text("slug").notNull().unique(),
  enabled:       boolean("enabled").notNull().default(false),
  configEnc:     text("config_enc").notNull().default(""),      // AES-256-CBC encrypted JSON
  status:        text("status").notNull().default("untested"),  // untested | ok | error
  statusMessage: text("status_message"),
  lastUsedAt:    timestamp("last_used_at",  { withTimezone: true }),
  createdAt:     timestamp("created_at",    { withTimezone: true }).notNull().defaultNow(),
  updatedAt:     timestamp("updated_at",    { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  slugIdx: index("api_integrations_slug_idx").on(t.slug),
}));

export const apiIntegrationLogsTable = pgTable("api_integration_logs", {
  id:        serial("id").primaryKey(),
  slug:      text("slug").notNull(),
  action:    text("action").notNull(),   // "test" | "use"
  ok:        boolean("ok").notNull(),
  message:   text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  slugIdx:      index("api_integration_logs_slug_idx").on(t.slug),
  createdAtIdx: index("api_integration_logs_created_idx").on(t.createdAt),
}));

export type ApiIntegration    = typeof apiIntegrationsTable.$inferSelect;
export type ApiIntegrationLog = typeof apiIntegrationLogsTable.$inferSelect;
