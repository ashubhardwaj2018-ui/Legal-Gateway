import { pgTable, text, serial, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const indianCompaniesTable = pgTable("indian_companies", {
  id: serial("id").primaryKey(),
  cin: text("cin").unique().notNull(),
  companyName: text("company_name").notNull(),
  slug: text("slug").unique().notNull(),
  incorporationDate: text("incorporation_date"),
  companyStatus: text("company_status"),
  companyType: text("company_type"),
  authorizedCapital: text("authorized_capital"),
  paidUpCapital: text("paid_up_capital"),
  registeredOffice: text("registered_office"),
  state: text("state"),
  district: text("district"),
  city: text("city"),
  pincode: text("pincode"),
  industry: text("industry"),
  roc: text("roc"),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  cinIdx: index("ic_cin_idx").on(t.cin),
  slugIdx: index("ic_slug_idx").on(t.slug),
  stateIdx: index("ic_state_idx").on(t.state),
  statusIdx: index("ic_status_idx").on(t.companyStatus),
  typeIdx: index("ic_type_idx").on(t.companyType),
}));

export const insertIndianCompanySchema = createInsertSchema(indianCompaniesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertIndianCompany = z.infer<typeof insertIndianCompanySchema>;
export type IndianCompany = typeof indianCompaniesTable.$inferSelect;
