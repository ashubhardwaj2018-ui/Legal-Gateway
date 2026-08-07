/**
 * Server-side service map — mirrors the frontend service-index.ts
 * Used by the SSR prerender endpoint so bots get complete HTML.
 * Slugs match the toSlug() output from the frontend.
 */

export interface SvcInfo {
  name: string;
  slug: string;
  categoryId: string;
  categoryTitle: string;
  price: string;
  description: string;
}

const RAW: Array<[string, string, Array<[string, string, string]>]> = [
  ["consult-expert", "Consult an Expert", [
    ["talk-to-a-lawyer",             "Talk to a Lawyer",             "₹999"],
    ["talk-to-a-ca",                 "Talk to a CA",                 "₹999"],
    ["talk-to-a-cs",                 "Talk to a CS",                 "₹999"],
    ["talk-to-an-iptrademark-lawyer","Talk to an IP/Trademark Lawyer","₹999"],
  ]],
  ["business-setup", "Business Setup", [
    ["private-limited-company",   "Private Limited Company",   "₹6,999"],
    ["limited-liability-partnership","Limited Liability Partnership","₹5,999"],
    ["one-person-company",        "One Person Company",        "₹6,499"],
    ["sole-proprietorship",       "Sole Proprietorship",       "₹1,999"],
    ["nidhi-company",             "Nidhi Company",             "₹24,999"],
    ["producer-company",          "Producer Company",          "₹19,999"],
    ["partnership-firm",          "Partnership Firm",          "₹2,999"],
    ["startup-india-registration","Startup India Registration","₹3,999"],
    ["digital-signature-certificate","Digital Signature Certificate","₹1,499"],
    ["msmessi-registration",      "MSME/SSI Registration",     "₹1,999"],
    ["iso-certification",         "ISO Certification",         "₹7,999"],
    ["fssai-registration-online", "FSSAI Registration Online", "₹3,499"],
    ["iec-importexport-code",     "IEC (Import/Export Code)",  "₹3,999"],
    ["company-name-search",       "Company Name Search",       "₹499"],
  ]],
  ["tax-compliance", "Tax & Compliance", [
    ["gst-registration",          "GST Registration",          "₹1,499"],
    ["gst-filing",                "GST Filing",                "₹999"],
    ["gst-advisory",              "GST Advisory",              "₹4,999"],
    ["individual-income-tax-filing","Individual Income Tax Filing","₹999"],
    ["proprietorship-tax-return-filing","Proprietorship Tax Return Filing","₹1,999"],
    ["tds-return-filing",         "TDS Return Filing",         "₹1,499"],
    ["accounting-and-book-keeping","Accounting and Book-Keeping","₹4,999"],
    ["payroll-maintenance",       "Payroll Maintenance",       "₹2,999"],
    ["private-limited-company-opc-compliance","Private Limited Company / OPC Compliance","₹9,999"],
    ["limited-liability-partnership-compliance","LLP Compliance","₹5,999"],
    ["provident-fund-pf-registration","Provident Fund (PF) Registration","₹4,999"],
    ["esi-registration",          "ESI Registration",          "₹3,999"],
    ["professional-tax-registration","Professional Tax Registration","₹2,999"],
    ["shops-and-establishments-license","Shops & Establishments License","₹3,499"],
    ["add-a-director",            "Add a Director",            "₹4,999"],
    ["close-the-pvt-ltd-company", "Close the Pvt Ltd Company", "₹14,999"],
  ]],
  ["trademark-ip", "Trademark & IP", [
    ["trademark-registration",    "Trademark Registration",    "₹7,499"],
    ["search-for-trademark",      "Search for Trademark",      "₹499"],
    ["copyright-registration",    "Copyright Registration",    "₹6,999"],
    ["indian-patent-search",      "Indian Patent Search",      "₹4,999"],
    ["provisional-application",   "Provisional Application",   "₹12,999"],
    ["permanent-patent",          "Permanent Patent",          "₹24,999"],
    ["design-registration",       "Design Registration",       "₹9,999"],
    ["logo-design",               "Logo Design",               "₹4,999"],
    ["trademark-renewal",         "Trademark Renewal",         "₹6,999"],
  ]],
  ["documentation", "Documentation", [
    ["non-disclosure-agreement-nda","Non-Disclosure Agreement (NDA)","₹2,999"],
    ["service-level-agreement",   "Service Level Agreement",   "₹3,999"],
    ["franchise-agreement",       "Franchise Agreement",       "₹5,999"],
    ["rental-agreement",          "Rental Agreement",          "₹1,999"],
    ["sale-deed",                 "Sale Deed",                 "₹5,999"],
    ["legal-notice",              "Legal Notice",              "₹2,499"],
    ["employment-agreement",      "Employment Agreement",      "₹3,499"],
    ["make-a-will",               "Make a Will",               "₹4,999"],
    ["power-of-attorney",         "Power of Attorney",         "₹3,499"],
    ["cheque-bounce-notice",      "Cheque Bounce Notice",      "₹2,999"],
  ]],
  ["fundraising", "Fundraising", [
    ["fundraising",  "Fundraising",  "₹14,999"],
    ["pitch-deck",   "Pitch Deck",   "₹9,999"],
  ]],
  ["ngo", "NGO", [
    ["ngo",                "NGO Registration",     "₹9,999"],
    ["section-8-company",  "Section 8 Company",    "₹14,999"],
    ["trust-registration", "Trust Registration",   "₹7,999"],
    ["society-registration","Society Registration","₹7,999"],
    ["ngo-compliance",     "NGO Compliance",       "₹6,999"],
    ["sec80g-sec12a",      "80G & 12A Registration","₹9,999"],
  ]],
  ["property-personal", "Property & Personal", [
    ["property-title-verification","Property Title Verification","₹4,999"],
    ["property-registration",      "Property Registration",      "₹9,999"],
    ["name-change",                "Name Change",                "₹3,499"],
    ["marriage-registration",      "Marriage Registration",      "₹4,999"],
    ["court-marriage",             "Court Marriage",             "₹6,999"],
    ["online-consumer-complaint",  "Online Consumer Complaint",  "₹2,999"],
    ["online-police-complaint",    "Online Police Complaint",    "₹1,999"],
  ]],
  ["lawyers", "Lawyers", [
    ["criminal-lawyer",            "Criminal Lawyer",           "₹4,999"],
    ["labour-lawyer",              "Labour Lawyer",             "₹4,999"],
    ["consumer-court-lawyer",      "Consumer Court Lawyer",     "₹4,999"],
    ["divorce-lawyer",             "Divorce Lawyer",            "₹4,999"],
    ["banking-lawyer",             "Banking Lawyer",            "₹4,999"],
    ["family-lawyer",              "Family Lawyer",             "₹4,999"],
    ["litigation-lawyer",          "Litigation Lawyer",         "₹4,999"],
    ["intellectual-property-lawyer","Intellectual Property Lawyer","₹4,999"],
    ["trademark-lawyer",           "Trademark Lawyer",          "₹4,999"],
  ]],
];

// Build slug → SvcInfo map
const _map: Record<string, SvcInfo> = {};
for (const [catId, catTitle, svcs] of RAW) {
  for (const [slug, name, price] of svcs) {
    _map[slug] = { slug, name, price, categoryId: catId, categoryTitle: catTitle, description: name };
  }
}

export const SERVICE_MAP = _map;
export const ALL_SVC_LIST: SvcInfo[] = Object.values(_map);

export function getSvc(slug: string): SvcInfo | undefined {
  return _map[slug];
}

export function getSvcsByCategory(catId: string): SvcInfo[] {
  return ALL_SVC_LIST.filter((s) => s.categoryId === catId);
}

/** Cross-category popular services to link from any page (max 6) */
export const POPULAR_CROSS_CATEGORY: string[] = [
  "private-limited-company",
  "gst-registration",
  "trademark-registration",
  "fssai-registration-online",
  "individual-income-tax-filing",
  "legal-notice",
];

/** Consult professional slugs — always link these */
export const PROFESSIONAL_SLUGS: string[] = [
  "talk-to-a-lawyer",
  "talk-to-a-ca",
  "talk-to-a-cs",
  "talk-to-an-iptrademark-lawyer",
];
