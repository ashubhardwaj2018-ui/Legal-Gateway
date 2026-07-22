import type { ServiceInfo } from "@/data/service-index";

function stableHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: string): T {
  return arr[stableHash(seed) % arr.length];
}

export interface LocationData {
  id?: number;
  slug: string;
  state: string;
  district?: string | null;
  city?: string | null;
  town?: string | null;
  village?: string | null;
  country?: string;
}

export interface NearbyLocation {
  slug: string;
  city?: string | null;
  town?: string | null;
  village?: string | null;
  district?: string | null;
  state: string;
}

export interface PageContent {
  intro: string;
  benefits: string[];
  whyChooseUs: { title: string; desc: string }[];
  faqs: { q: string; a: string }[];
  cta: string;
}

export interface PageSeo {
  title: string;
  description: string;
  keywords: string[];
  h1: string;
  canonicalPath: string;
}

const FIRM_NAME = "Vakil & Co.";

export function primaryPlace(loc: LocationData | NearbyLocation): string {
  return loc.city || loc.town || loc.village || loc.district || loc.state;
}

export function generatePageContent(service: ServiceInfo, loc: LocationData): PageContent {
  const city = primaryPlace(loc);
  const state = loc.state;
  const district = loc.district || state;
  const seed = `${service.slug}-${loc.slug}`;

  const intros = [
    `Looking for ${service.name} in ${city}? ${FIRM_NAME} provides professional ${service.name} services throughout ${city}, ${state}. Our experienced team of Chartered Accountants, Company Secretaries, and Advocates handle everything end-to-end — so you focus on your business while we handle the compliance.`,
    `${FIRM_NAME} offers trusted ${service.name} services in ${city}, ${state}. With a dedicated team of legal and compliance experts serving clients across ${district}, we make regulatory requirements simple, affordable, and stress-free.`,
    `Get reliable ${service.name} in ${city} with ${FIRM_NAME}. We have helped thousands of businesses and individuals across ${state} with their legal, tax, and compliance needs. Our transparent pricing and expert guidance ensure zero surprises from start to finish.`,
    `${service.name} in ${city} is now faster and more affordable with ${FIRM_NAME}. Our network of experienced professionals across ${district} specialises in end-to-end service with guaranteed compliance and dedicated support.`,
    `Struggling to navigate ${service.name} requirements in ${city}? Let ${FIRM_NAME} handle it. Our expert consultants in ${state} have processed hundreds of similar engagements and know exactly how to get you compliant — quickly and without hassle.`,
  ];

  const benefitSets = [
    [
      `Expert team of CAs, CSs, and Advocates dedicated to ${service.name.toLowerCase()} in ${city}`,
      "End-to-end support — from document preparation to government filing",
      "Transparent, fixed pricing with no hidden charges",
      "Fast turnaround with real-time status updates",
      `10,000+ clients served across ${state} and all major cities`,
      "Free initial consultation to assess your exact requirements",
    ],
    [
      `Specialised professionals with deep expertise in ${service.name.toLowerCase()}`,
      "100% online process — no office visits required",
      `Dedicated relationship manager for your ${city} account`,
      "Government-approved process with official filings",
      "Compliance guarantee — we take responsibility for accuracy",
      "Post-service support and reminders for future renewals",
    ],
    [
      `Lowest guaranteed fees for ${service.name} in ${city}`,
      "Same-day intake — submit documents and we start immediately",
      `Experienced team that has handled 500+ cases in ${district}`,
      "Legally compliant documentation and government submissions",
      "Regular updates via WhatsApp, email, and phone",
      `One-stop solution for all legal and compliance needs in ${state}`,
    ],
  ];

  const whyChooseUs = [
    { title: "Expert Team", desc: `Qualified CAs, CSs, and Advocates with specialised knowledge in ${service.name.toLowerCase()}.` },
    { title: "Transparent Pricing", desc: "Fixed all-inclusive fees — no surprises, no hidden costs, no add-ons." },
    { title: "Fast Turnaround", desc: `Government-approved timelines respected. We track every filing in ${city}.` },
    { title: "End-to-End Support", desc: "We handle everything from document collection to final certificate delivery." },
  ];

  const faqSets = [
    [
      { q: `How long does ${service.name} take in ${city}?`, a: `The typical timeline for ${service.name} in ${city} is 7–15 working days, depending on government processing times and document readiness. Our team works proactively to minimise delays.` },
      { q: `What is the cost of ${service.name} in ${city}?`, a: `Our all-inclusive fee for ${service.name} in ${city} starts at ${service.price}. This covers professional fees, government fees, and all filings. No hidden charges.` },
      { q: `Can I get ${service.name} done online in ${city}?`, a: `Yes, the entire process for ${service.name} in ${city} is 100% online. You submit documents digitally, and we handle all government filings. You receive updates at every stage.` },
      { q: `Do I need to visit any government office in ${city}?`, a: `In most cases, no physical visit is required. Our experts handle all government submissions online on your behalf. We will notify you if any in-person step is necessary.` },
      { q: `Is ${service.name} mandatory for businesses in ${state}?`, a: `Depending on your business type and turnover, ${service.name} may be mandatory under applicable laws. Our consultants can assess your specific situation and advise accordingly.` },
    ],
    [
      { q: `Why should I choose ${FIRM_NAME} for ${service.name} in ${city}?`, a: `${FIRM_NAME} has served thousands of clients across ${state} with expert ${service.name.toLowerCase()} services. Our dedicated team, transparent pricing, and proven track record make us the trusted choice in ${city}.` },
      { q: `What documents do I need for ${service.name}?`, a: `The documents required depend on your specific case. Generally, identity proof, address proof, and relevant business/personal documents are needed. Contact us for a complete checklist tailored to your situation.` },
      { q: `Can ${FIRM_NAME} handle ${service.name} for clients outside ${city}?`, a: `Yes, we serve clients across ${state} and all major cities in India. Our online process means location is no barrier. Clients from ${district} regularly use our services.` },
      { q: `How do I track the progress of my ${service.name} application?`, a: `We provide real-time updates via WhatsApp, email, and phone. Your dedicated relationship manager will keep you informed at every step of the process.` },
      { q: `What if my ${service.name} application receives a query from authorities?`, a: `In the rare case of a query or objection from authorities, our team handles all responses and re-submissions at no additional cost. We stand behind our work.` },
    ],
  ];

  const ctas = [
    `Start your ${service.name} in ${city} today. Our experts are ready to guide you — book a free consultation now.`,
    `Get your ${service.name} done right in ${city}. Talk to an expert for free and get a customised plan for your situation.`,
    `Don't let compliance slow your business in ${city}. Contact ${FIRM_NAME} now for fast, expert service.`,
  ];

  return {
    intro: pick(intros, seed + "-intro"),
    benefits: pick(benefitSets, seed + "-benefits"),
    whyChooseUs,
    faqs: pick(faqSets, seed + "-faq"),
    cta: pick(ctas, seed + "-cta"),
  };
}

