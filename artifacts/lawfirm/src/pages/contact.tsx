import { Helmet } from "react-helmet-async";
import { ContactSection } from "@/components/ContactSection";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export default function Contact() {
  const settings = useSiteSettings();
  return (
    <>
      <Helmet>
        <title>Contact Us – {settings.site_name}</title>
        <meta name="description" content={`Reach ${settings.site_name} at ${settings.phone_primary}. Our office is open ${settings.hours_weekdays} on weekdays. Speak to an expert lawyer today.`} />
      </Helmet>
      <ContactSection />
    </>
  );
}
