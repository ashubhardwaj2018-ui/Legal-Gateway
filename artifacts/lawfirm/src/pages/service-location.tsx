import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { CheckCircle2, ChevronRight, MapPin, Clock, IndianRupee, Phone, Shield, Star, FileText, Users, ArrowRight, ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getServiceBySlug, getServicesByCategory, ALL_SERVICES, SERVICE_INDEX } from "@/data/service-index";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import {
  generatePageContent,
  generatePageSeo,
  generateJsonLd,
  primaryPlace,
  type LocationData,
  type NearbyLocation,
} from "@/lib/content-engine";
import { getServiceDetail } from "@/data/service-details";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function fetchLocation(slug: string): Promise<LocationData> {
  return fetch(`${BASE}/api/locations/${slug}`).then((r) => {
    if (!r.ok) throw new Error("Not found");
    return r.json() as Promise<LocationData>;
  });
}

function fetchNearby(slug: string): Promise<NearbyLocation[]> {
  return fetch(`${BASE}/api/locations/${slug}/nearby?limit=16`).then((r) =>
    r.ok ? (r.json() as Promise<NearbyLocation[]>) : [],
  );
}

function ConsultForm({ service, city }: { service: string; city: string }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch(`${BASE}/api/consultations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        serviceCategory: "pseo",
        serviceInterest: `${service} in ${city}`,
        message: `Request via ${service} in ${city} page`,
      }),
    });
    setSent(true);
  };

  if (sent) {
    return (
      <div className="text-center py-6">
        <CheckCircle2 className="text-green-500 mx-auto mb-3" size={40} />
        <p className="font-semibold text-[#0f2044]">Request Submitted!</p>
        <p className="text-sm text-gray-500 mt-1">Our expert will call you within 2 hours.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <input
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20"
        placeholder="Your full name"
        value={form.name}
        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        required
      />
      <input
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20"
        placeholder="Mobile number"
        value={form.phone}
        onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
        required
      />
      <input
        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20"
        placeholder="Email address"
        type="email"
        value={form.email}
        onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
        required
      />
      <Button type="submit" className="w-full bg-[#c9a227] hover:bg-[#b8911f] text-[#0f2044] font-bold">
        Get Free Consultation
      </Button>
      <p className="text-xs text-gray-400 text-center">Free consultation · No spam · 2-hour callback</p>
    </form>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="font-medium text-[#0f2044] text-sm pr-4">{q}</span>
        <ChevronDown size={16} className={`shrink-0 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed">{a}</div>}
    </div>
  );
}

