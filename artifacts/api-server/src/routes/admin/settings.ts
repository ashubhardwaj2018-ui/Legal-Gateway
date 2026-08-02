import { Router, type IRouter } from "express";
import { db, siteSettingsTable } from "@workspace/db";
import { UpdateSettingsBody } from "@workspace/api-zod";

const DEFAULT_SETTINGS = [
  { key: "site_name", value: "Vakil & Co. Legal Associates" },
  { key: "site_tagline", value: "India's Premium Legal Network" },
  { key: "phone_primary", value: "1800-123-4567" },
  { key: "phone_secondary", value: "+91 22 6789 0123" },
  { key: "email_primary", value: "consult@vakilco.in" },
  { key: "email_secondary", value: "info@vakilco.in" },
  { key: "address", value: "Level 7, Capital Building, BKC, Bandra East, Mumbai - 400051" },
  { key: "hours_weekdays", value: "9:00 AM – 7:00 PM" },
  { key: "hours_saturday", value: "10:00 AM – 4:00 PM" },
  { key: "hours_sunday", value: "Closed" },
  { key: "gst_number", value: "27AABCV1234F1Z5" },
  { key: "linkedin_url", value: "#" },
  { key: "twitter_url", value: "#" },
  { key: "facebook_url", value: "#" },
  { key: "instagram_url", value: "#" },
  // WhatsApp
  { key: "company_whatsapp",             value: "" },
  { key: "whatsapp_country_code",        value: "+91" },
  { key: "whatsapp_business_name",       value: "" },
  { key: "whatsapp_provider",            value: "web" },
  { key: "whatsapp_fallback_web",        value: "false" },
  { key: "whatsapp_api_key",             value: "" },
  { key: "whatsapp_phone_number_id",     value: "" },
  { key: "whatsapp_business_account_id", value: "" },
  { key: "whatsapp_verify_token",        value: "" },
  { key: "whatsapp_account_sid",         value: "" },
  { key: "whatsapp_from_number",         value: "" },
  { key: "whatsapp_app_name",            value: "" },
  { key: "whatsapp_sender_id",           value: "" },
  // Website & Branding
  { key: "logo_url",        value: "" },
  { key: "website_whatsapp",value: "" },
  { key: "support_email",   value: "" },
  { key: "footer_text",     value: "Premium legal services made accessible. We combine decades of expertise with modern technology to deliver exceptional legal solutions across India." },
  { key: "copyright_text",  value: "" },
];

const router: IRouter = Router();

router.get("/admin/settings", async (_req, res): Promise<void> => {
  const stored = await db.select().from(siteSettingsTable);
  const storedMap = new Map(stored.map(s => [s.key, s]));

  const merged = DEFAULT_SETTINGS.map(def => {
    const existing = storedMap.get(def.key);
    return existing ?? { key: def.key, value: def.value, updatedAt: new Date().toISOString() };
  });

  const extraKeys = stored.filter(s => !DEFAULT_SETTINGS.find(d => d.key === s.key));
  res.json([...merged, ...extraKeys]);
});

router.put("/admin/settings", async (req, res): Promise<void> => {
  const parsed = UpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  for (const setting of parsed.data.settings) {
    await db
      .insert(siteSettingsTable)
      .values({ key: setting.key, value: setting.value })
      .onConflictDoUpdate({
        target: siteSettingsTable.key,
        set: { value: setting.value, updatedAt: new Date() },
      });
  }

  const stored = await db.select().from(siteSettingsTable);
  res.json(stored);
});

export default router;