export function generatePageSeo(service: ServiceInfo, loc: LocationData): PageSeo {
  const city = primaryPlace(loc);
  const state = loc.state;
  const seed = `${service.slug}-${loc.slug}`;

  const titles = [
    `${service.name} in ${city} | Expert Legal Services | ${FIRM_NAME}`,
    `${service.name} in ${city}, ${state} | Vakil & Co. Legal Associates`,
    `Best ${service.name} in ${city} | Affordable CA & Legal Services`,
  ];

  const descriptions = [
    `Professional ${service.name} in ${city}, ${state}. Expert CAs, CSs, and Advocates. Transparent pricing at ${service.price}. Fast turnaround. Book free consultation.`,
    `Get ${service.name} in ${city} from certified professionals. ${FIRM_NAME} offers end-to-end compliance support across ${state}. Starting at ${service.price}.`,
    `Trusted ${service.name} services in ${city}, ${state}. 10,000+ satisfied clients. Affordable fees from ${service.price}. Contact us for a free assessment today.`,
  ];

  return {
    title: pick(titles, seed + "-title"),
    description: pick(descriptions, seed + "-desc"),
    keywords: [
      `${service.name} in ${city}`,
      `${service.name} ${city}`,
      `${service.name} ${state}`,
      service.name,
      `${city} legal services`,
      `${city} CA services`,
    ],
    h1: `${service.name} in ${city}`,
    canonicalPath: `/${service.slug}/${loc.slug}`,
  };
}

export function generateJsonLd(service: ServiceInfo, loc: LocationData, faqs: { q: string; a: string }[]): object[] {
  const city = primaryPlace(loc);
  const baseUrl = "https://vakil.co.in";
  const pageUrl = `${baseUrl}/${service.slug}/${loc.slug}`;

  const org = {
    "@type": "Organization",
    "@id": `${baseUrl}/#org`,
    name: FIRM_NAME,
    url: baseUrl,
    telephone: "+91-1800-123-4567",
    address: { "@type": "PostalAddress", addressCountry: "IN", addressRegion: loc.state },
  };

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: baseUrl },
      { "@type": "ListItem", position: 2, name: service.categoryTitle, item: `${baseUrl}/services/${service.categoryId}` },
      { "@type": "ListItem", position: 3, name: service.name, item: `${baseUrl}/services/${service.categoryId}/${service.slug}` },
      { "@type": "ListItem", position: 4, name: city, item: pageUrl },
    ],
  };

  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `${service.name} in ${city}`,
    description: service.description,
    provider: org,
    areaServed: { "@type": "City", name: city, containedInPlace: { "@type": "State", name: loc.state } },
    offers: { "@type": "Offer", price: service.price.replace(/[₹,]/g, ""), priceCurrency: "INR" },
    url: pageUrl,
  };

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return [breadcrumb, serviceSchema, faqSchema];
}
