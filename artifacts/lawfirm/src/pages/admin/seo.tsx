








































































































































































































import { useState, useEffect, useMemo } from "react";
import { useListSeoSettings, useUpsertSeoSetting, getListSeoSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Save, Globe, Eye, EyeOff, Link2, FileCode2, Map, Tag,
  Plus, Trash2, ExternalLink, RefreshCw, Search,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Tab types ───────────────────────────────────────────────────────────────
type SeoTab = "meta" | "linking" | "sitemap" | "robots";

const SEO_TABS: Array<{ key: SeoTab; label: string; icon: React.ElementType }> = [
  { key: "meta",     label: "Meta Tags",          icon: Tag },
  { key: "linking",  label: "Internal Linking",   icon: Link2 },
  { key: "sitemap",  label: "Sitemap",             icon: Map },
  { key: "robots",   label: "Robots.txt",          icon: FileCode2 },
];

// ── Meta Tags tab ────────────────────────────────────────────────────────────
type PageGroup = "static" | "category" | "service";
interface PageDef { id: string; label: string; icon: string; group: PageGroup; }

const ALL_PAGES: PageDef[] = [
  // ── Static Pages ──────────────────────────────────────────────────────────
  { id: "home",           label: "Home",            icon: "🏠", group: "static" },
  { id: "about",          label: "About Us",        icon: "ℹ️",  group: "static" },
  { id: "contact",        label: "Contact",         icon: "📞", group: "static" },
  { id: "services",       label: "Services Hub",    icon: "⚙️",  group: "static" },
  { id: "lawyers",        label: "Find a Lawyer",   icon: "👨‍⚖️", group: "static" },
  { id: "blog",           label: "Blog",            icon: "📝", group: "static" },
  { id: "companies",      label: "Company Search",  icon: "🏭", group: "static" },
  { id: "sitemap-html",   label: "HTML Sitemap",    icon: "🗺️",  group: "static" },

  // ── Service Categories ────────────────────────────────────────────────────
  { id: "cat/consult-expert",      label: "Consult an Expert",    icon: "💬", group: "category" },
  { id: "cat/business-setup",      label: "Business Setup",       icon: "🏢", group: "category" },
  { id: "cat/tax-compliance",      label: "Tax & Compliance",     icon: "🧾", group: "category" },
  { id: "cat/trademark-ip",        label: "Trademark & IP",       icon: "®️",  group: "category" },
  { id: "cat/documentation",       label: "Documentation",        icon: "📄", group: "category" },
  { id: "cat/fundraising",         label: "Fundraising",          icon: "💰", group: "category" },
  { id: "cat/ngo",                 label: "NGO & Society",        icon: "🤝", group: "category" },
  { id: "cat/property-personal",   label: "Property & Personal",  icon: "🏡", group: "category" },
  { id: "cat/lawyers",             label: "Lawyers",              icon: "⚖️",  group: "category" },

  // ── Consult Expert ────────────────────────────────────────────────────────
  { id: "svc/consult-expert/talk-to-a-lawyer",            label: "Talk to a Lawyer",        icon: "💬", group: "service" },
  { id: "svc/consult-expert/talk-to-a-ca",               label: "Talk to a CA",            icon: "💬", group: "service" },
  { id: "svc/consult-expert/talk-to-a-cs",               label: "Talk to a CS",            icon: "💬", group: "service" },
  { id: "svc/consult-expert/talk-to-an-ip-trademark-lawyer", label: "Talk to IP/TM Lawyer", icon: "💬", group: "service" },

  // ── Business Setup ────────────────────────────────────────────────────────
  { id: "svc/business-setup/private-limited-company",     label: "Private Limited Company",   icon: "🏢", group: "service" },
  { id: "svc/business-setup/limited-liability-partnership", label: "Limited Liability Partnership", icon: "🏢", group: "service" },
  { id: "svc/business-setup/one-person-company",          label: "One Person Company",        icon: "🏢", group: "service" },
  { id: "svc/business-setup/sole-proprietorship",         label: "Sole Proprietorship",       icon: "🏢", group: "service" },
  { id: "svc/business-setup/nidhi-company",               label: "Nidhi Company",             icon: "🏦", group: "service" },
  { id: "svc/business-setup/producer-company",            label: "Producer Company",          icon: "🌾", group: "service" },
  { id: "svc/business-setup/partnership-firm",            label: "Partnership Firm",          icon: "🤝", group: "service" },
  { id: "svc/business-setup/startup-india-registration",  label: "Startup India Registration", icon: "🚀", group: "service" },
  { id: "svc/business-setup/us-incorporation",            label: "US Incorporation",          icon: "🇺🇸", group: "service" },
  { id: "svc/business-setup/singapore-incorporation",     label: "Singapore Incorporation",   icon: "🇸🇬", group: "service" },
  { id: "svc/business-setup/uk-incorporation",            label: "UK Incorporation",          icon: "🇬🇧", group: "service" },
  { id: "svc/business-setup/netherlands-incorporation",   label: "Netherlands Incorporation", icon: "🇳🇱", group: "service" },
  { id: "svc/business-setup/hong-kong-incorporation",     label: "Hong Kong Incorporation",   icon: "🇭🇰", group: "service" },
  { id: "svc/business-setup/dubai-incorporation",         label: "Dubai Incorporation",       icon: "🇦🇪", group: "service" },
  { id: "svc/business-setup/company-name-search",         label: "Company Name Search",       icon: "🔍", group: "service" },
  { id: "svc/business-setup/business-name-generator",     label: "Business Name Generator",   icon: "✨", group: "service" },
  { id: "svc/business-setup/digital-signature-certificate", label: "Digital Signature Certificate", icon: "🔏", group: "service" },
  { id: "svc/business-setup/msme-ssi-registration",       label: "MSME/SSI Registration",    icon: "🏭", group: "service" },
  { id: "svc/business-setup/iso-certification",           label: "ISO Certification",         icon: "📋", group: "service" },
  { id: "svc/business-setup/fssai-registration",          label: "FSSAI Registration",        icon: "🍽️",  group: "service" },
  { id: "svc/business-setup/iec-import-export-code",      label: "IEC Import/Export Code",    icon: "🚢", group: "service" },
  { id: "svc/business-setup/legal-metrology",             label: "Legal Metrology",           icon: "⚖️",  group: "service" },
  { id: "svc/business-setup/hallmark-registration",       label: "Hallmark Registration",     icon: "💎", group: "service" },
  { id: "svc/business-setup/bis-registration",            label: "BIS Registration",          icon: "📋", group: "service" },
  { id: "svc/business-setup/web-ecommerce-development",   label: "Web/E-Commerce Development", icon: "🌐", group: "service" },

  // ── Tax & Compliance ──────────────────────────────────────────────────────
  { id: "svc/tax-compliance/gst-registration",            label: "GST Registration",           icon: "🧾", group: "service" },
  { id: "svc/tax-compliance/gst-filing",                  label: "GST Filing",                 icon: "🧾", group: "service" },
  { id: "svc/tax-compliance/gst-advisory",                label: "GST Advisory",               icon: "🧾", group: "service" },
  { id: "svc/tax-compliance/indirect-tax",                label: "Indirect Tax",               icon: "🧾", group: "service" },
  { id: "svc/tax-compliance/rodtep",                      label: "RoDTEP",                     icon: "🏭", group: "service" },
  { id: "svc/tax-compliance/add-a-director",              label: "Add a Director",             icon: "👤", group: "service" },
  { id: "svc/tax-compliance/remove-a-director",           label: "Remove a Director",          icon: "👤", group: "service" },
  { id: "svc/tax-compliance/increase-authorized-capital", label: "Increase Authorized Capital", icon: "💰", group: "service" },
  { id: "svc/tax-compliance/close-pvt-ltd-company",       label: "Close Pvt Ltd Company",      icon: "🔒", group: "service" },
  { id: "svc/tax-compliance/change-objective-activity",   label: "Change Objective/Activity",  icon: "📝", group: "service" },
  { id: "svc/tax-compliance/change-address",              label: "Change Address",             icon: "📍", group: "service" },
  { id: "svc/tax-compliance/change-company-name",         label: "Change Company Name",        icon: "✏️",  group: "service" },
  { id: "svc/tax-compliance/add-designated-partner",      label: "Add Designated Partner",     icon: "👤", group: "service" },
  { id: "svc/tax-compliance/changes-to-llp-agreement",    label: "Changes to LLP Agreement",   icon: "📄", group: "service" },
  { id: "svc/tax-compliance/close-the-llp",               label: "Close the LLP",              icon: "🔒", group: "service" },
  { id: "svc/tax-compliance/pvt-ltd-opc-compliance",      label: "Pvt Ltd / OPC Compliance",   icon: "✅", group: "service" },
  { id: "svc/tax-compliance/llp-compliance",              label: "LLP Compliance",             icon: "✅", group: "service" },
  { id: "svc/tax-compliance/pf-registration",             label: "Provident Fund Registration", icon: "🏦", group: "service" },
  { id: "svc/tax-compliance/esi-registration",            label: "ESI Registration",           icon: "🏥", group: "service" },
  { id: "svc/tax-compliance/professional-tax-registration", label: "Professional Tax Registration", icon: "🧾", group: "service" },
  { id: "svc/tax-compliance/shops-establishments-license", label: "Shops & Establishments License", icon: "🏪", group: "service" },
  { id: "svc/tax-compliance/esop",                        label: "Employee Stock Option Plan", icon: "📈", group: "service" },
  { id: "svc/tax-compliance/posh-compliance",             label: "POSH Compliance",            icon: "⚖️",  group: "service" },
  { id: "svc/tax-compliance/accounting-book-keeping",     label: "Accounting & Book-keeping",  icon: "📚", group: "service" },
  { id: "svc/tax-compliance/payroll-maintenance",         label: "Payroll Maintenance",        icon: "💳", group: "service" },
  { id: "svc/tax-compliance/tds-return-filing",           label: "TDS Return Filing",          icon: "🧾", group: "service" },
  { id: "svc/tax-compliance/individual-income-tax-filing", label: "Individual Income Tax Filing", icon: "🧾", group: "service" },
  { id: "svc/tax-compliance/proprietorship-tax-return",   label: "Proprietorship Tax Return",  icon: "🧾", group: "service" },
  { id: "svc/tax-compliance/income-tax-notice",           label: "Income Tax Notice",          icon: "⚠️",  group: "service" },
  { id: "svc/tax-compliance/proprietorship-to-pvt-ltd",   label: "Proprietorship to Pvt Ltd",  icon: "🔄", group: "service" },
  { id: "svc/tax-compliance/secretarial-audit",           label: "Secretarial Audit",          icon: "🔍", group: "service" },
  { id: "svc/tax-compliance/due-diligence",               label: "Due Diligence",              icon: "🔍", group: "service" },
  { id: "svc/tax-compliance/partnership-to-llp",          label: "Partnership to LLP",         icon: "🔄", group: "service" },
  { id: "svc/tax-compliance/private-to-public",           label: "Private to Public Limited",  icon: "🔄", group: "service" },
  { id: "svc/tax-compliance/private-to-opc",              label: "Private to OPC",             icon: "🔄", group: "service" },
  { id: "svc/tax-compliance/rbi-compliance",              label: "RBI Compliance",             icon: "🏦", group: "service" },

  // ── Trademark & IP ────────────────────────────────────────────────────────
  { id: "svc/trademark-ip/trademark-registration",        label: "Trademark Registration",     icon: "®️",  group: "service" },
  { id: "svc/trademark-ip/search-for-trademark",          label: "Trademark Search",           icon: "🔍", group: "service" },
  { id: "svc/trademark-ip/respond-to-tm-objection",       label: "TM Objection Reply",         icon: "📝", group: "service" },
  { id: "svc/trademark-ip/well-known-trademark",          label: "Well Known Trademark",       icon: "⭐", group: "service" },
  { id: "svc/trademark-ip/trademark-watch",               label: "Trademark Watch",            icon: "👁️",  group: "service" },
  { id: "svc/trademark-ip/trademark-renewal",             label: "Trademark Renewal",          icon: "🔄", group: "service" },
  { id: "svc/trademark-ip/trademark-assignment",          label: "Trademark Assignment",       icon: "📝", group: "service" },
  { id: "svc/trademark-ip/usa-trademark",                 label: "USA Trademark",              icon: "🇺🇸", group: "service" },
  { id: "svc/trademark-ip/international-trademark",       label: "International Trademark",    icon: "🌍", group: "service" },
  { id: "svc/trademark-ip/logo-design",                   label: "Logo Design",                icon: "🎨", group: "service" },
  { id: "svc/trademark-ip/copyright-registration",        label: "Copyright Registration",     icon: "©️",  group: "service" },
  { id: "svc/trademark-ip/indian-patent-search",          label: "Indian Patent Search",       icon: "🔍", group: "service" },
  { id: "svc/trademark-ip/provisional-application",       label: "Provisional Patent",         icon: "📋", group: "service" },
  { id: "svc/trademark-ip/permanent-patent",              label: "Permanent Patent",           icon: "📋", group: "service" },
  { id: "svc/trademark-ip/copyright-infringement",        label: "Copyright Infringement",     icon: "⚠️",  group: "service" },
  { id: "svc/trademark-ip/patent-infringement",           label: "Patent Infringement",        icon: "⚠️",  group: "service" },
  { id: "svc/trademark-ip/trademark-infringement",        label: "Trademark Infringement",     icon: "⚠️",  group: "service" },
  { id: "svc/trademark-ip/design-registration",           label: "Design Registration",        icon: "🎨", group: "service" },

  // ── Documentation ─────────────────────────────────────────────────────────
  { id: "svc/documentation/nda",                          label: "Non Disclosure Agreement",   icon: "📄", group: "service" },
  { id: "svc/documentation/sla",                          label: "Service Level Agreement",    icon: "📄", group: "service" },
  { id: "svc/documentation/franchise-agreement",          label: "Franchise Agreement",        icon: "📄", group: "service" },
  { id: "svc/documentation/master-service-agreement",     label: "Master Service Agreement",   icon: "📄", group: "service" },
  { id: "svc/documentation/shareholders-agreement",       label: "Shareholders Agreement",     icon: "📄", group: "service" },
  { id: "svc/documentation/joint-venture-agreement",      label: "Joint Venture Agreement",    icon: "📄", group: "service" },
  { id: "svc/documentation/founders-agreement",           label: "Founders Agreement",         icon: "📄", group: "service" },
  { id: "svc/documentation/vendor-agreement",             label: "Vendor Agreement",           icon: "📄", group: "service" },
  { id: "svc/documentation/consultancy-agreement",        label: "Consultancy Agreement",      icon: "📄", group: "service" },
  { id: "svc/documentation/mou",                          label: "Memorandum of Understanding", icon: "📄", group: "service" },
  { id: "svc/documentation/make-a-will",                  label: "Make a Will",                icon: "📜", group: "service" },
  { id: "svc/documentation/power-of-attorney",            label: "Power of Attorney",          icon: "📜", group: "service" },
  { id: "svc/documentation/terms-of-service",             label: "Terms of Service",           icon: "📄", group: "service" },
  { id: "svc/documentation/gdpr",                         label: "GDPR Compliance",            icon: "🔒", group: "service" },
  { id: "svc/documentation/disclaimer",                   label: "Disclaimer",                 icon: "📄", group: "service" },
  { id: "svc/documentation/scope-of-work",                label: "Scope of Work Agreement",    icon: "📄", group: "service" },
  { id: "svc/documentation/rental-agreement",             label: "Rental Agreement",           icon: "🏠", group: "service" },
  { id: "svc/documentation/sale-deed",                    label: "Sale Deed",                  icon: "🏠", group: "service" },
  { id: "svc/documentation/legal-notice",                 label: "Legal Notice",               icon: "⚠️",  group: "service" },
  { id: "svc/documentation/legal-notice-recovery",        label: "Legal Notice for Recovery",  icon: "⚠️",  group: "service" },
  { id: "svc/documentation/cheque-bounce-notice",         label: "Cheque Bounce Notice",       icon: "⚠️",  group: "service" },
  { id: "svc/documentation/employment-agreement",         label: "Employment Agreement",       icon: "📄", group: "service" },

  // ── Fundraising ───────────────────────────────────────────────────────────
  { id: "svc/fundraising/fundraising",                    label: "Fundraising",                icon: "💰", group: "service" },
  { id: "svc/fundraising/pitch-deck",                     label: "Pitch Deck",                 icon: "📊", group: "service" },

  // ── NGO ───────────────────────────────────────────────────────────────────
  { id: "svc/ngo/ngo",                                    label: "NGO Registration",           icon: "🤝", group: "service" },
  { id: "svc/ngo/section-8-company",                      label: "Section 8 Company",          icon: "🏛️",  group: "service" },
  { id: "svc/ngo/trust-registration",                     label: "Trust Registration",         icon: "🏛️",  group: "service" },
  { id: "svc/ngo/society-registration",                   label: "Society Registration",       icon: "🏛️",  group: "service" },
  { id: "svc/ngo/ngo-compliance",                         label: "NGO Compliance",             icon: "✅", group: "service" },
  { id: "svc/ngo/section-8-compliance",                   label: "Section 8 Compliance",       icon: "✅", group: "service" },
  { id: "svc/ngo/csr-1-filing",                           label: "CSR-1 Filing",               icon: "📋", group: "service" },
  { id: "svc/ngo/80g-12a",                                label: "Sec.80G & Sec.12A",          icon: "📋", group: "service" },
  { id: "svc/ngo/darpan-registration",                    label: "Darpan Registration",        icon: "📋", group: "service" },

  // ── Property & Personal ───────────────────────────────────────────────────
  { id: "svc/property-personal/property-title-verification", label: "Property Title Verification", icon: "🏡", group: "service" },
  { id: "svc/property-personal/property-registration",    label: "Property Registration",      icon: "🏡", group: "service" },
  { id: "svc/property-personal/name-change",              label: "Name Change",                icon: "✏️",  group: "service" },
  { id: "svc/property-personal/religion-change",          label: "Religion Change",            icon: "✏️",  group: "service" },
  { id: "svc/property-personal/gender-change",            label: "Gender Change",              icon: "✏️",  group: "service" },
  { id: "svc/property-personal/online-police-complaint",  label: "Online Police Complaint",    icon: "🚔", group: "service" },
  { id: "svc/property-personal/marriage-registration",    label: "Marriage Registration",      icon: "💒", group: "service" },
  { id: "svc/property-personal/court-marriage",           label: "Court Marriage",             icon: "💒", group: "service" },
  { id: "svc/property-personal/corporate-immigration",    label: "Corporate Immigration",      icon: "✈️",  group: "service" },
  { id: "svc/property-personal/family-immigration",       label: "Family Immigration",         icon: "✈️",  group: "service" },
  { id: "svc/property-personal/college-immigration",      label: "College Immigration",        icon: "🎓", group: "service" },
  { id: "svc/property-personal/online-consumer-complaint", label: "Online Consumer Complaint", icon: "📢", group: "service" },
  { id: "svc/property-personal/ecommerce-consumer-complaint", label: "E-Commerce Consumer Complaint", icon: "📢", group: "service" },
  { id: "svc/property-personal/insurance-consumer-complaint", label: "Insurance Consumer Complaint", icon: "📢", group: "service" },
  { id: "svc/property-personal/consumer-protection-act",  label: "Consumer Protection Act",    icon: "⚖️",  group: "service" },

  // ── Lawyers ───────────────────────────────────────────────────────────────
  { id: "svc/lawyers/criminal-lawyer",                    label: "Criminal Lawyer",            icon: "⚖️",  group: "service" },
  { id: "svc/lawyers/labour-lawyer",                      label: "Labour Lawyer",              icon: "⚖️",  group: "service" },
  { id: "svc/lawyers/consumer-court-lawyer",              label: "Consumer Court Lawyer",      icon: "⚖️",  group: "service" },
  { id: "svc/lawyers/divorce-lawyer",                     label: "Divorce Lawyer",             icon: "⚖️",  group: "service" },
  { id: "svc/lawyers/banking-lawyer",                     label: "Banking Lawyer",             icon: "⚖️",  group: "service" },
  { id: "svc/lawyers/immigration-lawyer",                 label: "Immigration Lawyer",         icon: "✈️",  group: "service" },
  { id: "svc/lawyers/family-lawyer",                      label: "Family Lawyer",              icon: "⚖️",  group: "service" },
  { id: "svc/lawyers/litigation-lawyer",                  label: "Litigation Lawyer",          icon: "⚖️",  group: "service" },
  { id: "svc/lawyers/ip-lawyer",                          label: "IP Lawyer",                  icon: "⚖️",  group: "service" },
  { id: "svc/lawyers/trademark-lawyer",                   label: "Trademark Lawyer",           icon: "⚖️",  group: "service" },
  { id: "svc/lawyers/tmt",                                label: "Technology, Media & Telecom", icon: "📡", group: "service" },
  { id: "svc/lawyers/risk-management",                    label: "Risk & Regulatory",          icon: "⚖️",  group: "service" },
];

const ROBOTS_OPTIONS = ["index, follow", "noindex, follow", "index, nofollow", "noindex, nofollow"];

const DEFAULT_SEO: Record<string, { title: string; description: string; keywords: string; robots: string }> = {
  // ── Static Pages ──────────────────────────────────────────────────────────
  home: { title: "Legal Filing India – Trusted Online Legal Services", description: "India's leading platform for company registration, trademark, GST, tax filing, NGO setup & expert lawyer consultation. 50,000+ clients served.", keywords: "law firm india, online legal services, company registration india, trademark registration, legal help india", robots: "index, follow" },
  about: { title: "About Legal Filing India – Our Mission & Legal Experts", description: "Learn about Legal Filing India — our experienced team of lawyers, CAs, and CSs dedicated to making quality legal services accessible to every Indian business.", keywords: "about legal filing india, legal services team, online legal consultants india", robots: "index, follow" },
  contact: { title: "Contact Legal Filing India – Talk to Our Legal Team", description: "Get in touch for company registration, trademark, GST, and all legal services. Call, WhatsApp, or email our expert team. Free callback available.", keywords: "contact legal filing india, legal helpline india, consult lawyer india, legal advice call", robots: "index, follow" },
  services: { title: "All Legal Services in India | Legal Filing India", description: "Explore 130+ legal services — company registration, GST filing, trademark, NGO setup, property law, immigration, and expert lawyer consultation.", keywords: "legal services india, all legal services online, online legal help india, best legal platform india", robots: "index, follow" },
  lawyers: { title: "Find Expert Lawyers in India | Legal Filing India", description: "Connect with India's top lawyers for criminal, family, corporate, IP, immigration, and labour law cases. Book instant online consultation.", keywords: "find lawyer india, hire lawyer online, top advocates india, legal consultation online", robots: "index, follow" },
  blog: { title: "Legal Knowledge Hub – Law, Tax & Compliance Articles", description: "Expert articles on Indian company law, GST updates, trademark tips, startup compliance, and more. Stay legally informed with Legal Filing India.", keywords: "legal blog india, company law news, gst updates india, trademark tips, startup compliance blog", robots: "index, follow" },
  companies: { title: "India Company Search – MCA CIN & Director Lookup", description: "Search 1M+ Indian companies by name, CIN, or director. Access MCA registration details, compliance status, and corporate information instantly.", keywords: "india company search, cin lookup, mca company search, indian company directory, company information india", robots: "index, follow" },
  "sitemap-html": { title: "Site Map – Legal Filing India", description: "Complete directory of all pages on Legal Filing India — services, lawyers, blog posts, and company search.", keywords: "sitemap legal filing india", robots: "index, follow" },

  // ── Categories ────────────────────────────────────────────────────────────
  "cat/consult-expert": { title: "Online Legal Consultation – Lawyer, CA, CS | India", description: "Instant telephonic or video consultation with qualified advocates, CAs, and Company Secretaries. Expert advice within 30 minutes from ₹999.", keywords: "online lawyer consultation, talk to ca online, legal advice india, consult cs online, expert legal advice", robots: "index, follow" },
  "cat/business-setup": { title: "Business Registration in India – Company, LLP, OPC", description: "Register your business in India — Private Limited, LLP, OPC, Partnership, Sole Proprietorship. Expert CA/CS support, all-inclusive pricing.", keywords: "business registration india, company registration india, start business india, pvt ltd registration, llp registration", robots: "index, follow" },
  "cat/tax-compliance": { title: "GST, Tax Filing & Company Compliance Services India", description: "GST registration, ITR filing, payroll, TDS, ROC compliance, director changes — complete corporate tax and compliance services in India.", keywords: "gst registration india, income tax filing, company compliance india, tds filing, roc compliance", robots: "index, follow" },
  "cat/trademark-ip": { title: "Trademark Registration & IP Protection in India", description: "Register your trademark, copyright, and patent in India. Protect your brand with expert IP services — search, filing, objection reply & monitoring.", keywords: "trademark registration india, ip protection, copyright registration, patent filing india, brand registration", robots: "index, follow" },
  "cat/documentation": { title: "Legal Documents & Agreement Drafting Online India", description: "Professionally drafted NDAs, shareholder agreements, employment contracts, rental deeds, legal notices, and 20+ other legal documents from ₹999.", keywords: "legal document drafting india, online agreement drafting, nda india, legal notice india, contract drafting", robots: "index, follow" },
  "cat/fundraising": { title: "Startup Fundraising & Pitch Deck Services India", description: "Raise funding for your startup with expert fundraising advisory and investor-ready pitch deck creation. Trusted by 500+ Indian startups.", keywords: "startup fundraising india, pitch deck india, investor pitch, startup funding advisory, series a india", robots: "index, follow" },
  "cat/ngo": { title: "NGO Registration – Trust, Society, Section 8 Company", description: "Register your NGO, Trust, Society, or Section 8 Company in India. Get 80G & 12A tax exemptions and CSR eligibility with expert legal support.", keywords: "ngo registration india, trust registration, society registration, section 8 company, ngo 80g 12a", robots: "index, follow" },
  "cat/property-personal": { title: "Property Law & Personal Legal Services in India", description: "Property registration, title verification, name change, marriage registration, consumer complaints, and immigration services across India.", keywords: "property registration india, name change india, marriage registration, consumer complaint india, property law", robots: "index, follow" },
  "cat/lawyers": { title: "Top Lawyers in India – Criminal, Family, Corporate Law", description: "Find verified lawyers across India for criminal defence, family disputes, corporate law, IP, labour, banking, and immigration matters.", keywords: "top lawyers india, criminal lawyer, family lawyer india, corporate lawyer india, hire advocate", robots: "index, follow" },

  // ── Consult Expert ────────────────────────────────────────────────────────
  "svc/consult-expert/talk-to-a-lawyer": { title: "Talk to a Lawyer Online in India | ₹999", description: "Get instant telephonic or video legal advice from a qualified advocate for ₹999. Discuss any legal issue — criminal, civil, corporate, or family.", keywords: "talk to lawyer online india, legal advice online, consult advocate india, lawyer consultation", robots: "index, follow" },
  "svc/consult-expert/talk-to-a-ca": { title: "Talk to a CA Online – Tax & Finance Advice | ₹999", description: "Consult a Chartered Accountant online for GST, ITR, tax planning, and compliance queries. Expert CA advice within 30 minutes from ₹999.", keywords: "consult ca online india, talk to chartered accountant, tax advice india, ca consultation online", robots: "index, follow" },
  "svc/consult-expert/talk-to-a-cs": { title: "Talk to a Company Secretary Online | ₹999", description: "Expert Company Secretary consultation for MCA filings, ROC compliance, and corporate law. Get instant advice on any secretarial matter.", keywords: "consult company secretary online, cs consultation india, roc compliance advice, company secretary india", robots: "index, follow" },
  "svc/consult-expert/talk-to-an-ip-trademark-lawyer": { title: "Talk to IP/Trademark Lawyer Online | ₹999", description: "Consult a specialist IP and trademark advocate for brand protection, infringement cases, and patent queries. Online consultation from ₹999.", keywords: "ip lawyer consultation, trademark lawyer india, patent lawyer, ip advice online, ip attorney india", robots: "index, follow" },

  // ── Business Setup ────────────────────────────────────────────────────────
  "svc/business-setup/private-limited-company": { title: "Private Limited Company Registration India | ₹6,999", description: "Register a Private Limited Company online in India. Expert CA/CS support, DSC, DIN, MOA, AOA, and Certificate of Incorporation. 7–10 working days.", keywords: "private limited company registration india, pvt ltd company registration, company incorporation india, register company online", robots: "index, follow" },
  "svc/business-setup/limited-liability-partnership": { title: "LLP Registration Online in India | ₹5,999", description: "Register a Limited Liability Partnership in India. Includes LLP agreement drafting, DIN, DSC, and MCA filing. Expert support, 7–10 working days.", keywords: "llp registration india, limited liability partnership registration, llp incorporation, register llp india", robots: "index, follow" },
  "svc/business-setup/one-person-company": { title: "One Person Company Registration India | ₹6,499", description: "Register an OPC — perfect for solo entrepreneurs seeking limited liability. Includes MOA, AOA, DSC, DIN, and Certificate of Incorporation.", keywords: "one person company registration india, opc registration, single owner company india, opc incorporation", robots: "index, follow" },
  "svc/business-setup/sole-proprietorship": { title: "Sole Proprietorship Registration India | ₹1,999", description: "Quick and simple sole proprietorship registration in India. Ideal for freelancers and small businesses. Includes GST and bank account guidance.", keywords: "sole proprietorship registration india, proprietorship firm registration, small business registration india", robots: "index, follow" },
  "svc/business-setup/nidhi-company": { title: "Nidhi Company Registration in India | ₹24,999", description: "Register a Nidhi Company — a mutual benefit society for members' savings and lending. Includes RBI compliance and all MCA filings.", keywords: "nidhi company registration india, nidhi company formation, mutual benefit company india, nidhi company rbi", robots: "index, follow" },
  "svc/business-setup/producer-company": { title: "Producer Company Registration India | ₹19,999", description: "Set up a Producer Company for farmers and agricultural cooperatives in India. Full MCA compliance, legal drafting, and registration support.", keywords: "producer company registration india, farmer cooperative company, agricultural company india, fpo registration", robots: "index, follow" },
  "svc/business-setup/partnership-firm": { title: "Partnership Firm Registration India | ₹2,999", description: "Register a Partnership Firm with a legally binding Partnership Deed. Ideal for traditional businesses and professionals across India.", keywords: "partnership firm registration india, partnership deed registration, register partnership india, general partnership", robots: "index, follow" },
  "svc/business-setup/startup-india-registration": { title: "Startup India DPIIT Registration | ₹3,999", description: "Get DPIIT recognition under the Startup India scheme for tax benefits, fast-track IP filing, and access to government funding schemes.", keywords: "startup india registration, dpiit recognition, startup india scheme, startup tax benefit india, dpiit certificate", robots: "index, follow" },
  "svc/business-setup/us-incorporation": { title: "US Company Registration – Delaware C-Corp & LLC", description: "Incorporate a US company (Delaware C-Corp or LLC) from India. Ideal for startups raising US venture capital or serving American markets.", keywords: "us company registration from india, delaware c-corp, us llc registration, us incorporation india, american company setup", robots: "index, follow" },
  "svc/business-setup/singapore-incorporation": { title: "Singapore Company Registration from India | $499", description: "Set up a Singapore Private Limited Company — low taxes, world-class banking, and Asia market access for Indian entrepreneurs.", keywords: "singapore company registration india, singapore incorporation, singapore pvt ltd, singapore business setup india", robots: "index, follow" },
  "svc/business-setup/uk-incorporation": { title: "UK Company Registration from India | £299", description: "Register a UK Limited Company from India. Ideal for accessing UK and EU markets with a credible British business presence.", keywords: "uk company registration india, register uk company, uk limited company from india, british company india", robots: "index, follow" },
  "svc/business-setup/netherlands-incorporation": { title: "Netherlands BV Company Registration | Legal Filing", description: "Set up a Netherlands BV (private limited company). Gateway to the European Union market with full expert legal support from India.", keywords: "netherlands company registration, bv company india, netherlands incorporation, europe company setup india", robots: "index, follow" },
  "svc/business-setup/hong-kong-incorporation": { title: "Hong Kong Company Registration | Legal Filing India", description: "Register a Private Limited Company in Hong Kong. Low-tax jurisdiction, Asia financial hub, easy banking for Indian businesses going global.", keywords: "hong kong company registration india, hong kong incorporation, hk company from india, hong kong business", robots: "index, follow" },
  "svc/business-setup/dubai-incorporation": { title: "Dubai Company Registration – Mainland & Free Zone UAE", description: "Register a company in Dubai UAE — Mainland, Free Zone, or Offshore. Expert support for Indian entrepreneurs expanding to the Middle East.", keywords: "dubai company registration india, uae company setup, dubai free zone company, mainland company dubai, uae business india", robots: "index, follow" },
  "svc/business-setup/company-name-search": { title: "Company Name Availability Search India | ₹299", description: "Check if your proposed company or LLP name is available on MCA before filing. Instant search with expert guidance on naming rules.", keywords: "company name search india, mca name availability, company name check india, business name search mca", robots: "index, follow" },
  "svc/business-setup/business-name-generator": { title: "AI Business Name Generator – Free | Legal Filing India", description: "Generate unique and brandable business names instantly using AI. Check domain and trademark availability together. 100% free tool.", keywords: "business name generator india, company name ideas, brand name generator, startup name ideas, unique company name", robots: "index, follow" },
  "svc/business-setup/digital-signature-certificate": { title: "Digital Signature Certificate (DSC) India | ₹1,299", description: "Get Class 2 or Class 3 DSC for MCA, income tax, and tender filings. Quick processing, Aadhaar-based verification, doorstep delivery.", keywords: "digital signature certificate india, dsc registration, class 3 dsc, e-filing dsc india, dsc online india", robots: "index, follow" },
  "svc/business-setup/msme-ssi-registration": { title: "MSME Udyam Registration Online India | ₹1,499", description: "Register your micro, small, or medium enterprise under Udyam (formerly MSME/SSI). Access government benefits, credit schemes, and priority tenders.", keywords: "msme registration india, udyam registration, ssi registration, msme certificate india, udyam portal", robots: "index, follow" },
  "svc/business-setup/iso-certification": { title: "ISO Certification India – 9001, 14001, 27001 | ₹9,999", description: "Get ISO 9001 (quality), ISO 14001 (environment), or ISO 27001 (security) certification. Expert consultants guide your complete audit process.", keywords: "iso certification india, iso 9001 india, iso 14001, iso 27001 certification india, quality certification", robots: "index, follow" },
  "svc/business-setup/fssai-registration": { title: "FSSAI Food License Registration Online | ₹3,999", description: "Apply for FSSAI basic, state, or central food license online. Mandatory for food businesses, restaurants, and cloud kitchens across India.", keywords: "fssai registration india, food license india, fssai license online, food safety registration, fssai certificate", robots: "index, follow" },
  "svc/business-setup/iec-import-export-code": { title: "IEC Import Export Code Registration India | ₹3,499", description: "Get your Import Export Code (IEC) from DGFT to start importing or exporting goods and services from India. Fast online processing.", keywords: "iec registration india, import export code, dgft iec, import export license india, iec certificate", robots: "index, follow" },
  "svc/business-setup/legal-metrology": { title: "Legal Metrology Registration India | ₹4,999", description: "Obtain Legal Metrology registration for packaged goods, weights, and measures compliance under the Legal Metrology Act in India.", keywords: "legal metrology registration india, weights measures license, packaged commodity rules, legal metrology act", robots: "index, follow" },
  "svc/business-setup/hallmark-registration": { title: "BIS Hallmark Registration for Jewellery India | ₹3,999", description: "Get BIS hallmarking certification for gold and silver jewellery. Mandatory for all jewellers in India as per BIS hallmarking guidelines.", keywords: "bis hallmark registration, jewellery hallmark india, gold hallmarking india, bis certification jewellery", robots: "index, follow" },
  "svc/business-setup/bis-registration": { title: "BIS ISI Mark Registration for Products India | ₹3,999", description: "Get Bureau of Indian Standards (BIS) ISI mark certification. Mandatory for electronics, cement, food, and other regulated goods in India.", keywords: "bis registration india, isi mark registration, bis certification, product certification india, bis mark india", robots: "index, follow" },
  "svc/business-setup/web-ecommerce-development": { title: "E-Commerce Website Development India | Legal Filing", description: "Professional e-commerce and business website development for Indian businesses. Complete setup including domain, hosting, and payment gateway.", keywords: "ecommerce website development india, business website india, online store development, web development india", robots: "index, follow" },

  // ── Tax & Compliance ──────────────────────────────────────────────────────
  "svc/tax-compliance/gst-registration": { title: "GST Registration Online in India | ₹1,499", description: "Register for GST online in India. Expert CA support, Aadhaar verification, document preparation, and GSTIN in 3–7 working days.", keywords: "gst registration india, online gst registration, gstin number, gst number apply india, gst certificate", robots: "index, follow" },
  "svc/tax-compliance/gst-filing": { title: "GST Return Filing Online India | ₹999/month", description: "Monthly and quarterly GST return filing (GSTR-1, GSTR-3B, GSTR-9) by expert CAs. Timely filing, zero late fees, full compliance.", keywords: "gst return filing india, gstr 1 filing, gstr 3b filing, monthly gst return india, gst compliance", robots: "index, follow" },
  "svc/tax-compliance/gst-advisory": { title: "GST Consulting & Advisory Services India", description: "Expert GST advisory for input tax credit, place of supply, reverse charge, e-invoicing, and audit compliance for Indian businesses.", keywords: "gst advisory india, gst consultant, gst compliance advice, gst audit support, gst itc india", robots: "index, follow" },
  "svc/tax-compliance/indirect-tax": { title: "Indirect Tax Compliance Services India", description: "Comprehensive indirect tax services — customs duty, excise, and GST. Expert support for manufacturing and trading companies across India.", keywords: "indirect tax india, customs duty compliance, excise duty, indirect tax advisory, indirect tax consultant india", robots: "index, follow" },
  "svc/tax-compliance/rodtep": { title: "RoDTEP Scheme Registration & Compliance India", description: "Claim Remission of Duties and Taxes on Exported Products (RoDTEP) — duty remission on exports with expert legal and tax support.", keywords: "rodtep scheme india, export duty remission, rodtep registration, export incentive india, dgft rodtep", robots: "index, follow" },
  "svc/tax-compliance/add-a-director": { title: "Add a Director to Company in India | ₹2,999", description: "Add a new director to your Private Limited Company or OPC. Includes DIN application, DIR-12 MCA filing, and board resolution drafting.", keywords: "add director company india, director appointment, din registration, dir-12 filing, appoint director india", robots: "index, follow" },
  "svc/tax-compliance/remove-a-director": { title: "Remove a Director from Company India | ₹2,999", description: "Legally remove or resign a director from your company. Includes MCA DIR-12 filing, board resolution, and full ROC compliance.", keywords: "remove director india, director resignation, dir-12 filing, director removal mca, director removal india", robots: "index, follow" },
  "svc/tax-compliance/increase-authorized-capital": { title: "Increase Authorized Capital India | ₹3,999", description: "Increase your company's authorized share capital. Includes SH-7 MCA filing, board resolution, EGM notice, and MGT-14 compliance.", keywords: "increase authorized capital india, sh-7 filing, share capital increase mca, authorized capital amendment", robots: "index, follow" },
  "svc/tax-compliance/close-pvt-ltd-company": { title: "Close / Strike Off Pvt Ltd Company India | ₹7,999", description: "Close your Private Limited Company via STK-2 fast track or voluntary winding up. Expert support to clear liabilities and complete MCA filing.", keywords: "close company india, strike off company, winding up india, company closure mca, stk-2 filing india", robots: "index, follow" },
  "svc/tax-compliance/change-objective-activity": { title: "Change Company Objective / Activity India | ₹3,999", description: "Amend your company's main object clause (MOA) with MCA approval. Includes EGM notice, board resolution, and MGT-14 filing.", keywords: "change company object india, moa amendment, change business activity mca, company objective change", robots: "index, follow" },
  "svc/tax-compliance/change-address": { title: "Change Registered Office Address India | ₹2,999", description: "Change your company's registered address within the same state or to a new state. Includes INC-22 / INC-23 MCA filing and board resolution.", keywords: "change registered office india, company address change mca, inc-22 filing, registered office change", robots: "index, follow" },
  "svc/tax-compliance/change-company-name": { title: "Change Company Name in India | ₹3,999", description: "Change your Private Limited, OPC, or LLP name. Includes name availability check, EGM, MNC-1, and INC-24 MCA filing.", keywords: "change company name india, company name change mca, inc-24 filing, name amendment company india", robots: "index, follow" },
  "svc/tax-compliance/add-designated-partner": { title: "Add Designated Partner in LLP India | ₹2,499", description: "Add a new Designated Partner to your LLP. Includes DIN, consent form, supplementary LLP agreement, and Form 4 MCA filing.", keywords: "add designated partner llp india, llp partner addition, form 4 llp filing, llp designated partner", robots: "index, follow" },
  "svc/tax-compliance/changes-to-llp-agreement": { title: "LLP Agreement Amendment in India | ₹2,999", description: "Amend your LLP Agreement for profit sharing, partner rights, or other changes. Includes supplementary deed and Form 3 MCA filing.", keywords: "llp agreement amendment india, llp deed change, form 3 llp filing, llp modification india", robots: "index, follow" },
  "svc/tax-compliance/close-the-llp": { title: "Close / Wind Up LLP in India | ₹5,999", description: "Strike off or wind up your LLP — includes Form 24 application, NOC from creditors, indemnity bond, and complete ROC filing.", keywords: "close llp india, llp strike off, wind up llp, form 24 llp closure, llp winding up india", robots: "index, follow" },
  "svc/tax-compliance/pvt-ltd-opc-compliance": { title: "Annual ROC Compliance – Pvt Ltd / OPC | ₹5,999", description: "Complete annual ROC compliance for Private Limited and OPC — AOC-4 (financials), MGT-7 (annual return), DIR-3 KYC, and statutory audit.", keywords: "pvt ltd compliance india, annual roc filing, aoc-4 filing, mgt-7 annual return, opc compliance", robots: "index, follow" },
  "svc/tax-compliance/llp-compliance": { title: "Annual LLP Compliance – Form 8 & 11 | ₹3,999", description: "Complete annual LLP compliance — Form 8 (statement of accounts), Form 11 (annual return), and income tax return filing by expert CAs.", keywords: "llp annual compliance india, llp form 8, llp form 11, llp annual return, llp compliance india", robots: "index, follow" },
  "svc/tax-compliance/pf-registration": { title: "Provident Fund (EPF) Registration India | ₹3,499", description: "Register your company for Employees' Provident Fund (EPF) compliance. Mandatory for businesses with 20+ employees across India.", keywords: "pf registration india, epf registration, provident fund employer registration, epfo compliance india", robots: "index, follow" },
  "svc/tax-compliance/esi-registration": { title: "ESI Registration for Employers India | ₹2,999", description: "Register for Employees' State Insurance (ESI) — mandatory for businesses with 10+ employees. Expert CA support for full ESIC compliance.", keywords: "esi registration india, esic employer registration, employees state insurance, esic compliance india", robots: "index, follow" },
  "svc/tax-compliance/professional-tax-registration": { title: "Professional Tax Registration India | ₹1,999", description: "Register for Professional Tax (PT) as an employer. Mandatory in Maharashtra, Karnataka, West Bengal, and other states. Includes PT return filing.", keywords: "professional tax registration india, pt registration, employer professional tax, professional tax india", robots: "index, follow" },
  "svc/tax-compliance/shops-establishments-license": { title: "Shops & Establishments License India | ₹2,499", description: "Get Shops & Establishments Act registration for your office, shop, or establishment. State-wise expert support across all Indian states.", keywords: "shops establishments license india, gumasta license, shop registration india, business license india", robots: "index, follow" },
  "svc/tax-compliance/esop": { title: "ESOP Scheme Setup for Indian Companies | ₹9,999", description: "Design and implement an Employee Stock Option Plan (ESOP) — scheme drafting, SEBI compliance, valuation, and MCA filing for Indian companies.", keywords: "esop india, employee stock option plan, esop scheme india, startup esop, esop legal india", robots: "index, follow" },
  "svc/tax-compliance/posh-compliance": { title: "POSH Act Compliance for Companies India | ₹7,999", description: "Ensure POSH compliance — Internal Complaints Committee formation, policy drafting, employee training, and annual report preparation.", keywords: "posh compliance india, posh act, icc formation, sexual harassment policy india, posh training", robots: "index, follow" },
  "svc/tax-compliance/accounting-book-keeping": { title: "Accounting & Bookkeeping Services India | ₹3,999", description: "Monthly accounting, bookkeeping, and financial statement preparation by expert CAs. Tally, QuickBooks, Zoho — all accounting software supported.", keywords: "accounting services india, bookkeeping india, ca accounting service, monthly accounting india, bookkeeper india", robots: "index, follow" },
  "svc/tax-compliance/payroll-maintenance": { title: "Payroll Processing Services India | ₹3,999/month", description: "End-to-end payroll processing — salary slips, PF, ESI, PT, TDS deductions, and Form 16 for all your employees. Accurate and on time.", keywords: "payroll services india, payroll processing, salary processing india, hr payroll india, payroll outsourcing", robots: "index, follow" },
  "svc/tax-compliance/tds-return-filing": { title: "TDS Return Filing – 24Q, 26Q, 27Q India | ₹2,999", description: "Quarterly TDS return filing (24Q, 26Q, 27Q, 27EQ) by expert CAs. Avoid penalties with timely, accurate e-TDS return submission.", keywords: "tds return filing india, quarterly tds filing, 26q filing, 24q tds return, tds compliance india", robots: "index, follow" },
  "svc/tax-compliance/individual-income-tax-filing": { title: "Income Tax Return (ITR) Filing India | ₹1,499", description: "File your ITR-1 to ITR-7 online with expert CA support. For salaried, business income, capital gains, and HUF — accurate and timely.", keywords: "income tax return filing india, itr filing india, itr 1 filing, online itr filing, ca itr india", robots: "index, follow" },
  "svc/tax-compliance/proprietorship-tax-return": { title: "Proprietorship Income Tax Return India | ₹2,999", description: "Expert CA-assisted income tax return filing for sole proprietors and self-employed individuals in India. ITR-3 and ITR-4 filing.", keywords: "proprietorship tax return india, sole proprietor itr filing, self employed tax return, itr 4 proprietor", robots: "index, follow" },
  "svc/tax-compliance/income-tax-notice": { title: "Income Tax Notice Response India | ₹4,999", description: "Expert legal and CA support to respond to income tax department notices — scrutiny, demand, defective return, and 143(1) intimations.", keywords: "income tax notice india, it notice response, tax notice reply, income tax demand notice, scrutiny notice india", robots: "index, follow" },
  "svc/tax-compliance/proprietorship-to-pvt-ltd": { title: "Convert Proprietorship to Pvt Ltd India | ₹11,999", description: "Convert your sole proprietorship into a Private Limited Company with expert legal support for slump sale, asset transfer, and MCA registration.", keywords: "proprietorship to pvt ltd conversion india, convert sole proprietorship company, business conversion india", robots: "index, follow" },
  "svc/tax-compliance/secretarial-audit": { title: "Secretarial Audit & Compliance Check India | ₹14,999", description: "Identify and fix compliance gaps with a comprehensive secretarial audit covering MCA, SEBI, RBI, and labour law compliance for companies.", keywords: "secretarial audit india, company compliance audit, mca compliance check, cs audit, corporate compliance india", robots: "index, follow" },
  "svc/tax-compliance/due-diligence": { title: "Legal & Financial Due Diligence Services India", description: "Expert legal and financial due diligence for M&A transactions, investments, and business acquisitions. Comprehensive risk assessment reports.", keywords: "due diligence india, legal due diligence, m&a due diligence, investment due diligence, acquisition due diligence", robots: "index, follow" },
  "svc/tax-compliance/partnership-to-llp": { title: "Convert Partnership Firm to LLP India | ₹9,999", description: "Convert your Partnership Firm to a Limited Liability Partnership. Expert legal support for consent, tax NOC, and MCA Form 17 filing.", keywords: "partnership to llp conversion india, convert partnership firm llp, form 17 mca, llp conversion india", robots: "index, follow" },
  "svc/tax-compliance/private-to-public": { title: "Convert Pvt Ltd to Public Limited Company India", description: "Convert your Private Limited Company to a Public Limited Company. Includes EGM, MOA/AOA amendment, and SEBI/RBI compliance if applicable.", keywords: "private to public limited company india, pvt to public ltd, company conversion india, public company india", robots: "index, follow" },
  "svc/tax-compliance/private-to-opc": { title: "Convert Private Limited to OPC India | ₹7,999", description: "Convert your Private Limited Company to a One Person Company when you're the sole shareholder. Includes INC-6 MCA filing and compliance.", keywords: "pvt ltd to opc conversion, private to one person company india, inc-6 filing, opc conversion india", robots: "index, follow" },
  "svc/tax-compliance/rbi-compliance": { title: "RBI Compliance – FEMA, FDI, ECB Services India", description: "Expert support for RBI and FEMA compliance — FDI reporting, External Commercial Borrowings, ODI, LRS, and FCGPR filings for Indian companies.", keywords: "rbi compliance india, fema compliance, fdi reporting, ecb compliance india, rbi reporting india", robots: "index, follow" },

  // ── Trademark & IP ────────────────────────────────────────────────────────
  "svc/trademark-ip/trademark-registration": { title: "Trademark Registration Online India | ₹1,999", description: "Register your brand name, logo, or tagline as a trademark in India. Expert search, TM-A filing, and prosecution by IP attorneys. All classes.", keywords: "trademark registration india, brand registration, tm registration india, logo trademark, register brand india", robots: "index, follow" },
  "svc/trademark-ip/search-for-trademark": { title: "Trademark Search India – All Classes | ₹499", description: "Comprehensive trademark availability search across all 45 classes in the Indian trademark registry. Avoid infringement and application rejection.", keywords: "trademark search india, trademark availability, brand name search india, tm search, trademark class search", robots: "index, follow" },
  "svc/trademark-ip/respond-to-tm-objection": { title: "Trademark Objection Reply India | ₹2,499", description: "Expert response to trademark examiner's objections — absolute grounds, relative grounds, and TM office hearings. High success rate.", keywords: "trademark objection reply india, tm objection response, trademark hearing india, trademark examination reply", robots: "index, follow" },
  "svc/trademark-ip/well-known-trademark": { title: "Well Known Trademark Status India | Legal Filing", description: "Apply for 'Well Known Trademark' recognition for famous brands in India — enhanced protection across all 45 classes by expert IP attorneys.", keywords: "well known trademark india, famous trademark protection, tm well known status, well known mark india", robots: "index, follow" },
  "svc/trademark-ip/trademark-watch": { title: "Trademark Watch & Monitoring Service | ₹3,999/yr", description: "Monitor your registered trademark for infringements, identical/similar new filings, and unauthorized use across the Indian trademark registry.", keywords: "trademark watch india, trademark monitoring, brand protection india, tm watch service, trademark surveillance", robots: "index, follow" },
  "svc/trademark-ip/trademark-renewal": { title: "Trademark Renewal in India | ₹1,499", description: "Renew your registered trademark before it expires (every 10 years). Includes TM-R application, registry follow-up, and renewal certificate.", keywords: "trademark renewal india, trademark renew, tm renewal india, trademark re-registration, tm-r form", robots: "index, follow" },
  "svc/trademark-ip/trademark-assignment": { title: "Trademark Assignment / Transfer India | ₹4,999", description: "Transfer ownership of your registered trademark to another party. Includes assignment deed drafting, TM-P application, and registry follow-up.", keywords: "trademark assignment india, trademark transfer, sell trademark india, tm-p form, trademark ownership transfer", robots: "index, follow" },
  "svc/trademark-ip/usa-trademark": { title: "USA Trademark Registration from India | $399", description: "Register your trademark in the United States with USPTO. Expert Indian IP attorneys handle the full application and office action response.", keywords: "usa trademark registration, uspto trademark filing from india, us trademark india, american trademark india", robots: "index, follow" },
  "svc/trademark-ip/international-trademark": { title: "International Trademark – Madrid Protocol India", description: "Protect your brand globally under the Madrid Protocol. Single application covers 130+ countries through WIPO. Expert Indian IP attorneys.", keywords: "international trademark registration, madrid protocol india, global trademark, wipo trademark, madrid system india", robots: "index, follow" },
  "svc/trademark-ip/logo-design": { title: "Professional Logo Design India | ₹3,499", description: "Get a unique, brand-ready logo designed by professional designers. Includes 3 concepts, unlimited revisions, and print & digital-ready files.", keywords: "logo design india, professional logo designer, brand logo india, business logo design, startup logo india", robots: "index, follow" },
  "svc/trademark-ip/copyright-registration": { title: "Copyright Registration Online India | ₹2,999", description: "Protect your original work — books, music, software, art, films, and websites — with official copyright registration in India.", keywords: "copyright registration india, register copyright, intellectual property copyright, original work protection india", robots: "index, follow" },
  "svc/trademark-ip/indian-patent-search": { title: "Indian Patent Search Service | ₹4,999", description: "Comprehensive prior art and novelty search in the Indian Patent Office database before filing your patent application. Detailed search report.", keywords: "patent search india, prior art search india, ipo patent search, novelty search india, patent prior art", robots: "index, follow" },
  "svc/trademark-ip/provisional-application": { title: "Provisional Patent Application India | ₹14,999", description: "Secure your invention's priority date with a provisional patent application. 12 months to develop the invention before complete specification filing.", keywords: "provisional patent india, patent filing india, patent application india, protect invention india, provisional patent filing", robots: "index, follow" },
  "svc/trademark-ip/permanent-patent": { title: "Complete Patent Registration in India | ₹29,999", description: "Full patent filing — complete specification, claims drafting, drawings, prosecution, and examination response by expert patent attorneys in India.", keywords: "patent registration india, complete patent filing, patent grant india, permanent patent india, patent attorney india", robots: "index, follow" },
  "svc/trademark-ip/copyright-infringement": { title: "Copyright Infringement Legal Action India", description: "Legal representation for copyright infringement cases — DMCA takedowns, civil suits, criminal complaints, and Anton Piller orders in India.", keywords: "copyright infringement india, copyright violation, dmca takedown india, ip litigation, copyright dispute india", robots: "index, follow" },
  "svc/trademark-ip/patent-infringement": { title: "Patent Infringement Legal Services India", description: "Expert legal support for patent infringement disputes — cease and desist, injunctions, and litigation before IP courts and High Courts in India.", keywords: "patent infringement india, patent litigation india, ip dispute, patent violation, patent court india", robots: "index, follow" },
  "svc/trademark-ip/trademark-infringement": { title: "Trademark Infringement Legal Action India", description: "Stop unauthorized use of your brand. Expert legal support for cease and desist notices, TM oppositions, and IP court litigation in India.", keywords: "trademark infringement india, brand protection legal action, tm violation, passing off india, brand infringement", robots: "index, follow" },
  "svc/trademark-ip/design-registration": { title: "Industrial Design Registration India | ₹6,999", description: "Protect the unique visual design of your product under the Designs Act. Expert support for design filing and prosecution at the Patent Office.", keywords: "design registration india, industrial design india, product design protection, designs act, design patent india", robots: "index, follow" },

  // ── Documentation ─────────────────────────────────────────────────────────
  "svc/documentation/nda": { title: "NDA Drafting – Non-Disclosure Agreement India | ₹999", description: "Legally binding NDA drafted by expert lawyers — mutual and one-way NDAs for employees, vendors, investors, and business partners in India.", keywords: "nda india, non disclosure agreement, confidentiality agreement india, nda drafting online, nda format india", robots: "index, follow" },
  "svc/documentation/sla": { title: "Service Level Agreement (SLA) Drafting India | ₹1,499", description: "Professional SLA drafting covering uptime, response time, penalties, and exit clauses. Suitable for IT, cloud, and service businesses in India.", keywords: "service level agreement india, sla drafting, sla format india, it services agreement, sla contract india", robots: "index, follow" },
  "svc/documentation/franchise-agreement": { title: "Franchise Agreement Drafting India | ₹3,999", description: "Expert franchise agreement drafting — franchisee rights, territory, royalties, IP licensing, and termination clauses for Indian businesses.", keywords: "franchise agreement india, franchisee contract, franchise deed india, franchise legal india, franchise document", robots: "index, follow" },
  "svc/documentation/master-service-agreement": { title: "Master Service Agreement (MSA) India | ₹2,999", description: "Professionally drafted MSA covering scope, payment, IP ownership, liability, and confidentiality for long-term service relationships in India.", keywords: "master service agreement india, msa drafting, services contract india, msa format, professional services agreement", robots: "index, follow" },
  "svc/documentation/shareholders-agreement": { title: "Shareholders Agreement Drafting India | ₹4,999", description: "Protect founder rights with a comprehensive SHA — voting rights, anti-dilution, drag-along, tag-along, and exit provisions for Indian companies.", keywords: "shareholders agreement india, sha drafting, founder agreement, shareholder rights india, sha startup india", robots: "index, follow" },
  "svc/documentation/joint-venture-agreement": { title: "Joint Venture Agreement Drafting India | ₹3,999", description: "Professionally drafted JV agreement covering contributions, governance, profit sharing, IP rights, and exit provisions for joint ventures in India.", keywords: "joint venture agreement india, jv agreement, joint venture contract india, jv legal india, joint venture india", robots: "index, follow" },
  "svc/documentation/founders-agreement": { title: "Founders Agreement Drafting India | ₹2,999", description: "Protect co-founders with a comprehensive agreement — equity splits, vesting schedule, IP assignment, roles, and departure clauses.", keywords: "founders agreement india, co-founder agreement, startup founders agreement, equity vesting, founder contract", robots: "index, follow" },
  "svc/documentation/vendor-agreement": { title: "Vendor / Supplier Agreement Drafting India | ₹1,999", description: "Professionally drafted vendor agreements covering supply terms, payment, quality standards, IP ownership, and dispute resolution.", keywords: "vendor agreement india, supplier contract india, purchase agreement drafting, vendor contract india", robots: "index, follow" },
  "svc/documentation/consultancy-agreement": { title: "Consultancy Agreement Drafting India | ₹1,499", description: "Expert drafting of consultancy contracts covering scope of work, fees, IP ownership, confidentiality, and termination for Indian consultants.", keywords: "consultancy agreement india, consultant contract, freelancer agreement india, consulting agreement india", robots: "index, follow" },
  "svc/documentation/mou": { title: "MOU Drafting – Memorandum of Understanding India", description: "Professionally drafted MOU for business partnerships, collaborations, and pre-contract arrangements. Non-binding and binding options available.", keywords: "mou drafting india, memorandum of understanding india, business mou, mou format, mou legal india", robots: "index, follow" },
  "svc/documentation/make-a-will": { title: "Will Drafting & Registration in India | ₹2,999", description: "Get your Will professionally drafted by lawyers. Covers property, assets, and nominees. Optional registration for stronger legal validity.", keywords: "will drafting india, make a will online india, will registration india, last will testament, legal will india", robots: "index, follow" },
  "svc/documentation/power-of-attorney": { title: "Power of Attorney Drafting India | ₹1,999", description: "Expert drafting of General, Special, or Property POA. Notarized and apostilled if required. Valid for NRIs and Indian residents.", keywords: "power of attorney india, poa drafting, general poa india, nri power of attorney, special poa india", robots: "index, follow" },
  "svc/documentation/terms-of-service": { title: "Terms of Service Drafting India | ₹1,499", description: "Expert drafting of Terms of Service for websites, apps, and e-commerce platforms. Compliant with India's IT Act and consumer protection rules.", keywords: "terms of service india, website terms conditions, app tos india, it act compliance, terms conditions drafting", robots: "index, follow" },
  "svc/documentation/gdpr": { title: "GDPR Compliance for Indian Businesses | ₹4,999", description: "GDPR compliance advisory and documentation for Indian companies handling EU customer data — privacy policy, DPA, and data mapping.", keywords: "gdpr compliance india, gdpr for indian companies, privacy policy gdpr, data protection india, eu gdpr india", robots: "index, follow" },
  "svc/documentation/disclaimer": { title: "Disclaimer Drafting for Websites India | ₹999", description: "Legally worded disclaimer for websites, apps, blogs, and financial advisors to limit liability and protect against legal claims in India.", keywords: "disclaimer drafting india, website disclaimer, liability disclaimer india, legal disclaimer, blog disclaimer india", robots: "index, follow" },
  "svc/documentation/scope-of-work": { title: "Scope of Work Agreement Drafting India | ₹1,499", description: "Professionally drafted Scope of Work and Deliverables Agreement for projects, freelancers, and agencies in India. Clear deliverables and timelines.", keywords: "scope of work agreement india, sow contract, project scope agreement india, deliverables agreement india", robots: "index, follow" },
  "svc/documentation/rental-agreement": { title: "Rental Agreement Drafting India | ₹999", description: "Legal rental/lease agreement drafting for residential and commercial property across India. 11-month licence and long-term lease formats available.", keywords: "rental agreement india, rent agreement online, lease agreement india, 11 month rent agreement, tenancy agreement", robots: "index, follow" },
  "svc/documentation/sale-deed": { title: "Sale Deed Drafting & Registration India | ₹2,999", description: "Professionally drafted property Sale Deed with all mandatory clauses. Expert support for registration and stamp duty computation across India.", keywords: "sale deed india, property sale deed, sale deed registration india, property transfer deed, sale deed format", robots: "index, follow" },
  "svc/documentation/legal-notice": { title: "Legal Notice Drafting & Sending India | ₹1,999", description: "Expert lawyers draft and send legal notices for contract breach, property disputes, money recovery, and defamation via registered post.", keywords: "legal notice india, send legal notice online, lawyer notice india, legal notice drafting, legal notice format", robots: "index, follow" },
  "svc/documentation/legal-notice-recovery": { title: "Legal Notice for Money Recovery India | ₹1,999", description: "Send a legally drafted notice for recovery of dues, loans, or outstanding payments. Expert advocates with 48-hour turnaround.", keywords: "legal notice money recovery india, recovery legal notice, debt recovery notice india, money recovery notice", robots: "index, follow" },
  "svc/documentation/cheque-bounce-notice": { title: "Cheque Bounce Notice India – Section 138 | ₹1,999", description: "Expert legal notice for cheque dishonour under Section 138 NI Act. Includes demand notice drafting and court complaint filing if required.", keywords: "cheque bounce notice india, section 138 notice, dishonour cheque india, ni act notice, cheque bounce india", robots: "index, follow" },
  "svc/documentation/employment-agreement": { title: "Employment Agreement Drafting India | ₹1,499", description: "Comprehensive employment contracts for permanent, contractual, and part-time staff. Covers NDA, IP assignment, non-compete, and notice period.", keywords: "employment agreement india, job contract india, employment contract drafting, employee agreement india", robots: "index, follow" },

  // ── Fundraising ───────────────────────────────────────────────────────────
  "svc/fundraising/fundraising": { title: "Startup Fundraising Advisory India | Legal Filing", description: "Expert fundraising advisory for seed, Series A, and growth stage startups — term sheet review, SAFE notes, and investor due diligence support.", keywords: "startup fundraising india, seed funding india, series a funding, investor advisory india, startup funding", robots: "index, follow" },
  "svc/fundraising/pitch-deck": { title: "Investor Pitch Deck Creation India | Legal Filing", description: "Professional investor pitch deck design and content for Indian startups. Compelling storytelling, financial projections, and market analysis.", keywords: "pitch deck india, investor presentation, startup pitch deck, fundraising deck india, pitch deck design", robots: "index, follow" },

  // ── NGO ───────────────────────────────────────────────────────────────────
  "svc/ngo/ngo": { title: "NGO Registration in India | Society, Trust, Sec. 8", description: "Register your NGO in India — choose Society, Trust, or Section 8 Company. Expert legal support, Darpan registration, and 80G/12A tax exemption.", keywords: "ngo registration india, register ngo, non profit organization india, ngo setup india, ngo formation", robots: "index, follow" },
  "svc/ngo/section-8-company": { title: "Section 8 Company Registration India | ₹9,999", description: "Register a Section 8 Not-for-Profit Company under the Companies Act. Tax exemptions, high credibility, perpetual succession for NGOs.", keywords: "section 8 company registration india, not for profit company, section 8 company india, section 8 ngo", robots: "index, follow" },
  "svc/ngo/trust-registration": { title: "Trust Registration in India | ₹6,999", description: "Register a Public or Private Charitable Trust in India. Expert support for trust deed drafting, registration, and PAN application.", keywords: "trust registration india, charitable trust india, public trust registration, trust deed drafting, private trust india", robots: "index, follow" },
  "svc/ngo/society-registration": { title: "Society Registration in India | ₹4,999", description: "Register a society under the Societies Registration Act for cultural, educational, and religious organizations across India.", keywords: "society registration india, register society, societies registration act, society formation india, charitable society", robots: "index, follow" },
  "svc/ngo/ngo-compliance": { title: "NGO Annual Compliance – FCRA, ITR | ₹5,999", description: "Complete annual compliance for NGOs — FCRA renewal, Form FC-4, income tax return, Darpan update, and 80G/12A renewal by expert CAs.", keywords: "ngo compliance india, fcra compliance, ngo annual return, ngo tax return india, fcra renewal", robots: "index, follow" },
  "svc/ngo/section-8-compliance": { title: "Section 8 Company Annual Compliance India | ₹4,999", description: "Annual compliance for Section 8 Not-for-Profit companies — AOC-4, MGT-7, statutory audit, and income tax return by expert CAs.", keywords: "section 8 compliance india, not for profit compliance, section 8 annual return, section 8 company filing", robots: "index, follow" },
  "svc/ngo/csr-1-filing": { title: "CSR-1 Form Filing for NGOs India | ₹2,999", description: "File CSR-1 to register your NGO or trust to receive Corporate Social Responsibility funds from Indian companies under Section 135.", keywords: "csr-1 filing india, csr registration ngo, csr funds ngo, corporate social responsibility, csr-1 form india", robots: "index, follow" },
  "svc/ngo/80g-12a": { title: "80G & 12A Tax Exemption for NGOs India | ₹3,999", description: "Get Sec. 80G and Sec. 12A tax exemption certificates. Allows donors to claim deductions and your NGO to be fully tax-exempt.", keywords: "80g registration india, 12a registration, ngo tax exemption, donation tax deduction india, 80g 12a ngo", robots: "index, follow" },
  "svc/ngo/darpan-registration": { title: "NGO Darpan Registration India | ₹1,999", description: "Register your NGO on the NITI Aayog Darpan portal — mandatory for receiving government grants and CSR funds from corporates.", keywords: "darpan registration india, ngo darpan portal, niti aayog ngo, darpan ngo registration, darpan unique id", robots: "index, follow" },

  // ── Property & Personal ───────────────────────────────────────────────────
  "svc/property-personal/property-title-verification": { title: "Property Title Verification India | ₹2,999", description: "Comprehensive property title verification by expert lawyers — encumbrance certificate, chain of title, and clear ownership report before purchase.", keywords: "property title verification india, property legal check, title search india, encumbrance certificate, property due diligence", robots: "index, follow" },
  "svc/property-personal/property-registration": { title: "Property Registration in India | ₹3,999", description: "Expert support for property sale deed registration across India — stamp duty calculation, deed drafting, and sub-registrar appointment.", keywords: "property registration india, property sale deed registration, property transfer india, property registry india", robots: "index, follow" },
  "svc/property-personal/name-change": { title: "Legal Name Change in India – Gazette | ₹1,999", description: "Change your name legally in India — affidavit, newspaper publication, Gazette of India notification, and Aadhaar, PAN, and passport update.", keywords: "name change india, legal name change, gazette notification name change, how to change name india, name change affidavit", robots: "index, follow" },
  "svc/property-personal/religion-change": { title: "Religion Change Declaration India | ₹1,499", description: "Legally declare a change of religion in India — affidavit drafting, newspaper publication, and district court submission support.", keywords: "religion change india, change religion declaration, convert religion legally india, religion change affidavit", robots: "index, follow" },
  "svc/property-personal/gender-change": { title: "Gender Change Legal Process India | Legal Filing", description: "Legal support for gender change in official documents — court declaration, Aadhaar, PAN, passport, and voter ID update guidance.", keywords: "gender change india, transgender name change, gender declaration india, legal gender change, gender update india", robots: "index, follow" },
  "svc/property-personal/online-police-complaint": { title: "File Online Police Complaint India | Legal Filing", description: "Expert guidance to file an online FIR or complaint with Indian police authorities. Lawyer-drafted complaint with 48-hour turnaround.", keywords: "online police complaint india, file fir online, online fir india, police complaint drafting, fir filing india", robots: "index, follow" },
  "svc/property-personal/marriage-registration": { title: "Marriage Registration in India | ₹1,999", description: "Register your marriage under the Hindu Marriage Act or Special Marriage Act. All Indian states covered with document-based registration.", keywords: "marriage registration india, register marriage online, marriage certificate india, nikah registration india", robots: "index, follow" },
  "svc/property-personal/court-marriage": { title: "Court Marriage in India | ₹2,999", description: "Register a court marriage under the Special Marriage Act. Includes notice filing, 30-day period, and official marriage certificate issuance.", keywords: "court marriage india, special marriage act, civil marriage india, court marriage process, sma marriage india", robots: "index, follow" },
  "svc/property-personal/corporate-immigration": { title: "Corporate Immigration Services India | Legal Filing", description: "Work visas, business visas, and residence permits for Indian companies bringing foreign talent or Indian executives working abroad.", keywords: "corporate immigration india, work visa india, business visa, foreign employee work permit india, expat visa india", robots: "index, follow" },
  "svc/property-personal/family-immigration": { title: "Family Immigration Services India | Legal Filing", description: "Spouse visas, dependent visas, and family reunification services for Indians migrating abroad or bringing family to India.", keywords: "family immigration india, spouse visa, dependent visa india, family reunification, family visa india", robots: "index, follow" },
  "svc/property-personal/college-immigration": { title: "Student Visa & College Immigration India | Legal", description: "Expert support for student visas, university admission documentation, and college immigration to USA, UK, Canada, and Australia.", keywords: "student visa india, college immigration, study abroad visa, university admission visa, student visa help", robots: "index, follow" },
  "svc/property-personal/online-consumer-complaint": { title: "File Consumer Complaint Online India | ₹1,999", description: "Expert lawyers file consumer complaints on the National Consumer Helpline and NCDRC portal for product defects and service deficiency.", keywords: "consumer complaint india, file consumer complaint, consumer forum india, consumer court, consumer helpline india", robots: "index, follow" },
  "svc/property-personal/ecommerce-consumer-complaint": { title: "E-Commerce Consumer Complaint India | ₹1,999", description: "Legal support to file consumer complaints against Amazon, Flipkart, Meesho, and other e-commerce platforms for fraud or defective products.", keywords: "ecommerce consumer complaint india, amazon complaint india, flipkart complaint legal, online shopping fraud india", robots: "index, follow" },
  "svc/property-personal/insurance-consumer-complaint": { title: "Insurance Consumer Complaint India | ₹1,999", description: "File a legal complaint against insurance companies for claim rejection, delay, and mis-selling before IRDAI or consumer forums in India.", keywords: "insurance complaint india, irdai complaint, insurance claim dispute india, insurance consumer forum india", robots: "index, follow" },
  "svc/property-personal/consumer-protection-act": { title: "Consumer Protection Act Legal Help India | ₹2,999", description: "Expert legal guidance on Consumer Protection Act 2019 — file complaints for unfair trade practices, product liability, and e-commerce fraud.", keywords: "consumer protection act india, consumer rights india, consumer court india, cpa 2019 india, consumer protection", robots: "index, follow" },

  // ── Lawyers ───────────────────────────────────────────────────────────────
  "svc/lawyers/criminal-lawyer": { title: "Criminal Lawyer in India – Bail & Defence | Legal", description: "Hire expert criminal defence lawyers for bail, FIR quashing, trial defence, and appeals across all courts in India. Free first consultation.", keywords: "criminal lawyer india, defence lawyer india, bail lawyer, criminal advocate india, criminal defence india", robots: "index, follow" },
  "svc/lawyers/labour-lawyer": { title: "Labour & Employment Lawyer India | Legal Filing", description: "Expert labour lawyers for wrongful termination, PF disputes, factory act compliance, and industrial tribunal cases across India.", keywords: "labour lawyer india, employment lawyer, wrongful termination india, industrial dispute lawyer, labour court india", robots: "index, follow" },
  "svc/lawyers/consumer-court-lawyer": { title: "Consumer Court Lawyer India | Legal Filing India", description: "Experienced consumer court advocates for district, state, and national consumer disputes. Defective products, services, and unfair trade practices.", keywords: "consumer court lawyer india, consumer advocate, ncdrc lawyer, consumer dispute india, consumer forum advocate", robots: "index, follow" },
  "svc/lawyers/divorce-lawyer": { title: "Divorce Lawyer in India – Online & In-Person", description: "Experienced divorce and family lawyers for mutual consent divorce, contested divorce, maintenance, and child custody across India.", keywords: "divorce lawyer india, mutual consent divorce, contested divorce, maintenance lawyer india, divorce advocate india", robots: "index, follow" },
  "svc/lawyers/banking-lawyer": { title: "Banking & Finance Lawyer India | Legal Filing India", description: "Expert banking lawyers for NPA recovery, SARFAESI proceedings, DRT cases, loan fraud, and banking regulatory compliance in India.", keywords: "banking lawyer india, sarfaesi lawyer, drt advocate, loan recovery legal, banking dispute india", robots: "index, follow" },
  "svc/lawyers/immigration-lawyer": { title: "Immigration Lawyer India – Visa & PR Services", description: "Expert immigration lawyers for visa applications, permanent residency, citizenship renunciation, and OCI card services across India.", keywords: "immigration lawyer india, visa lawyer, permanent residence india, oci card lawyer, visa rejection appeal", robots: "index, follow" },
  "svc/lawyers/family-lawyer": { title: "Family Lawyer in India – Matrimonial & Succession", description: "Expert family lawyers for divorce, maintenance, child custody, succession, domestic violence, and matrimonial disputes across India.", keywords: "family lawyer india, matrimonial lawyer, succession lawyer, domestic violence lawyer india, family court india", robots: "index, follow" },
  "svc/lawyers/litigation-lawyer": { title: "Litigation Lawyer India – Civil & Commercial Courts", description: "Experienced litigation advocates for civil suits, commercial disputes, injunctions, and High Court/Supreme Court appearances across India.", keywords: "litigation lawyer india, civil court lawyer, commercial litigation, court advocate india, high court lawyer", robots: "index, follow" },
  "svc/lawyers/ip-lawyer": { title: "Intellectual Property Lawyer India | Legal Filing", description: "Expert IP lawyers for trademark, copyright, and patent disputes, licensing negotiations, and IP due diligence across Indian courts.", keywords: "intellectual property lawyer india, ip advocate, trademark litigation, patent dispute lawyer, ip attorney india", robots: "index, follow" },
  "svc/lawyers/trademark-lawyer": { title: "Trademark Lawyer in India | ₹999 Consultation", description: "Specialist trademark attorneys for registration, opposition, objection reply, infringement cases, and brand protection across India.", keywords: "trademark lawyer india, trademark advocate, ip attorney india, brand protection lawyer, tm litigation india", robots: "index, follow" },
  "svc/lawyers/tmt": { title: "Technology, Media & Telecom Lawyer India | TMT Law", description: "Expert TMT lawyers for software licensing, data privacy, broadcasting regulations, telecom disputes, and IT Act compliance in India.", keywords: "tmt lawyer india, technology lawyer, media law india, telecom lawyer, it act lawyer, digital law india", robots: "index, follow" },
  "svc/lawyers/risk-management": { title: "Risk Management & Regulatory Lawyer India", description: "Expert legal support for corporate risk management, regulatory compliance, RBI/SEBI matters, and enterprise risk advisory for Indian companies.", keywords: "risk management lawyer india, regulatory compliance lawyer, corporate risk legal, rbi compliance lawyer, sebi lawyer", robots: "index, follow" },
};

type SeoData = {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  robots: string;
};

// ── Internal Linking types ───────────────────────────────────────────────────
interface InternalLink { id: string; keyword: string; targetUrl: string; matchMode: "exact" | "partial" | "first-only"; }
const STORAGE_KEY = "vakil_internal_links";
function loadLinks(): InternalLink[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]"); } catch { return []; }
}
function saveLinks(links: InternalLink[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

const GROUP_LABELS_META: Record<PageGroup, string> = { static: "Static Pages", category: "Categories", service: "Services" };
const GROUP_COLORS: Record<PageGroup, string> = { static: "bg-blue-100 text-blue-700", category: "bg-amber-100 text-amber-700", service: "bg-green-100 text-green-700" };

// ── Meta Tags Tab Component ──────────────────────────────────────────────────
function MetaTagsTab() {
  const queryClient = useQueryClient();
  const { data: seoSettings } = useListSeoSettings();
  const upsertMutation = useUpsertSeoSetting();
  const { toast } = useToast();

  const [selectedPage, setSelectedPage] = useState(ALL_PAGES[0].id);
  const [saving, setSaving] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState<PageGroup | "all">("all");

  const existing = (seoSettings ?? []).find(s => s.page === selectedPage);
  const defaults = DEFAULT_SEO[selectedPage];

  const [form, setForm] = useState<SeoData>({
    title: existing?.title ?? defaults?.title ?? "",
    description: existing?.description ?? defaults?.description ?? "",
    keywords: existing?.keywords ?? defaults?.keywords ?? "",
    ogTitle: existing?.ogTitle ?? "",
    ogDescription: existing?.ogDescription ?? "",
    ogImage: existing?.ogImage ?? "",
    robots: existing?.robots ?? defaults?.robots ?? "index, follow",
  });

  const handlePageChange = (page: string) => {
    setSelectedPage(page);
    const ex = (seoSettings ?? []).find(s => s.page === page);
    const def = DEFAULT_SEO[page];
    setForm({
      title: ex?.title ?? def?.title ?? "",
      description: ex?.description ?? def?.description ?? "",
      keywords: ex?.keywords ?? def?.keywords ?? "",
      ogTitle: ex?.ogTitle ?? "",
      ogDescription: ex?.ogDescription ?? "",
      ogImage: ex?.ogImage ?? "",
      robots: ex?.robots ?? def?.robots ?? "index, follow",
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertMutation.mutateAsync({ page: selectedPage, data: form });
      await queryClient.invalidateQueries({ queryKey: getListSeoSettingsQueryKey() });
      toast({ title: "SEO settings saved" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const charCount = (val: string, limit: number) => {
    const len = val.length;
    const color = len > limit ? "text-red-500" : len > limit * 0.9 ? "text-yellow-500" : "text-gray-400";
    return <span className={`text-xs ${color}`}>{len}/{limit}</span>;
  };

  const savedIds = useMemo(() => new Set((seoSettings ?? []).map(s => s.page)), [seoSettings]);

  const filteredPages = useMemo(() => ALL_PAGES.filter(p => {
    const matchGroup = groupFilter === "all" || p.group === groupFilter;
    const matchSearch = !search || p.label.toLowerCase().includes(search.toLowerCase());
    return matchGroup && matchSearch;
  }), [search, groupFilter]);

  const selectedPageDef = ALL_PAGES.find(p => p.id === selectedPage);

  const counts = useMemo(() => ({
    all: ALL_PAGES.length,
    static: ALL_PAGES.filter(p => p.group === "static").length,
    category: ALL_PAGES.filter(p => p.group === "category").length,
    service: ALL_PAGES.filter(p => p.group === "service").length,
  }), []);

  return (
    <div className="flex flex-col lg:flex-row gap-5">
      {/* Page Selector */}
      <div className="lg:w-60 xl:w-72 shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col" style={{ maxHeight: "82vh" }}>
          {/* Header */}
          <div className="px-3 pt-3 pb-2 border-b border-gray-100 bg-gray-50 space-y-2">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
              <Globe size={12} /> {ALL_PAGES.length} Pages
            </p>
            {/* Search */}
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search pages…"
                className="w-full pl-7 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#0f2044]"
              />
            </div>
            {/* Group filter pills */}
            <div className="flex gap-1 flex-wrap">
              {(["all", "static", "category", "service"] as const).map(g => (
                <button
                  key={g}
                  onClick={() => setGroupFilter(g)}
                  className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-all ${groupFilter === g ? "bg-[#0f2044] text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
                >
                  {g === "all" ? `All (${counts.all})` : `${GROUP_LABELS_META[g]} (${counts[g]})`}
                </button>
              ))}
            </div>
          </div>
          {/* Page list */}
          <nav className="p-1.5 space-y-0.5 overflow-y-auto flex-1">
            {filteredPages.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">No pages match your search</p>
            )}
            {filteredPages.map(page => {
              const isSaved = savedIds.has(page.id);
              const isSelected = selectedPage === page.id;
              return (
                <button
                  key={page.id}
                  onClick={() => handlePageChange(page.id)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-all flex items-center justify-between gap-1.5 ${isSelected ? "bg-[#0f2044] text-white" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm leading-none shrink-0">{page.icon}</span>
                    <span className="truncate">{page.label}</span>
                  </span>
                  <span className="flex items-center gap-1 shrink-0">
                    {groupFilter === "all" && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium hidden sm:inline ${isSelected ? "bg-white/20 text-white" : GROUP_COLORS[page.group]}`}>
                        {page.group === "static" ? "S" : page.group === "category" ? "C" : "SVC"}
                      </span>
                    )}
                    {isSaved && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-[#c9a227]" : "bg-green-500"}`} />}
                  </span>
                </button>
              );
            })}
          </nav>
          {/* Footer legend */}
          <div className="px-3 py-2 border-t border-gray-100 bg-gray-50 flex items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" /> Saved</span>
            <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-300 inline-block" /> Default only</span>
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{selectedPageDef?.icon}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${GROUP_COLORS[selectedPageDef?.group ?? "static"]}`}>
              {GROUP_LABELS_META[selectedPageDef?.group ?? "static"]}
            </span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setPreviewMode(!previewMode)} className="gap-1.5">
            {previewMode ? <EyeOff size={14} /> : <Eye size={14} />}
            {previewMode ? "Edit" : "Preview"}
          </Button>
        </div>

        {previewMode ? (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h3 className="font-semibold text-[#0f2044] text-sm border-b pb-2">Google Search Preview</h3>
            <div className="border border-gray-200 rounded-lg p-4 max-w-[600px]">
              <div className="text-[13px] text-gray-500 truncate">legalfilingindia.com › {selectedPage.replace(/\//g, " › ")}</div>
              <div className="text-blue-700 text-lg hover:underline cursor-pointer mt-0.5 line-clamp-2">{form.title || "Page Title"}</div>
              <div className="text-sm text-gray-600 mt-1 line-clamp-2">{form.description || "Page description will appear here..."}</div>
            </div>
            {(form.ogTitle || form.ogDescription) && (
              <>
                <h3 className="font-semibold text-[#0f2044] text-sm border-b pb-2 mt-4">Social Share Preview</h3>
                <div className="border border-gray-200 rounded-xl overflow-hidden max-w-[500px]">
                  {form.ogImage && <img src={form.ogImage} alt="OG" className="w-full h-40 object-cover" />}
                  <div className="p-4 bg-gray-50">
                    <div className="text-xs text-gray-400 uppercase">legalfilingindia.com</div>
                    <div className="font-semibold mt-1">{form.ogTitle || form.title}</div>
                    <div className="text-sm text-gray-600 mt-1 line-clamp-2">{form.ogDescription || form.description}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
            <div className="flex items-center justify-between pb-2 border-b">
              <h3 className="font-semibold text-[#0f2044]">{selectedPageDef?.label}</h3>
              <span className={`text-xs px-2 py-0.5 rounded-full ${savedIds.has(selectedPage) ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                {savedIds.has(selectedPage) ? "Saved" : "Using defaults"}
              </span>
            </div>
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Primary SEO</h4>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Meta Title</Label>
                  {charCount(form.title, 60)}
                </div>
                <Input className="text-sm h-9" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="60 characters recommended" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Meta Description</Label>
                  {charCount(form.description, 160)}
                </div>
                <Textarea className="text-sm resize-none" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="160 characters recommended" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Keywords</Label>
                <Input className="text-sm h-9" value={form.keywords} onChange={e => setForm(f => ({ ...f, keywords: e.target.value }))} placeholder="keyword1, keyword2, keyword3" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">Robots</Label>
                <Select value={form.robots} onValueChange={v => setForm(f => ({ ...f, robots: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROBOTS_OPTIONS.map(o => <SelectItem key={o} value={o} className="text-sm">{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-4 pt-2 border-t">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Open Graph (Social)</h4>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">OG Title</Label>
                  {charCount(form.ogTitle, 60)}
                </div>
                <Input className="text-sm h-9" value={form.ogTitle} onChange={e => setForm(f => ({ ...f, ogTitle: e.target.value }))} placeholder="Defaults to Meta Title if empty" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">OG Description</Label>
                  {charCount(form.ogDescription, 160)}
                </div>
                <Textarea className="text-sm resize-none" rows={2} value={form.ogDescription} onChange={e => setForm(f => ({ ...f, ogDescription: e.target.value }))} placeholder="Defaults to Meta Description if empty" />
              </div>
              <div>
                <Label className="text-xs mb-1 block">OG Image URL</Label>
                <Input className="text-sm h-9" value={form.ogImage} onChange={e => setForm(f => ({ ...f, ogImage: e.target.value }))} placeholder="https://legalfilingindia.com/og-image.png" />
              </div>
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full bg-[#0f2044] hover:bg-[#0f2044]/90 text-white gap-2">
              <Save size={14} /> {saving ? "Saving..." : "Save SEO Settings"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Internal Linking Tab ─────────────────────────────────────────────────────
function InternalLinkingTab() {
  const [links, setLinks] = useState<InternalLink[]>(loadLinks);
  const [form, setForm] = useState<Omit<InternalLink, "id">>({ keyword: "", targetUrl: "", matchMode: "first-only" });
  const { toast } = useToast();

  const add = () => {
    if (!form.keyword.trim() || !form.targetUrl.trim()) return;
    const updated = [...links, { ...form, id: crypto.randomUUID() }];
    setLinks(updated); saveLinks(updated);
    setForm({ keyword: "", targetUrl: "", matchMode: "first-only" });
    toast({ title: "Link rule added" });
  };
  const remove = (id: string) => {
    const updated = links.filter(l => l.id !== id);
    setLinks(updated); saveLinks(updated);
  };

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <strong>Internal Linking Manager</strong> — define keyword-to-URL rules. These rules guide your content team when creating blog posts and service pages. Rules are stored locally and can be exported for use in your content workflow.
      </div>

      {/* Add form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-[#0f2044] text-sm mb-4">Add Link Rule</h3>
        <div className="grid sm:grid-cols-3 gap-3 mb-3">
          <div>
            <Label className="text-xs mb-1 block">Keyword / Anchor Text</Label>
            <Input className="h-9 text-sm" placeholder="e.g. trademark registration" value={form.keyword} onChange={e => setForm(f => ({ ...f, keyword: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Target URL</Label>
            <Input className="h-9 text-sm" placeholder="/services/trademark-registration" value={form.targetUrl} onChange={e => setForm(f => ({ ...f, targetUrl: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs mb-1 block">Match Mode</Label>
            <Select value={form.matchMode} onValueChange={v => setForm(f => ({ ...f, matchMode: v as InternalLink["matchMode"] }))}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="first-only">First occurrence only</SelectItem>
                <SelectItem value="exact">Exact match</SelectItem>
                <SelectItem value="partial">Partial match</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button size="sm" onClick={add} className="bg-[#0f2044] hover:bg-[#0f2044]/90 text-white gap-1.5">
          <Plus size={13} /> Add Rule
        </Button>
      </div>

      {/* Rules table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{links.length} Rules</p>
          {links.length > 0 && (
            <button
              onClick={() => {
                const csv = ["keyword,targetUrl,matchMode", ...links.map(l => `"${l.keyword}","${l.targetUrl}","${l.matchMode}"`)].join("\n");
                const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "internal-links.csv"; a.click();
              }}
              className="text-xs text-[#c9a227] hover:underline"
            >Export CSV</button>
          )}
        </div>
        {links.length === 0 ? (
          <div className="px-4 py-10 text-center text-gray-400 text-sm">No rules yet. Add your first internal link rule above.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Keyword</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Target URL</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500">Mode</th>
                <th className="px-4 py-2 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {links.map(l => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-[#0f2044]">{l.keyword}</td>
                  <td className="px-4 py-2">
                    <a href={l.targetUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1 text-xs">
                      {l.targetUrl} <ExternalLink size={10} />
                    </a>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-500 capitalize">{l.matchMode}</td>
                  <td className="px-4 py-2">
                    <button onClick={() => remove(l.id)} className="text-red-400 hover:text-red-600 p-1 rounded">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Sitemap helpers ───────────────────────────────────────────────────────────
interface SitemapEntry { url: string; filename: string; label: string; desc: string; group: string; }

function classifyUrl(url: string): { label: string; desc: string; group: string } {
  const file = url.split("/").pop() ?? url;
  if (file === "sitemap-index.xml" || file === "sitemap.xml")
    return { label: "Sitemap Index", desc: "Master index — submit this to Google Search Console", group: "index" };
  if (file === "sitemap-static.xml")
    return { label: "Static + Services", desc: "Home, service, and category pages", group: "core" };
  if (file === "sitemap-blogs.xml")
    return { label: "Blog Posts", desc: "All published blog articles", group: "core" };
  const coMatch = file.match(/^sitemap-companies-(\d+)\.xml$/);
  if (coMatch)
    return { label: `Companies — part ${coMatch[1]}`, desc: "Up to 50,000 company pages", group: "companies" };
  const pseoMatch = file.match(/^sitemap-pseo-(\d+)\.xml$/);
  if (pseoMatch)
    return { label: `pSEO — part ${pseoMatch[1]}`, desc: "Service × location pages (up to 50,000 URLs)", group: "pseo" };
  return { label: file, desc: "", group: "other" };
}

/** Parse <loc> values out of a sitemapindex XML string */
function parseSitemapIndex(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<]+)\s*<\/loc>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) locs.push(m[1].trim());
  return locs;
}

const GROUP_ORDER = ["index", "core", "companies", "pseo", "other"];
const GROUP_LABELS: Record<string, string> = {
  index: "Sitemap Index",
  core: "Core Files",
  companies: "Company Sitemaps",
  pseo: "pSEO Sitemaps (Service × Location)",
  other: "Other",
};

// ── Sitemap Tab ──────────────────────────────────────────────────────────────
function SitemapTab() {
  const { toast } = useToast();
  const [stats, setStats]       = useState<{ locations: number; services: number; blogs: number; companies: number } | null>(null);
  const [entries, setEntries]   = useState<SitemapEntry[]>([]);
  const [loading, setLoading]   = useState(false);
  const [pinging, setPinging]   = useState(false);
  const [pingResult, setPingResult] = useState<{ google: boolean; bing: boolean; message: string } | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [loc, svc, blog, co, indexXml] = await Promise.all([
        fetch(`${BASE}/api/locations?limit=1`, { credentials: "include" }).then(r => r.json()).then(d => Number(d.total ?? 0)).catch(() => 0),
        fetch(`${BASE}/api/services`, { credentials: "include" }).then(r => r.json()).then(d => Array.isArray(d) ? d.length : 0).catch(() => 0),
        fetch(`${BASE}/api/blogs?limit=1`, { credentials: "include" }).then(r => r.json()).then(d => Number(d.total ?? 0)).catch(() => 0),
        fetch(`${BASE}/api/companies?limit=1`).then(r => r.json()).then(d => Number(d.total ?? 0)).catch(() => 0),
        fetch(`${BASE}/api/sitemap-index.xml`).then(r => r.text()).catch(() => ""),
      ]);
      setStats({ locations: loc, services: svc, blogs: blog, companies: co });

      // Parse every <loc> from the index, then add the index itself at the front
      const locs = parseSitemapIndex(indexXml);
      const built: SitemapEntry[] = [
        // Index file itself (always first)
        (() => {
          const u = `${BASE}/api/sitemap-index.xml`;
          const { label, desc, group } = classifyUrl(u);
          return { url: u, filename: "sitemap-index.xml", label, desc, group };
        })(),
        // Static + blogs (always present, may or may not be in the index)
        ...([`${BASE}/api/sitemap-static.xml`, `${BASE}/api/sitemap-blogs.xml`].map(u => {
          const { label, desc, group } = classifyUrl(u);
          return { url: u, filename: u.split("/").pop()!, label, desc, group };
        })),
        // Everything from the parsed index (companies, pseo, …)
        ...locs.map(rawUrl => {
          // Rewrite the hostname to the current origin so links work in dev
          const filename = rawUrl.split("/").pop() ?? rawUrl;
          const url = `${BASE}/api/${filename}`;
          const { label, desc, group } = classifyUrl(url);
          return { url, filename, label, desc, group };
        }),
      ];

      // Deduplicate by filename, preserve order
      const seen = new Set<string>();
      setEntries(built.filter(e => { if (seen.has(e.filename)) return false; seen.add(e.filename); return true; }));
    } finally { setLoading(false); }
  };

  const pingSearchEngines = async () => {
    setPinging(true); setPingResult(null);
    try {
      const r = await fetch(`${BASE}/api/admin/sitemap/ping`, { method: "POST", credentials: "include" });
      if (!r.ok) throw new Error();
      const d = await r.json();
      setPingResult({ google: d.google, bing: d.bing, message: d.message });
      toast({ title: `Sitemap pinged — Google: ${d.google ? "✓" : "✗"}  Bing: ${d.bing ? "✓" : "✗"}` });
    } catch {
      toast({ title: "Ping failed", description: "Check server logs", variant: "destructive" });
    } finally { setPinging(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  // Group entries
  const grouped = GROUP_ORDER.reduce<Record<string, SitemapEntry[]>>((acc, g) => {
    acc[g] = entries.filter(e => e.group === g);
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Locations",  value: stats?.locations,  color: "bg-blue-50   border-blue-100   text-blue-700"   },
          { label: "Services",   value: stats?.services,   color: "bg-amber-50  border-amber-100  text-amber-700"  },
          { label: "Blog Posts", value: stats?.blogs,      color: "bg-green-50  border-green-100  text-green-700"  },
          { label: "Companies",  value: stats?.companies,  color: "bg-purple-50 border-purple-100 text-purple-700" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 text-center ${s.color}`}>
            <div className="text-2xl font-bold">{loading ? "…" : (s.value ?? "—").toLocaleString()}</div>
            <div className="text-xs mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Ping */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#0f2044]">Ping Search Engines</p>
          <p className="text-xs text-gray-400 mt-0.5">Notify Google &amp; Bing that the sitemap has been updated</p>
          {pingResult && (
            <div className="flex gap-3 mt-2 flex-wrap">
              <span className={`text-xs font-medium ${pingResult.google ? "text-green-600" : "text-red-500"}`}>{pingResult.google ? "✓" : "✗"} Google</span>
              <span className={`text-xs font-medium ${pingResult.bing   ? "text-green-600" : "text-red-500"}`}>{pingResult.bing   ? "✓" : "✗"} Bing</span>
              <span className="text-xs text-gray-400">{pingResult.message}</span>
            </div>
          )}
        </div>
        <Button onClick={pingSearchEngines} disabled={pinging}
          className="bg-[#0f2044] hover:bg-[#c9a227] hover:text-[#0f2044] text-white gap-2 shrink-0 transition-colors" size="sm">
          <RefreshCw size={13} className={pinging ? "animate-spin" : ""} />
          {pinging ? "Pinging…" : "Ping Google & Bing"}
        </Button>
      </div>

      {/* All sitemap files grouped */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          <RefreshCw size={18} className="animate-spin mx-auto mb-2" /> Loading sitemap files…
        </div>
      ) : (
        GROUP_ORDER.filter(g => grouped[g]?.length > 0).map(g => (
          <div key={g} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{GROUP_LABELS[g]}</p>
                <p className="text-xs text-gray-400 mt-0.5">{grouped[g].length} file{grouped[g].length !== 1 ? "s" : ""}</p>
              </div>
              {g === "index" && (
                <button onClick={fetchAll} disabled={loading}
                  className="text-xs text-[#c9a227] hover:underline flex items-center gap-1">
                  <RefreshCw size={11} className={loading ? "animate-spin" : ""} /> Refresh all
                </button>
              )}
            </div>
            <div className={`divide-y divide-gray-100 ${grouped[g].length > 6 ? "max-h-72 overflow-y-auto" : ""}`}>
              {grouped[g].map(e => (
                <div key={e.filename} className="px-4 py-2.5 flex items-center justify-between gap-4 hover:bg-gray-50/60 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#0f2044] truncate">{e.label}</p>
                    {e.desc && <p className="text-xs text-gray-400 mt-0.5">{e.desc}</p>}
                    <p className="text-[10px] text-gray-300 font-mono mt-0.5 truncate">{e.filename}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <a href={e.url} download={e.filename}
                      className="flex items-center gap-1 text-xs text-gray-600 hover:text-[#0f2044] border border-gray-200 px-2.5 py-1.5 rounded-lg hover:border-[#0f2044] hover:bg-gray-50 transition-all font-medium">
                      ↓ Download
                    </a>
                    <a href={e.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 hover:underline">
                      <ExternalLink size={12} /> View
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* HTML sitemap link (not an XML file — listed separately) */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#0f2044]">HTML Sitemap</p>
          <p className="text-xs text-gray-400">Human-readable page for visitors and crawlers</p>
        </div>
        <a href={`${BASE}/sitemap`} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-blue-600 hover:underline shrink-0">
          <ExternalLink size={12} /> Open
        </a>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <strong>Tip:</strong> Submit <code className="bg-amber-100 px-1 rounded text-xs">/api/sitemap-index.xml</code> to
        Google Search Console — it automatically references all company, pSEO, blog, and static sitemaps.
        Hit <strong>Ping Google &amp; Bing</strong> after importing new data or publishing blog posts.
      </div>
    </div>
  );
}

// ── Robots.txt Tab ───────────────────────────────────────────────────────────
const DEFAULT_ROBOTS = `User-agent: *
Allow: /

# Block admin panel
Disallow: /admin/
Disallow: /portal/

# Sitemaps
Sitemap: https://legalfilingindia.com/api/sitemap-index.xml
Sitemap: https://legalfilingindia.com/api/sitemap.xml`;

function RobotsTab() {
  const { toast } = useToast();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${BASE}/api/admin/settings`, { credentials: "include" })
      .then(r => r.json())
      .then((d: Array<{ key: string; value: string }>) => {
        const row = Array.isArray(d) ? d.find((s) => s.key === "robots_txt_content") : null;
        setContent(row?.value ?? DEFAULT_ROBOTS);
      })
      .catch(() => setContent(DEFAULT_ROBOTS))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${BASE}/api/admin/settings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "robots_txt_content", value: content }),
      });
      if (!r.ok) throw new Error();
      toast({ title: "robots.txt saved" });
    } catch {
      toast({ title: "Save failed", variant: "destructive" });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
        <strong>robots.txt</strong> — controls which pages search engine crawlers can access.
        Changes here update the site-wide robots.txt served from the domain root.
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-[#0f2044]">robots.txt content</Label>
          <button onClick={() => setContent(DEFAULT_ROBOTS)} className="text-xs text-gray-400 hover:text-gray-600">Reset to default</button>
        </div>
        {loading ? (
          <div className="h-40 bg-gray-50 rounded-lg animate-pulse" />
        ) : (
          <Textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={14}
            className="font-mono text-xs resize-none"
            placeholder={DEFAULT_ROBOTS}
          />
        )}
        <Button onClick={save} disabled={saving || loading} className="w-full bg-[#0f2044] hover:bg-[#0f2044]/90 text-white gap-2">
          <Save size={14} /> {saving ? "Saving..." : "Save robots.txt"}
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Quick Reference</p>
        <div className="space-y-1 text-xs text-gray-500 font-mono">
          <p><span className="text-green-600">Allow: /path</span> — allow crawling this path</p>
          <p><span className="text-red-500">Disallow: /path</span> — block crawling this path</p>
          <p><span className="text-blue-500">User-agent: *</span> — applies to all bots</p>
          <p><span className="text-purple-500">Sitemap: url</span> — declare a sitemap location</p>
        </div>
      </div>
    </div>
  );
}

// ── Main export ──────────────────────────────────────────────────────────────
export default function AdminSeo() {
  const [activeTab, setActiveTab] = useState<SeoTab>("meta");

  return (
    <AdminLayout title="SEO Manager" subtitle="Meta tags, internal linking, sitemap & robots.txt">
      {/* Tab bar */}
      <div className="bg-white border border-gray-200 rounded-2xl p-1.5 mb-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {SEO_TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${activeTab === key ? "bg-[#0f2044] text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
            >
              <Icon size={13} />{label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "meta"     && <MetaTagsTab />}
      {activeTab === "linking"  && <InternalLinkingTab />}
      {activeTab === "sitemap"  && <SitemapTab />}
      {activeTab === "robots"   && <RobotsTab />}
    </AdminLayout>
  );
}
