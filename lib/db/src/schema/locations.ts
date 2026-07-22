import {
  pgTable, text, serial, timestamp, boolean, real, integer, index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const locationsTable = pgTable(
  "locations",
  {
    id: serial("id").primaryKey(),
    country: text("country").notNull().default("India"),
    state: text("state").notNull(),
    district: text("district"),
    city: text("city"),
    town: text("town"),
    village: text("village"),
    pincode: text("pincode"),
    latitude: real("latitude"),
    longitude: real("longitude"),
    slug: text("slug").notNull().unique(),
    parentLocation: text("parent_location"),
    population: integer("population"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  },
  (table) => ({
    slugIdx: index("locations_slug_idx").on(table.slug),
    stateIdx: index("locations_state_idx").on(table.state),
    districtIdx: index("locations_district_idx").on(table.district),
    cityIdx: index("locations_city_idx").on(table.city),
  }),
);

export const serviceLocationsTable = pgTable("service_locations", {
  id: serial("id").primaryKey(),
  serviceId: text("service_id").notNull(),
  locationId: integer("location_id")
    .notNull()
    .references(() => locationsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const locationUploadLogsTable = pgTable("location_upload_logs", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  totalRows: integer("total_rows").notNull().default(0),
  inserted: integer("inserted").notNull().default(0),
  updated: integer("updated").notNull().default(0),
  duplicates: integer("duplicates").notNull().default(0),
  errors: integer("errors").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLocationSchema = createInsertSchema(locationsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locationsTable.$inferSelect;
export type LocationUploadLog = typeof locationUploadLogsTable.$inferSelect;
