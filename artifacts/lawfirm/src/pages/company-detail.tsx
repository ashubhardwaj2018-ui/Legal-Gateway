import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Building2, Calendar, Activity, ChevronRight, MapPin, IndianRupee, Briefcase, Hash } from "lucide-react";

interface Company {
  id: number;
  cin: string;
  companyName: string;
  slug: string;
  incorporationDate: string | null;
  companyStatus: string | null;
  companyType: string | null;
  authorizedCapital: string | null;
  paidUpCapital: string | null;
  registeredOffice: string | null;
  state: string | null;
  district: string | null;
  city: string | null;
  pincode: string | null;
  industry: string | null;
  roc: string | null;
  email: string | null;
}

interface Related {
  id: number;
  companyName: string;
  slug: string;
  companyType: string | null;
  companyStatus: string | null;
  state: string | null;
  city: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  "active": "bg-green-100 text-green-800 border-green-200",
  "strike off": "bg-red-100 text-red-800 border-red-200",
  "dissolved": "bg-gray-100 text-gray-700 border-gray-200",
};

function statusColor(s: string | null) {
  if (!s) return "bg-gray-100 text-gray-500 border-gray-200";
  return STATUS_COLORS[s.toLowerCase()] ?? "bg-blue-100 text-blue-800 border-blue-200";
}

function DetailRow({ label, value, icon: Icon }: { label: string; value: string | null | undefined; icon?: React.ElementType }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      {Icon && <Icon size={15} className="text-[#c9a227] mt-0.5 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</div>
        <div className="text-gray-900 text-sm font-medium mt-0.5 break-words">{value}</div>
      </div>
    </div>
  );
}

