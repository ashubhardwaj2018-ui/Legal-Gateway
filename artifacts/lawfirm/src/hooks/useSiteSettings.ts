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
}

const DEFAULTS: SiteSettings = {
  site_name:       "Vakil & Co. Legal Associates",
  site_tagline:    "India's Premium Legal Network",
  phone_primary:   "1800-123-4567",
  phone_secondary: "+91 22 6789 0123",
  email_primary:   "consult@vakilco.in",
  email_secondary: "info@vakilco.in",
  address:         "Level 7, Capital Building, BKC, Bandra East, Mumbai - 400051",
  hours_weekdays:  "9:00 AM – 7:00 PM",
  hours_saturday:  "10:00 AM – 4:00 PM",
  hours_sunday:    "Closed",
  gst_number:      "27AABCV1234F1Z5",
  linkedin_url:    "#",
  twitter_url:     "#",
  facebook_url:    "#",
  instagram_url:   "#",
};

export function useSiteSettings() {
  const { data } = useQuery<SiteSettings>({
    queryKey: ["site-settings-public"],
    queryFn: async () => {
      const r = await fetch("/api/settings");
      if (!r.ok) return DEFAULTS;
      return r.json();
    },
    staleTime: 5 * 60 * 1000, // cache 5 min — changes rarely
  });
  return data ?? DEFAULTS;
}
