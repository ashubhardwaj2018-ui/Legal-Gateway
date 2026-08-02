import { pgTable, serial, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const auditLogsTable = pgTable("audit_logs", {
  id:           serial("id").primaryKey(),
  tableName:    text("table_name").notNull(),
  rowId:        text("row_id"),               // stringified PK; null for bulk/import
  action:       text("action").notNull(),     // create | update | delete | restore | import | bulk_delete | bulk_edit
  changedData:  jsonb("changed_data"),        // { before, after } for update; { rows } for import
  actorUsername:text("actor_username").notNull().default("system"),
  ipAddress:    text("ip_address"),
  createdAt:    timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  tableIdx:  index("audit_logs_table_idx").on(t.tableName),
  actorIdx:  index("audit_logs_actor_idx").on(t.actorUsername),
  createdIdx:index("audit_logs_created_idx").on(t.createdAt),
  rowIdx:    index("audit_logs_row_idx").on(t.tableName, t.rowId),
}));

export type AuditLog = typeof auditLogsTable.$inferSelect;
export type InsertAuditLog = typeof auditLogsTable.$inferInsert;
