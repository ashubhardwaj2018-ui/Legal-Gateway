import { Router } from "express";
import { db } from "@workspace/db";
import { pageContentTable, siteSettingsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const publicPagesRouter = Router();

// Public-safe keys that the website may display (no credentials/tokens)
const PUBLIC_SETTING_KEYS = [
  "site_name", "site_tagline",
  "phone_primary", "phone_secondary",
  "email_primary", "email_secondary",
  "address",
  "hours_weekdays", "hours_saturday", "hours_sunday",
  "gst_number",
  "linkedin_url", "twitter_url", "facebook_url", "instagram_url",
  // WhatsApp (display number for footer/contact)
  "company_whatsapp",
  // Branding
  "logo_url", "website_whatsapp", "support_email", "footer_text", "copyright_text",
  // Firm details for PDFs
  "firm_name", "firm_tagline", "firm_address", "firm_phone", "firm_email",
  "firm_gstin", "firm_pan",
  "bank_name", "bank_account_no", "bank_ifsc", "bank_upi",
];

const DEFAULT_PUBLIC: Record<string, string> = {
  site_name:       "Legal Filing India Legal Associates",
  site_tagline:    "India's Premium Legal Network",
  phone_primary:   "1800-123-4567",
  phone_secondary: "+91 22 6789 0123",
  email_primary:   "consult@legalfilingindia.com",
  email_secondary: "info@legalfilingindia.com",
  address:         "Level 7, Capital Building, BKC, Bandra East, Mumbai - 400051",
  hours_weekdays:  "9:00 AM – 7:00 PM",
  hours_saturday:  "10:00 AM – 4:00 PM",
  hours_sunday:    "Closed",
  gst_number:      "27AABCV1234F1Z5",
  footer_text:     "Premium legal services made accessible. We combine decades of expertise with modern technology to deliver exceptional legal solutions across India.",
  // Firm details for PDFs
  firm_name:       "Legal Filing India",
  firm_tagline:    "Advocates & Legal Consultants",
  firm_address:    "123, Legal Complex, Connaught Place, New Delhi — 110001",
  firm_phone:      "+91 98765 43210",
  firm_email:      "info@legalfilingindia.com",
  firm_gstin:      "07AABCV1234P1Z5",
  firm_pan:        "AABCV1234P",
  bank_name:       "HDFC Bank, New Delhi",
  bank_account_no: "12345678901234",
  bank_ifsc:       "HDFC0001234",
  bank_upi:        "legalfilingindia@hdfcbank",
};

// GET /api/settings — public endpoint; returns only safe display fields
publicPagesRouter.get("/settings", async (_req, res): Promise<void> => {
  try {
    const stored = await db.select().from(siteSettingsTable);
    const storedMap = new Map(stored.map(s => [s.key, s.value]));
    const result: Record<string, string> = {};
    for (const key of PUBLIC_SETTING_KEYS) {
      result[key] = storedMap.get(key) ?? DEFAULT_PUBLIC[key] ?? "";
    }
    res.json(result);
  } catch {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

// GET /api/pages/:page — public endpoint to fetch page content
publicPagesRouter.get("/pages/:page", async (req, res): Promise<void> => {
  const { page } = req.params as { page: string };
  try {
    const blocks = await db.select().from(pageContentTable).where(eq(pageContentTable.page, page));
    const content: Record<string, string> = {};
    for (const block of blocks) {
      content[block.blockId] = block.content;
    }
    res.json(content);
  } catch {
    res.status(500).json({ error: "Failed to fetch page content" });
  }
});

export default publicPagesRouter;