export default function CompanyDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [company, setCompany] = useState<Company | null>(null);
  const [related, setRelated] = useState<Related[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true); setNotFound(false);
    fetch(`/api/companies/${slug}`)
      .then(r => { if (r.status === 404) { setNotFound(true); return null; } return r.json(); })
      .then(d => { if (d) { setCompany(d.company); setRelated(d.related ?? []); } })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#0f2044] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !company) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <Building2 size={48} className="text-gray-300" />
        <h1 className="text-2xl font-bold text-gray-700">Company Not Found</h1>
        <p className="text-gray-500">The company you're looking for doesn't exist in our database.</p>
        <Link href="/indian-companies" className="text-[#c9a227] hover:text-[#a88318] font-medium">← Back to Search</Link>
      </div>
    );
  }

  const schemaOrg = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": company.companyName,
    "identifier": company.cin,
    "foundingDate": company.incorporationDate ?? undefined,
    "address": {
      "@type": "PostalAddress",
      "streetAddress": company.registeredOffice ?? undefined,
      "addressLocality": company.city ?? undefined,
      "addressRegion": company.state ?? undefined,
      "postalCode": company.pincode ?? undefined,
      "addressCountry": "IN",
    },
    "email": company.email ?? undefined,
  };

  return (
    <>
      <Helmet>
        <title>{company.companyName} — CIN {company.cin} | Indian Companies Database | Vakil & Co.</title>
        <meta name="description" content={`${company.companyName} (CIN: ${company.cin}) — ${company.companyType ?? "Company"} registered in ${company.state ?? "India"}. Incorporation date: ${company.incorporationDate ?? "N/A"}. Status: ${company.companyStatus ?? "N/A"}.`} />
        <link rel="canonical" href={`/company/${company.slug}`} />
        <script type="application/ld+json">{JSON.stringify(schemaOrg)}</script>
      </Helmet>

      {/* Header */}
      <section className="bg-[#0f2044] text-white py-10 px-4">
        <div className="container mx-auto max-w-5xl">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-xs text-white/50 mb-5">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <ChevronRight size={12} />
            <Link href="/indian-companies" className="hover:text-white transition-colors">Indian Companies</Link>
            <ChevronRight size={12} />
            <span className="text-white/80 truncate max-w-[200px]">{company.companyName}</span>
          </nav>

          <div className="flex flex-wrap items-start gap-4">
            <div className="bg-white/10 p-3 rounded-xl">
              <Building2 size={32} className="text-[#c9a227]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {company.companyStatus && (
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${statusColor(company.companyStatus)}`}>
                    {company.companyStatus}
                  </span>
                )}
                {company.companyType && (
                  <span className="text-xs bg-white/10 text-white px-2.5 py-1 rounded-full font-medium">{company.companyType}</span>
                )}
              </div>
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-white leading-tight">{company.companyName}</h1>
              <p className="text-white/60 text-sm mt-1 font-mono">{company.cin}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="container mx-auto max-w-5xl px-4 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Left: Main details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Identity */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="font-serif font-bold text-[#0f2044] text-lg mb-4 pb-3 border-b border-gray-100">Company Details</h2>
              <DetailRow label="Company Name" value={company.companyName} icon={Building2} />
              <DetailRow label="CIN" value={company.cin} icon={Hash} />
              <DetailRow label="Company Type" value={company.companyType} icon={Briefcase} />
              <DetailRow label="Company Status" value={company.companyStatus} icon={Activity} />
              <DetailRow label="Date of Incorporation" value={company.incorporationDate} icon={Calendar} />
              <DetailRow label="Industry" value={company.industry} icon={Briefcase} />
              <DetailRow label="ROC" value={company.roc} icon={Building2} />
            </div>

            {/* Capital */}
            {(company.authorizedCapital || company.paidUpCapital) && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="font-serif font-bold text-[#0f2044] text-lg mb-4 pb-3 border-b border-gray-100">Capital Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  {company.authorizedCapital && (
                    <div className="bg-[#0f2044]/5 rounded-xl p-4 text-center">
                      <IndianRupee size={20} className="text-[#c9a227] mx-auto mb-2" />
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Authorised Capital</div>
                      <div className="font-bold text-[#0f2044] text-sm">{company.authorizedCapital}</div>
                    </div>
                  )}
                  {company.paidUpCapital && (
                    <div className="bg-[#c9a227]/10 rounded-xl p-4 text-center">
                      <IndianRupee size={20} className="text-[#c9a227] mx-auto mb-2" />
                      <div className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-1">Paid-Up Capital</div>
                      <div className="font-bold text-[#0f2044] text-sm">{company.paidUpCapital}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Address */}
            {(company.registeredOffice || company.state) && (
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <h2 className="font-serif font-bold text-[#0f2044] text-lg mb-4 pb-3 border-b border-gray-100">Registered Office</h2>
                <div className="flex items-start gap-3">
                  <MapPin size={18} className="text-[#c9a227] mt-0.5 shrink-0" />
                  <div className="text-gray-700 text-sm leading-relaxed">
                    {[company.registeredOffice, company.city, company.district, company.state, company.pincode].filter(Boolean).join(", ")}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Quick info card */}
          <div className="space-y-5">
            <div className="bg-[#0f2044] text-white rounded-xl p-5">
              <h3 className="font-semibold text-sm mb-4 text-[#c9a227] uppercase tracking-wide">Quick Facts</h3>
              <div className="space-y-3">
                {[
                  { label: "State", value: company.state },
                  { label: "City", value: company.city },
                  { label: "Pincode", value: company.pincode },
                  { label: "Email", value: company.email },
                ].filter(f => f.value).map(f => (
                  <div key={f.label}>
                    <div className="text-white/50 text-xs">{f.label}</div>
                    <div className="text-white text-sm font-medium mt-0.5">{f.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#c9a227]/10 to-[#0f2044]/5 rounded-xl border border-[#c9a227]/20 p-5">
              <h3 className="font-semibold text-[#0f2044] text-sm mb-2">Need Legal Help?</h3>
              <p className="text-gray-600 text-xs leading-relaxed mb-4">Our experts can assist with company compliance, filings, and legal services.</p>
              <Link href="/services/business-setup" className="block text-center bg-[#0f2044] text-white rounded-lg py-2.5 text-sm font-medium hover:bg-[#c9a227] hover:text-[#0f2044] transition-colors">
                Consult an Expert
              </Link>
            </div>
          </div>
        </div>

        {/* Related companies */}
        {related.length > 0 && (
          <div className="mt-10">
            <h2 className="font-serif font-bold text-[#0f2044] text-xl mb-5">
              Related Companies in {company.state}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {related.map(r => (
                <Link
                  key={r.id}
                  href={`/company/${r.slug}`}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#c9a227] hover:shadow-md transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className="bg-[#0f2044]/10 p-2 rounded-lg shrink-0">
                      <Building2 size={16} className="text-[#0f2044]" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-[#0f2044] text-sm group-hover:text-[#c9a227] transition-colors line-clamp-2">{r.companyName}</div>
                      <div className="text-xs text-gray-500 mt-1">{r.city ?? r.state ?? ""}</div>
                      {r.companyStatus && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block ${statusColor(r.companyStatus)}`}>
                          {r.companyStatus}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