export default function ServiceLocation() {
  const params = useParams<{ serviceSlug: string; locationSlug: string }>();
  const settings = useSiteSettings();
  const serviceSlug = params.serviceSlug ?? "";
  const locationSlug = params.locationSlug ?? "";

  const service = getServiceBySlug(serviceSlug);

  const { data: loc, isLoading: locLoading, isError } = useQuery({
    queryKey: ["location", locationSlug],
    queryFn: () => fetchLocation(locationSlug),
    enabled: !!locationSlug,
    retry: false,
  });

  const { data: nearby = [] } = useQuery({
    queryKey: ["nearby", locationSlug],
    queryFn: () => fetchNearby(locationSlug),
    enabled: !!locationSlug && !!loc,
  });

  if (!service) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">
        Service not found.
      </div>
    );
  }

  if (locLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-[#0f2044] font-medium">Loading…</div>
      </div>
    );
  }

  if (isError || !loc) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <p className="text-gray-500">Location page not found.</p>
        <Link href="/" className="text-[#c9a227] underline text-sm">Go Home</Link>
      </div>
    );
  }

  const city = primaryPlace(loc);
  const content = generatePageContent(service, loc);
  const seo = generatePageSeo(service, loc);
  const jsonLds = generateJsonLd(service, loc, content.faqs);
  const details = getServiceDetail(service.categoryId, service.slug, service.name, service.price, service.description);
  const relatedServices = getServicesByCategory(service.categoryId)
    .filter((s) => s.slug !== service.slug)
    .slice(0, 6);

  // Cross-category popular services (exclude current category)
  const POPULAR_SLUGS = ["private-limited-company","gst-registration","trademark-registration","fssai-registration-online","individual-income-tax-filing","legal-notice","msmessi-registration","gst-filing"];
  const popularServices = POPULAR_SLUGS
    .map((sl) => SERVICE_INDEX[sl])
    .filter((s) => !!s && s.categoryId !== service.categoryId && s.slug !== service.slug)
    .slice(0, 5);

  // Professional consultation slugs
  const PROF_SLUGS = ["talk-to-a-lawyer","talk-to-a-ca","talk-to-a-cs","talk-to-an-iptrademark-lawyer"];
  const professionals = PROF_SLUGS
    .map((sl) => SERVICE_INDEX[sl])
    .filter((s) => !!s && s.slug !== service.slug)
    .slice(0, 4);

  const pageUrl = `https://legalfilingindia.com/${serviceSlug}/${locationSlug}`;

  return (
    <>
      <Helmet>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <meta name="keywords" content={seo.keywords.join(", ")} />
        <meta name="robots" content={loc?.seoPriority ? "index, follow" : "noindex, follow"} />
        <link rel="canonical" href={pageUrl} />
        <meta property="og:title" content={seo.title} />
        <meta property="og:description" content={seo.description} />
        <meta property="og:url" content={pageUrl} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Legal Filing India" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={seo.title} />
        <meta name="twitter:description" content={seo.description} />
        {jsonLds.map((ld, i) => (
          <script key={i} type="application/ld+json">
            {JSON.stringify(ld)}
          </script>
        ))}
      </Helmet>

      {/* Breadcrumb + Hero */}
      <div className="bg-[#0f2044] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-white/50 mb-6 flex-wrap">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <ChevronRight size={12} />
            <Link href={`/services/${service.categoryId}`} className="hover:text-white transition-colors">{service.categoryTitle}</Link>
            <ChevronRight size={12} />
            <Link href={`/services/${service.categoryId}/${service.slug}`} className="hover:text-white transition-colors">{service.name}</Link>
            <ChevronRight size={12} />
            <span className="text-white/80">{city}</span>
          </nav>

          <div className="flex flex-col lg:flex-row lg:items-start gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-[#c9a227] text-xs font-semibold uppercase tracking-wider mb-3">
                <MapPin size={14} />
                {loc.state}{loc.district && loc.district !== city ? ` · ${loc.district}` : ""}
              </div>
              <h1 className="text-3xl lg:text-4xl font-serif font-bold mb-4 leading-tight">
                {seo.h1}
              </h1>
              <p className="text-white/70 text-base mb-6 max-w-2xl leading-relaxed">{content.intro}</p>

              <div className="flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                  <IndianRupee size={14} className="text-[#c9a227]" />
                  <span>Starting at <strong className="text-[#c9a227]">{service.price}</strong></span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                  <Clock size={14} className="text-[#c9a227]" />
                  <span>7–15 working days</span>
                </div>
                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-4 py-2">
                  <Shield size={14} className="text-[#c9a227]" />
                  <span>100% compliant</span>
                </div>
              </div>
            </div>

            {/* Price card */}
            <div className="lg:w-72 shrink-0 bg-white text-[#0f2044] rounded-2xl p-6 shadow-2xl">
              <div className="text-3xl font-serif font-bold text-[#c9a227] mb-1">{service.price}</div>
              <p className="text-xs text-gray-500 mb-4">All-inclusive, no hidden charges</p>
              <Button
                className="w-full bg-[#0f2044] hover:bg-[#1a3060] text-white font-bold mb-3"
                onClick={() => document.getElementById("consult-form")?.scrollIntoView({ behavior: "smooth" })}
              >
                Get Started Now
              </Button>
              <a href={`tel:${settings.phone_primary.replace(/[^\d+]/g, "")}`} className="flex items-center justify-center gap-2 text-sm text-[#0f2044] font-medium hover:text-[#c9a227] transition-colors">
                <Phone size={14} />
                {settings.phone_primary}
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col lg:flex-row gap-10">
          {/* Main content */}
          <div className="flex-1 min-w-0 space-y-10">

            {/* Why Choose Us */}
            <section>
              <h2 className="text-2xl font-serif font-bold text-[#0f2044] mb-6">Why Choose Legal Filing India in {city}?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {content.whyChooseUs.map((item) => (
                  <div key={item.title} className="flex gap-4 p-5 rounded-xl border border-gray-100 bg-gray-50">
                    <div className="w-10 h-10 rounded-xl bg-[#0f2044]/5 flex items-center justify-center shrink-0">
                      <Star size={18} className="text-[#c9a227]" />
                    </div>
                    <div>
                      <div className="font-semibold text-[#0f2044] text-sm mb-1">{item.title}</div>
                      <div className="text-xs text-gray-500 leading-relaxed">{item.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Benefits */}
            <section>
              <h2 className="text-2xl font-serif font-bold text-[#0f2044] mb-5">Benefits of {service.name} in {city}</h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {content.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-3">
                    <CheckCircle2 size={18} className="text-[#c9a227] shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{b}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Process */}
            {details?.process && details.process.length > 0 && (
              <section>
                <h2 className="text-2xl font-serif font-bold text-[#0f2044] mb-6">Step-by-Step Process</h2>
                <div className="space-y-4">
                  {details.process.map((step, i) => (
                    <div key={i} className="flex gap-4 p-5 rounded-xl border border-gray-100 bg-gray-50">
                      <div className="w-8 h-8 rounded-full bg-[#0f2044] text-white text-sm font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </div>
                      <div>
                        <div className="font-semibold text-[#0f2044] text-sm mb-1">{step.title}</div>
                        <div className="text-xs text-gray-500 leading-relaxed">{step.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Documents */}
            {details?.documentsRequired && details.documentsRequired.length > 0 && (
              <section>
                <h2 className="text-2xl font-serif font-bold text-[#0f2044] mb-5">Documents Required</h2>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {details.documentsRequired.map((doc, i) => (
                    <li key={i} className="flex items-center gap-2.5 text-sm text-gray-700">
                      <FileText size={15} className="text-[#c9a227] shrink-0" />
                      {doc}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* FAQ */}
            <section>
              <h2 className="text-2xl font-serif font-bold text-[#0f2044] mb-5">Frequently Asked Questions</h2>
              <div className="space-y-3">
                {content.faqs.map((faq) => (
                  <FaqItem key={faq.q} q={faq.q} a={faq.a} />
                ))}
              </div>
            </section>

            {/* Related services in same category */}
            {relatedServices.length > 0 && (
              <section>
                <h2 className="text-2xl font-serif font-bold text-[#0f2044] mb-5">Other {service.categoryTitle} Services in {city}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {relatedServices.map((svc) => (
                    <Link
                      key={svc.slug}
                      href={`/${svc.slug}/${locationSlug}`}
                      className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-[#c9a227]/50 hover:bg-[#c9a227]/5 transition-all group"
                    >
                      <div>
                        <div className="font-medium text-[#0f2044] text-sm group-hover:text-[#c9a227] transition-colors">{svc.name} in {city}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{svc.price}</div>
                      </div>
                      <ArrowRight size={14} className="text-gray-300 group-hover:text-[#c9a227] transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Popular cross-category services */}
            {popularServices.length > 0 && (
              <section>
                <h2 className="text-2xl font-serif font-bold text-[#0f2044] mb-2">Popular Legal Services in {city}</h2>
                <p className="text-sm text-gray-500 mb-4">Frequently used by businesses in {city}, {loc.state}.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {popularServices.map((svc) => (
                    <Link
                      key={svc.slug}
                      href={`/${svc.slug}/${locationSlug}`}
                      className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-[#c9a227]/50 hover:bg-[#c9a227]/5 transition-all group"
                    >
                      <div>
                        <div className="font-medium text-[#0f2044] text-sm group-hover:text-[#c9a227] transition-colors">{svc.name} in {city}</div>
                        <div className="text-xs text-gray-400 mt-0.5">{svc.categoryTitle} · {svc.price}</div>
                      </div>
                      <ArrowRight size={14} className="text-gray-300 group-hover:text-[#c9a227] transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Talk to a professional */}
            {professionals.length > 0 && (
              <section className="bg-[#0f2044]/5 rounded-2xl p-6">
                <h2 className="text-xl font-serif font-bold text-[#0f2044] mb-1">Talk to a Professional in {city}</h2>
                <p className="text-sm text-gray-500 mb-4">Get instant expert advice from qualified lawyers, CAs, and CSs.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {professionals.map((svc) => (
                    <Link
                      key={svc.slug}
                      href={`/${svc.slug}/${locationSlug}`}
                      className="flex items-center justify-between p-4 rounded-xl bg-white border border-gray-200 hover:border-[#c9a227] hover:bg-[#c9a227]/5 transition-all group"
                    >
                      <div>
                        <div className="font-medium text-[#0f2044] text-sm group-hover:text-[#c9a227] transition-colors">{svc.name}</div>
                        <div className="text-xs text-gray-400 mt-0.5">Starts at {svc.price} · Same day</div>
                      </div>
                      <ArrowRight size={14} className="text-gray-300 group-hover:text-[#c9a227] transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Nearby cities */}
            {nearby.length > 0 && (
              <section>
                <h2 className="text-2xl font-serif font-bold text-[#0f2044] mb-2">
                  {service.name} in Nearby Areas
                </h2>
                <p className="text-sm text-gray-500 mb-4">We serve clients across {loc.state} — click any city for details.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {nearby.map((n) => {
                    const nCity = primaryPlace(n);
                    return (
                      <Link
                        key={n.slug}
                        href={`/${serviceSlug}/${n.slug}`}
                        className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-[#0f2044] hover:border-[#c9a227] hover:text-[#c9a227] hover:bg-[#c9a227]/5 transition-all text-center"
                      >
                        {nCity}
                      </Link>
                    );
                  })}
                </div>
                {/* State hub link */}
                <div className="mt-4">
                  <Link
                    href={`/state/${loc.state.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                    className="inline-flex items-center gap-1.5 text-sm text-[#c9a227] font-medium hover:underline"
                  >
                    <MapPin size={14} />
                    View all cities in {loc.state} →
                  </Link>
                </div>
              </section>
            )}

            {/* CTA banner */}
            <section className="bg-[#0f2044] rounded-2xl p-8 text-white text-center">
              <h2 className="text-2xl font-serif font-bold mb-3">{content.cta}</h2>
              <Button
                className="bg-[#c9a227] hover:bg-[#b8911f] text-[#0f2044] font-bold px-8"
                onClick={() => document.getElementById("consult-form")?.scrollIntoView({ behavior: "smooth" })}
              >
                Book Free Consultation
              </Button>
            </section>

          </div>

          {/* Sticky sidebar */}
          <div className="lg:w-80 shrink-0">
            <div className="lg:sticky lg:top-24 space-y-4">
              <div id="consult-form" className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                <h3 className="font-serif font-bold text-[#0f2044] text-lg mb-1">Get Started Today</h3>
                <p className="text-xs text-gray-500 mb-4">Fill the form and our expert will call you within 2 hours.</p>
                <ConsultForm service={service.name} city={city} />
              </div>

              {/* Quick info */}
              <div className="bg-[#0f2044]/5 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <IndianRupee size={16} className="text-[#c9a227] shrink-0" />
                  <div><span className="text-gray-500">Fees</span> · <span className="font-semibold text-[#0f2044]">{service.price}</span></div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Clock size={16} className="text-[#c9a227] shrink-0" />
                  <div><span className="text-gray-500">Timeline</span> · <span className="font-semibold text-[#0f2044]">7–15 days</span></div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Users size={16} className="text-[#c9a227] shrink-0" />
                  <div><span className="text-gray-500">Clients served</span> · <span className="font-semibold text-[#0f2044]">10,000+</span></div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <MapPin size={16} className="text-[#c9a227] shrink-0" />
                  <div><span className="text-gray-500">Location</span> · <span className="font-semibold text-[#0f2044]">{city}, {loc.state}</span></div>
                </div>
              </div>

              {/* Other services in this category */}
              {relatedServices.slice(0, 4).length > 0 && (
                <div className="border border-gray-200 rounded-xl p-4">
                  <h4 className="font-semibold text-[#0f2044] text-sm mb-3">More {service.categoryTitle} Services</h4>
                  <div className="space-y-2">
                    {relatedServices.slice(0, 4).map((s) => (
                      <Link
                        key={s.slug}
                        href={`/${s.slug}/${locationSlug}`}
                        className="flex items-center justify-between text-xs text-gray-600 hover:text-[#c9a227] transition-colors py-1"
                      >
                        <span>{s.name}</span>
                        <ArrowRight size={12} />
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
