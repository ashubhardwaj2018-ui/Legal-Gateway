import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const companyDataTable = pgTable("company_data", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull(),
  cin: text("cin"),
  category: text("category"),
  state: text("state"),
  dateOfIncorporation: text("date_of_incorporation"),
  authorizedCapital: text("authorized_capital"),
  paidUpCapital: text("paid_up_capital"),
  email: text("email"),
  registeredAddress: text("registered_address"),
  companyStatus: text("company_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCompanyDataSchema = createInsertSchema(companyDataTable).omit({ id: true, createdAt: true });
export type InsertCompanyData = z.infer<typeof insertCompanyDataSchema>;
export type CompanyData = typeof companyDataTable.$inferSelect;
