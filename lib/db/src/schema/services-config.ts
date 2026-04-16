import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const servicesConfigTable = pgTable("services_config", {
  id: serial("id").primaryKey(),
  categoryId: text("category_id").notNull(),
  serviceName: text("service_name").notNull(),
  displayName: text("display_name"),
  description: text("description"),
  basePrice: integer("base_price"),
  priceDisplay: text("price_display"),
  duration: text("duration"),
  isPopular: boolean("is_popular").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertServiceConfigSchema = createInsertSchema(servicesConfigTable).omit({ id: true, updatedAt: true });
export type InsertServiceConfig = z.infer<typeof insertServiceConfigSchema>;
export type ServiceConfig = typeof servicesConfigTable.$inferSelect;
