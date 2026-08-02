import { Link } from "wouter";
import { Scale, Mail, Phone, MapPin, ArrowRight, MessageCircle } from "lucide-react";
import { CATEGORIES } from "@/data/services";
import { useState } from "react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export function Footer() {
  const settings = useSiteSettings();
  const [email, setEmail] = useState("");
  const [subStatus, setSubStatus] = useState<"idle" | "loading" | "done">("idle");

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubStatus("loading");
    try {
      await fetch("/api/newsletter", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    } catch { /* ignore */ }
    setSubStatus("done");
    setEmail("");
  };

  const waNumber = (settings.website_whatsapp || settings.company_whatsapp || "").replace(/[^0-9]/g, "");
  const waLink = waNumber ? `https://wa.me/${waNumber}` : null;

  const contactEmail = settings.support_email || settings.email_primary;
  const copyrightYear = new Date().getFullYear();
  const copyrightLine = settings.copyright_text
    || `© ${copyrightYear} ${settings.site_name}. All rights reserved.`;

  const socials = [
    { key: "linkedin", href: settings.linkedin_url, label: "LinkedIn", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg> },
    { key: "twitter", href: settings.twitter_url,   label: "Twitter/X", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg> },
    { key: "facebook", href: settings.facebook_url, label: "Facebook",  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg> },
    { key: "instagram", href: settings.instagram_url, label: "Instagram", icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/></svg> },
  ].filter(s => s.href && s.href !== "#");

  return (
    <footer className="bg-primary text-primary-foreground pt-20 pb-10 border-t border-primary-foreground/10">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 mb-16">

          {/* Brand */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              {settings.logo_url ? (
                <img
                  src={settings.logo_url}
                  alt={settings.site_name}
                  className="h-10 max-w-[160px] object-contain"
                />
              ) : (
                <>
                  <div className="bg-secondary text-primary p-2 rounded-lg">
                    <Scale size={24} />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-serif font-bold text-xl leading-none text-white">VAKIL & CO.</span>
                    <span className="text-[10px] uppercase tracking-widest text-secondary font-semibold">Legal Associates</span>
                  </div>
                </>
              )}
            </div>

            <p className="text-primary-foreground/70 text-sm leading-relaxed">
              {settings.footer_text}
            </p>

            {/* Social icons */}
            {socials.length > 0 && (
              <div className="flex gap-3 flex-wrap">
                {socials.map(s => (
                  <a
                    key={s.key}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-secondary hover:text-primary transition-all"
                  >
                    <span className="sr-only">{s.label}</span>
                    {s.icon}
                  </a>
                ))}
                {waLink && (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-[#25D366] hover:text-white transition-all"
                  >
                    <span className="sr-only">WhatsApp</span>
                    <MessageCircle size={18} />
                  </a>
                )}
              </div>
            )}

            {/* Fallback social icons when none configured */}
            {socials.length === 0 && !waLink && (
              <div className="flex gap-3">
                <a href="#" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-secondary hover:text-primary transition-all">
                  <span className="sr-only">LinkedIn</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
                </a>
                <a href="#" className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center hover:bg-secondary hover:text-primary transition-all">
                  <span className="sr-only">Twitter</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
                </a>
              </div>
            )}
          </div>

          {/* Practice Areas */}
          <div className="md:col-span-2 lg:col-span-1">
            <h3 className="font-serif font-semibold text-lg text-white mb-6">Practice Areas</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {CATEGORIES.map(category => (
                <Link
                  key={category.id}
                  href={`/services/${category.id}`}
                  className="text-primary-foreground/70 hover:text-secondary hover:translate-x-0.5 inline-flex transition-all text-sm truncate"
                >
                  {category.title}
                </Link>
              ))}
            </div>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-serif font-semibold text-lg text-white mb-6">Company</h3>
            <ul className="flex flex-col gap-3">
              <li><Link href="/about" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">About Us</Link></li>
              <li><Link href="/our-lawyers" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">Our Lawyers</Link></li>
              <li><Link href="/careers" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">Careers</Link></li>
              <li><Link href="/blog" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">Legal Blog</Link></li>
              <li><Link href="/indian-companies" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">Indian Companies DB</Link></li>
              <li><Link href="/privacy-policy" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">Privacy Policy</Link></li>
              <li><Link href="/terms-of-use" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">Terms of Use</Link></li>
              <li><Link href="/sitemap" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">Sitemap</Link></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-serif font-semibold text-lg text-white mb-6">Contact Us</h3>
            <ul className="flex flex-col gap-4">
              {settings.address && (
                <li className="flex items-start gap-3 text-primary-foreground/70 text-sm">
                  <MapPin size={18} className="text-secondary shrink-0 mt-0.5" />
                  <span>{settings.address}</span>
                </li>
              )}
              {settings.phone_primary && (
                <li className="flex items-center gap-3 text-primary-foreground/70 text-sm">
                  <Phone size={18} className="text-secondary shrink-0" />
                  <a href={`tel:${settings.phone_primary}`} className="hover:text-secondary transition-colors">
                    {settings.phone_primary}
                  </a>
                </li>
              )}
              {contactEmail && (
                <li className="flex items-center gap-3 text-primary-foreground/70 text-sm">
                  <Mail size={18} className="text-secondary shrink-0" />
                  <a href={`mailto:${contactEmail}`} className="hover:text-secondary transition-colors">
                    {contactEmail}
                  </a>
                </li>
              )}
              {waLink && (
                <li className="flex items-center gap-3 text-primary-foreground/70 text-sm">
                  <MessageCircle size={18} className="text-[#25D366] shrink-0" />
                  <a href={waLink} target="_blank" rel="noopener noreferrer" className="hover:text-secondary transition-colors">
                    WhatsApp Us
                  </a>
                </li>
              )}
            </ul>

            <div className="mt-6">
              <h4 className="text-sm font-medium text-white mb-3">Subscribe to Newsletter</h4>
              {subStatus === "done" ? (
                <p className="text-secondary text-sm font-medium">✓ Subscribed! Thank you.</p>
              ) : (
                <form onSubmit={handleSubscribe} className="flex">
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="bg-white/10 border border-white/20 rounded-l-md px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-secondary w-full"
                  />
                  <button type="submit" disabled={subStatus === "loading"} className="bg-secondary text-primary px-3 py-2 rounded-r-md hover:bg-secondary/90 transition-colors">
                    <ArrowRight size={18} />
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-primary-foreground/50 text-xs">
            {copyrightLine}
          </p>
          <div className="flex items-center gap-4">
            <Link href="/privacy-policy" className="text-primary-foreground/40 hover:text-primary-foreground/70 text-xs transition-colors">Privacy Policy</Link>
            <Link href="/terms-of-use" className="text-primary-foreground/40 hover:text-primary-foreground/70 text-xs transition-colors">Terms of Use</Link>
          </div>
          <p className="text-primary-foreground/50 text-xs text-center md:text-right">
            The information provided on this website does not constitute legal advice. <br className="hidden md:block" /> Use of this site does not create an attorney-client relationship.
          </p>
        </div>
      </div>
    </footer>
  );
}
