import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  priority: text("priority").notNull().default("medium"),
  status: text("status").notNull().default("todo"),
  assignedToId: integer("assigned_to_id"),
  assignedToName: text("assigned_to_name"),
  dueDate: text("due_date"),
  tags: text("tags"),
  leadId: integer("lead_id"),
  estimatedHours: text("estimated_hours"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  statusIdx: index("tasks_status_idx").on(t.status),
  priorityIdx: index("tasks_priority_idx").on(t.priority),
  assigneeIdx: index("tasks_assignee_idx").on(t.assignedToId),
  dueDateIdx: index("tasks_due_date_idx").on(t.dueDate),
}));

export const taskCommentsTable = pgTable("task_comments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").notNull(),
  authorName: text("author_name").notNull(),
  comment: text("comment").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Task = typeof tasksTable.$inferSelect;
export type TaskComment = typeof taskCommentsTable.$inferSelect;
