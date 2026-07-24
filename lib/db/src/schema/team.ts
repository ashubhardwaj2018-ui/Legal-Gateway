import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";

export const teamMembersTable = pgTable("team_members", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").unique(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  department: text("department").notNull(),
  designation: text("designation").notNull(),
  role: text("role").notNull().default("staff"),
  roleId: integer("role_id"),
  permissions: text("permissions").default("view"),
  reportingManagerId: integer("reporting_manager_id"),
  username: text("username").unique(),
  passwordHash: text("password_hash"),
  forcePasswordChange: boolean("force_password_change").default(false),
  salary: text("salary"),
  joiningDate: text("joining_date"),
  status: text("status").notNull().default("active"),
  address: text("address"),
  emergencyContact: text("emergency_contact"),
  avatar: text("avatar"),
  notes: text("notes"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const attendanceTable = pgTable("attendance", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  date: text("date").notNull(),
  checkIn: text("check_in"),
  checkOut: text("check_out"),
  status: text("status").notNull().default("present"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const leaveRequestsTable = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  memberId: integer("member_id").notNull(),
  type: text("type").notNull().default("casual"),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  days: integer("days").notNull().default(1),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  approvedBy: text("approved_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type TeamMember = typeof teamMembersTable.$inferSelect;
export type Attendance = typeof attendanceTable.$inferSelect;
export type LeaveRequest = typeof leaveRequestsTable.$inferSelect;
