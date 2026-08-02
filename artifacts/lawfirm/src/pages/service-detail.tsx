import { useState } from "react";
import { useRoute, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2, Clock, FileText, IndianRupee, ChevronDown,
  ArrowLeft, ArrowRight, Shield, Phone, Mail, Star,
  ListChecks, ClipboardList, Banknote, HelpCircle, Info
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SERVICES_DATA } from "@/data/services";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { getServiceDetail } from "@/data/service-details";
import { toSlug } from "@/lib/slug";
import NotFound from "./not-found";
import { Helmet } from "react-helmet-async";

const TABS = [
  { id: "overview",   label: "Overview",   icon: Info },
  { id: "process",    label: "Process",    icon: ListChecks },
  { id: "documents",  label: "Documents",  icon: ClipboardList },
  { id: "charges",    label: "Charges",    icon: Banknote },
  { id: "faq",        label: "FAQ",        icon: HelpCircle },
] as const;

type Tab = typeof TABS[number]["id"];

export default function ServiceDetail() {
  const [match, params] = useRoute("/services/:catId/:slug");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", email: "" });
  const [submitted, setSubmitted] = useState(false);
  const settings = useSiteSettings();

  if (!match) return <NotFound />;

  const { catId, slug } = params as { catId: string; slug: string };
  const cat = SERVICES_DATA[catId as keyof typeof SERVICES_DATA];
  if (!cat) return <NotFound />;

  const service = cat.services.find(s => toSlug(s.name) === slug);
  if (!service) return <NotFound />;

  const detail = getServiceDetail(catId, slug, service.name, service.price, service.description);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  const relatedServices = cat.services
    .filter(s => toSlug(s.name) !== slug)
    .slice(0, 4);

  const metaTitle = `${service.name} in India | ${service.price} | Vakil & Co. Legal Associates`;
  const metaDescription = `${service.description} Get ${service.name} done online with India's trusted legal platform. Expert ${cat.title} lawyers, fast processing. Starting at ${service.price}. Book free consultation.`;
  const canonicalUrl = `https://vakil.co.in/services/${catId}/${slug}`;
  const metaKeywords = `${service.name}, ${service.name} India, ${service.name} online, ${cat.title}, legal services India, Vakil and Co`;

  return (
    <>
    <Helmet>
      <title>{metaTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="keywords" content={metaKeywords} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Vakil & Co. Legal Associates" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <script type="application/ld+json">{JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Service",
        "name": service.name,
        "description": service.description,
        "provider": {
          "@type": "LegalService",
          "name": "Vakil & Co. Legal Associates",
          "url": "https://vakil.co.in",
          "telephone": settings.phone_primary
        },
        "offers": {
          "@type": "Offer",
          "price": service.price.replace(/[₹,]/g, "").split("/")[0].trim(),
          "priceCurrency": "INR"
        },
        "areaServed": {
          "@type": "Country",
          "name": "India"
        },
        "url": canonicalUrl
      })}</script>
    </Helmet>
    <div className="w-full pb-24 bg-gray-50">

      {/* Hero */}
      <div className="bg-primary relative overflow-hidden pt-20 pb-16">
        <div className="absolute inset-0 opacity-5 bg-[repeating-linear-gradient(45deg,#fff,#fff_1px,transparent_0,transparent_50%)] bg-[length:12px_12px]" />
        <div className="container mx-auto px-4 md:px-6 relative z-10">

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-white/50 text-xs mb-6 flex-wrap">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link href={`/services/${catId}`} className="hover:text-white transition-colors">{cat.title}</Link>
            <span>/</span>
            <span className="text-white/80">{service.name}</span>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 items-start">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">{cat.icon}</span>
                <span className="text-secondary text-sm font-semibold uppercase tracking-wider">{cat.title}</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-white mb-3 leading-tight">
                {service.name}
              </h1>
              <p className="text-white/70 text-lg mb-6 leading-relaxed">
                {detail.tagline}
              </p>

              {/* Key stats */}
              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Clock size={16} className="text-secondary" />
                  <span>{detail.timeRequired}</span>
                </div>
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <Shield size={16} className="text-secondary" />
                  <span>{detail.validity}</span>
                </div>
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <IndianRupee size={16} className="text-secondary" />
                  <span>Starting at {service.price}</span>
                </div>
              </div>
            </div>

            {/* Quick action badge */}
            <div className="hidden lg:flex justify-end">
              <div className="bg-secondary/20 border border-secondary/30 rounded-2xl p-5 text-center backdrop-blur-sm">
                <div className="text-secondary font-bold text-2xl mb-1">{service.price}</div>
                <div className="text-white/60 text-xs mb-3">All-inclusive government + service fee</div>
                <a href="#cta-form">
                  <Button className="w-full bg-secondary text-primary hover:bg-secondary/90 font-bold">
                    Get Started Now
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="container mx-auto px-4 md:px-6 -mt-2 relative z-20">
        <div className="flex flex-col lg:flex-row gap-8 items-start">

          {/* Left — tabs */}
          <div className="flex-1 min-w-0">

            {/* Tab nav */}
            <div className="bg-white rounded-2xl shadow-sm border border-border mb-6 overflow-hidden">
              <div className="flex overflow-x-auto">
                {TABS.map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-2 px-5 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors flex-1 justify-center ${
                        activeTab === tab.id
                          ? "border-secondary text-secondary bg-secondary/5"
                          : "border-transparent text-gray-500 hover:text-primary"
                      }`}
                    >
                      <Icon size={15} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
              >

                {/* OVERVIEW */}
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-border">
                      <h2 className="text-xl font-serif font-bold text-primary mb-4">About This Service</h2>
                      <p className="text-gray-600 leading-relaxed text-sm">{detail.overview}</p>

                      {detail.eligibility && (
                        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                          <div className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Eligibility</div>
                          <p className="text-sm text-blue-800">{detail.eligibility}</p>
                        </div>
                      )}
                    </div>

                    {detail.benefits.length > 0 && (
                      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-border">
                        <h2 className="text-xl font-serif font-bold text-primary mb-5">Key Benefits</h2>
                        <div className="grid sm:grid-cols-2 gap-3">
                          {detail.benefits.map((b, i) => (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="flex items-start gap-3 p-3 rounded-xl bg-green-50 border border-green-100"
                            >
                              <CheckCircle2 size={16} className="text-green-600 shrink-0 mt-0.5" />
                              <span className="text-sm text-gray-700">{b}</span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* PROCESS */}
                {activeTab === "process" && (
                  <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-border">
                    <h2 className="text-xl font-serif font-bold text-primary mb-6">Step-by-Step Process</h2>
                    <div className="relative">
                      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-100" />
                      <div className="space-y-0">
                        {detail.process.map((step, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -16 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.07 }}
                            className="flex gap-5 pb-8 last:pb-0 relative"
                          >
                            <div className="shrink-0 w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold z-10">
                              {i + 1}
                            </div>
                            <div className="flex-1 pt-1.5">
                              <h3 className="font-semibold text-primary text-sm mb-1.5">{step.title}</h3>
                              <p className="text-sm text-gray-600 leading-relaxed">{step.description}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
                      <Clock size={18} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="text-sm font-semibold text-amber-800">Estimated Time</div>
                        <div className="text-sm text-amber-700">{detail.timeRequired}</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* DOCUMENTS */}
                {activeTab === "documents" && (
                  <div className="space-y-6">
                    <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-border">
                      <h2 className="text-xl font-serif font-bold text-primary mb-5">Documents Required</h2>
                      <div className="grid sm:grid-cols-2 gap-2.5">
                        {detail.documentsRequired.map((doc, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.04 }}
                            className="flex items-start gap-3 p-3 rounded-xl border border-border bg-gray-50 hover:bg-white hover:shadow-sm transition-all"
                          >
                            <FileText size={15} className="text-secondary shrink-0 mt-0.5" />
                            <span className="text-sm text-gray-700">{doc}</span>
                          </motion.div>
                        ))}
                      </div>

                      <div className="mt-6 p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
                        All documents should be self-attested. Originals may be required for verification at government offices.
                      </div>
                    </div>

                    {detail.formsToFill.length > 0 && (
                      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-border">
                        <h2 className="text-xl font-serif font-bold text-primary mb-5">Forms to be Filed</h2>
                        <div className="space-y-2.5">
                          {detail.formsToFill.map((form, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-gray-50">
                              <ClipboardList size={15} className="text-primary shrink-0 mt-0.5" />
                              <span className="text-sm text-gray-700">{form}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* CHARGES */}
                {activeTab === "charges" && (
                  <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-border">
                    <h2 className="text-xl font-serif font-bold text-primary mb-6">Fee Structure</h2>
                    <div className="overflow-hidden rounded-xl border border-border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-primary text-white">
                            <th className="text-left py-3 px-4 font-medium">Description</th>
                            <th className="text-right py-3 px-4 font-medium">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {detail.charges.map((c, i) => (
                            <tr key={i} className="hover:bg-gray-50 transition-colors">
                              <td className="py-3 px-4 text-gray-700">
                                {c.item}
                                {c.note && <div className="text-xs text-gray-400 mt-0.5">{c.note}</div>}
                              </td>
                              <td className="py-3 px-4 text-right font-semibold text-primary">{c.amount}</td>
                            </tr>
                          ))}
                          <tr className="bg-secondary/10">
                            <td className="py-3 px-4 font-bold text-primary">Total (Government fee included)</td>
                            <td className="py-3 px-4 text-right font-bold text-secondary">{service.price}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-5 grid sm:grid-cols-3 gap-3">
                      <div className="p-3 bg-green-50 border border-green-100 rounded-xl text-center">
                        <CheckCircle2 size={18} className="text-green-600 mx-auto mb-1" />
                        <div className="text-xs font-semibold text-green-800">No Hidden Charges</div>
                      </div>
                      <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-center">
                        <Shield size={18} className="text-blue-600 mx-auto mb-1" />
                        <div className="text-xs font-semibold text-blue-800">Government Fees at Actuals</div>
                      </div>
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center">
                        <Star size={18} className="text-amber-600 mx-auto mb-1" />
                        <div className="text-xs font-semibold text-amber-800">Free Query Resolution</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* FAQ */}
                {activeTab === "faq" && (
                  <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-border">
                    <h2 className="text-xl font-serif font-bold text-primary mb-6">Frequently Asked Questions</h2>
                    <div className="space-y-3">
                      {detail.faq.map((item, i) => (
                        <div key={i} className="border border-border rounded-xl overflow-hidden">
                          <button
                            onClick={() => setOpenFaq(openFaq === i ? null : i)}
                            className="w-full flex items-start justify-between gap-4 p-4 text-left hover:bg-gray-50 transition-colors"
                          >
                            <span className="text-sm font-semibold text-primary flex-1">{item.q}</span>
                            <ChevronDown
                              size={16}
                              className={`text-gray-400 shrink-0 mt-0.5 transition-transform duration-200 ${openFaq === i ? "rotate-180 text-secondary" : ""}`}
                            />
                          </button>
                          <AnimatePresence>
                            {openFaq === i && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                              >
                                <p className="px-4 pb-4 text-sm text-gray-600 leading-relaxed border-t border-border pt-3">
                                  {item.a}
                                </p>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Related services */}
            {relatedServices.length > 0 && (
              <div className="mt-8 bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-border">
                <h2 className="text-xl font-serif font-bold text-primary mb-5">Related Services in {cat.title}</h2>
                <div className="grid sm:grid-cols-2 gap-3">
                  {relatedServices.map(s => (
                    <Link
                      key={s.name}
                      href={`/services/${catId}/${toSlug(s.name)}`}
                      className="flex items-center justify-between p-4 rounded-xl border border-border hover:border-secondary/50 hover:bg-secondary/5 transition-all group"
                    >
                      <div>
                        <div className="text-sm font-semibold text-primary group-hover:text-secondary transition-colors">{s.name}</div>
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{s.description}</div>
                      </div>
                      <ArrowRight size={14} className="text-gray-300 group-hover:text-secondary transition-colors shrink-0 ml-3" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Back to category */}
            <div className="mt-6">
              <Link
                href={`/services/${catId}`}
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-primary transition-colors"
              >
                <ArrowLeft size={14} />
                Back to all {cat.title} services
              </Link>
            </div>
          </div>

          {/* Right — sticky CTA */}
          <div className="lg:w-[340px] shrink-0 lg:sticky lg:top-24 space-y-5" id="cta-form">

            {/* Consultation form */}
            <div className="bg-primary rounded-2xl p-6 shadow-xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 rounded-full blur-3xl" />
              <h3 className="font-serif font-bold text-xl mb-1 relative z-10">Get Started Today</h3>
              <p className="text-white/60 text-xs mb-5 relative z-10">Fill the form and our expert will call you within 2 hours</p>

              {submitted ? (
                <div className="text-center py-6 relative z-10">
                  <CheckCircle2 size={40} className="text-secondary mx-auto mb-3" />
                  <div className="font-semibold text-white">Request Received!</div>
                  <div className="text-white/60 text-xs mt-1">We'll call you within 2 business hours.</div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3 relative z-10">
                  <input
                    required
                    placeholder="Your full name"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-secondary"
                    value={formData.name}
                    onChange={e => setFormData(d => ({ ...d, name: e.target.value }))}
                  />
                  <input
                    required
                    type="tel"
                    placeholder="Mobile number"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-secondary"
                    value={formData.phone}
                    onChange={e => setFormData(d => ({ ...d, phone: e.target.value }))}
                  />
                  <input
                    type="email"
                    placeholder="Email address (optional)"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-secondary"
                    value={formData.email}
                    onChange={e => setFormData(d => ({ ...d, email: e.target.value }))}
                  />
                  <Button type="submit" className="w-full bg-secondary text-primary hover:bg-secondary/90 font-bold h-11">
                    Get a Free Callback
                  </Button>
                </form>
              )}
            </div>

            {/* Quick info card */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-border">
              <h4 className="font-semibold text-primary text-sm mb-4">Service Summary</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2"><Clock size={14} />Timeline</span>
                  <span className="font-medium text-primary text-right max-w-[160px] text-xs">{detail.timeRequired}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2"><Shield size={14} />Validity</span>
                  <span className="font-medium text-primary text-right max-w-[160px] text-xs">{detail.validity}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500 flex items-center gap-2"><IndianRupee size={14} />Price</span>
                  <span className="font-bold text-secondary">{service.price}</span>
                </div>
              </div>
            </div>

            {/* Contact strip */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-border">
              <div className="text-xs text-gray-500 mb-3 font-medium">Need help? Talk to us directly</div>
              <a href={`tel:${settings.phone_primary.replace(/[^\d+]/g, "")}`} className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl hover:bg-primary/10 transition-colors mb-2">
                <Phone size={16} className="text-secondary" />
                <span className="text-sm font-medium text-primary">{settings.phone_primary}</span>
              </a>
              <a href={`mailto:${settings.email_primary}`} className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl hover:bg-primary/10 transition-colors">
                <Mail size={16} className="text-secondary" />
                <span className="text-sm font-medium text-primary">{settings.email_primary}</span>
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
    </>
  );
}
