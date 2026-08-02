import { useQuery } from "@tanstack/react-query";

export interface SiteSettings {
  site_name: string;
  site_tagline: string;
  phone_primary: string;
  phone_secondary: string;
  email_primary: string;
  email_secondary: string;
  address: string;
  hours_weekdays: string;
  hours_saturday: string;
  hours_sunday: string;
  gst_number: string;
  linkedin_url: string;
  twitter_url: string;
  facebook_url: string;
  instagram_url: string;
  // WhatsApp
  company_whatsapp: string;
  // Branding
  logo_url: string;
  website_whatsapp: string;
  support_email: string;
  footer_text: string;
  copyright_text: string;
}

const DEFAULTS: SiteSettings = {
  site_name:        "Vakil & Co. Legal Associates",
  site_tagline:     "India's Premium Legal Network",
  phone_primary:    "1800-123-4567",
  phone_secondary:  "+91 22 6789 0123",
  email_primary:    "consult@vakilco.in",
  email_secondary:  "info@vakilco.in",
  address:          "Level 7, Capital Building, BKC, Bandra East, Mumbai - 400051",
  hours_weekdays:   "9:00 AM – 7:00 PM",
  hours_saturday:   "10:00 AM – 4:00 PM",
  hours_sunday:     "Closed",
  gst_number:       "27AABCV1234F1Z5",
  linkedin_url:     "#",
  twitter_url:      "#",
  facebook_url:     "#",
  instagram_url:    "#",
  company_whatsapp: "",
  logo_url:         "",
  website_whatsapp: "",
  support_email:    "",
  footer_text:      "Premium legal services made accessible. We combine decades of expertise with modern technology to deliver exceptional legal solutions across India.",
  copyright_text:   "",
};

export const SITE_SETTINGS_QUERY_KEY = ["site-settings-public"] as const;

export function useSiteSettings() {
  const { data } = useQuery<SiteSettings>({
    queryKey: SITE_SETTINGS_QUERY_KEY,
    queryFn: async () => {
      const r = await fetch("/api/settings");
      if (!r.ok) return DEFAULTS;
      return r.json();
    },
    staleTime: 30 * 1000, // 30 s — changes reflect quickly
  });
  return data ?? DEFAULTS;
}
