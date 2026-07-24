import { useState, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Scale, Mail, Phone, Star, Award, BookOpen } from "lucide-react";
import { Link } from "wouter";

interface Lawyer { id: number; name: string; role: string; email: string | null; phone: string | null; department: string | null; bio: string | null; specializations: string | null; yearsOfExperience: number | null; barCouncilId: string | null; photo: string | null; linkedinUrl: string | null; }

const FALLBACK_LAWYERS = [
  { id: 1, name: "Adv. Rajesh Sharma", role: "Senior Partner", email: "rajesh@vakilco.in", phone: "+91 98765 43210", department: "Corporate & M&A", bio: "18+ years in corporate law, mergers & acquisitions, private equity, and cross-border transactions. Ex-counsel for multiple Fortune 500 India subsidiaries.", specializations: "Corporate Law,M&A,Private Equity,Joint Ventures", yearsOfExperience: 18, barCouncilId: "MH/1234/2006", photo: "https://api.dicebear.com/7.x/notionists/svg?seed=Rajesh&backgroundColor=dbeafe", linkedinUrl: null },
  { id: 2, name: "Adv. Priya Desai", role: "Partner", email: "priya@vakilco.in", phone: "+91 87654 32109", department: "Intellectual Property", bio: "12 years specialising in trademark, patent, copyright, and trade secrets. Has successfully defended IP rights for leading consumer brands and tech startups.", specializations: "Trademarks,Patents,Copyright,Domain Disputes", yearsOfExperience: 12, barCouncilId: "MH/5678/2012", photo: "https://api.dicebear.com/7.x/notionists/svg?seed=Priya&backgroundColor=fce7f3", linkedinUrl: null },
  { id: 3, name: "Adv. Vikram Singh", role: "Senior Partner", email: "vikram@vakilco.in", phone: "+91 76543 21098", department: "Real Estate & Property", bio: "22 years handling residential and commercial real estate transactions, property disputes, RERA compliance, and urban development law.", specializations: "Real Estate,RERA,Property Disputes,Construction Law", yearsOfExperience: 22, barCouncilId: "DL/9012/2002", photo: "https://api.dicebear.com/7.x/notionists/svg?seed=Vikram&backgroundColor=d1fae5", linkedinUrl: null },
  { id: 4, name: "Adv. Neha Gupta", role: "Associate Partner", email: "neha@vakilco.in", phone: "+91 65432 10987", department: "Family & Civil Law", bio: "15 years of expertise in matrimonial disputes, succession planning, adoption, guardianship, and all matters of family law across multiple High Courts.", specializations: "Family Law,Matrimonial,Succession,Adoption", yearsOfExperience: 15, barCouncilId: "MH/3456/2009", photo: "https://api.dicebear.com/7.x/notionists/svg?seed=Neha&backgroundColor=fef3c7", linkedinUrl: null },
  { id: 5, name: "Adv. Arun Kumar", role: "Partner", email: "arun@vakilco.in", phone: "+91 54321 09876", department: "Tax & Compliance", bio: "GST specialist with 10+ years experience in direct and indirect tax advisory, appeals, and representation before tax tribunals.", specializations: "GST,Income Tax,Tax Appeals,Compliance", yearsOfExperience: 10, barCouncilId: "KA/7890/2014", photo: "https://api.dicebear.com/7.x/notionists/svg?seed=Arun&backgroundColor=e0e7ff", linkedinUrl: null },
  { id: 6, name: "Adv. Shreya Menon", role: "Senior Associate", email: "shreya@vakilco.in", phone: "+91 43210 98765", department: "Startup & Fundraising", bio: "Focused on startup legal needs — incorporation, ESOP structuring, term sheets, VC agreements, and regulatory compliance for early and growth-stage companies.", specializations: "Startup Law,ESOP,Fundraising,VC Agreements", yearsOfExperience: 7, barCouncilId: "MH/2345/2017", photo: "https://api.dicebear.com/7.x/notionists/svg?seed=Shreya&backgroundColor=fce7f3", linkedinUrl: null },
];

export default function OurLawyers() {
  const [lawyers, setLawyers] = useState<Lawyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");

  useEffect(() => {
    fetch("/api/admin/team")
      .then(r => r.json())
      .then(d => {
        const team = Array.isArray(d) ? d.filter((m: Lawyer) => m.role?.toLowerCase().includes("adv") || m.department) : [];
        setLawyers(team.length > 0 ? team : FALLBACK_LAWYERS);
      })
      .catch(() => setLawyers(FALLBACK_LAWYERS))
      .finally(() => setLoading(false));
  }, []);

  const departments = ["All", ...Array.from(new Set(lawyers.map(l => l.department).filter(Boolean))) as string[]];
  const filtered = filter === "All" ? lawyers : lawyers.filter(l => l.department === filter);

  return (
    <>
      <Helmet>
        <title>Our Lawyers — Vakil & Co. Legal Associates</title>
        <meta name="description" content="Meet the expert legal team at Vakil & Co. — senior advocates, partners, and specialists in corporate law, IP, real estate, tax, family law, and more." />
      </Helmet>

      {/* Hero */}
      <section className="bg-[#0f2044] text-white py-20 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5"><div className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-[#c9a227] blur-3xl" /></div>
        <div className="container mx-auto max-w-3xl relative z-10">
          <div className="inline-flex items-center gap-2 bg-[#c9a227]/20 text-[#c9a227] px-4 py-1.5 rounded-full text-sm font-medium mb-5"><Scale size={14} />Our Team</div>
          <h1 className="font-serif text-4xl md:text-5xl font-bold mb-4">Meet Your Legal Team</h1>
          <p className="text-white/70 text-lg">Experienced advocates, partners, and legal specialists committed to delivering the best outcomes for every client.</p>
        </div>
      </section>

      {/* Filter */}
      <div className="bg-white border-b sticky top-16 z-30 shadow-sm">
        <div className="container mx-auto max-w-6xl px-4 py-3 flex flex-wrap gap-2">
          {departments.map(d => (
            <button key={d} onClick={() => setFilter(d)} className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${filter === d ? "bg-[#0f2044] text-white border-[#0f2044]" : "bg-white text-gray-600 border-gray-200 hover:border-[#0f2044]"}`}>{d}</button>
          ))}
        </div>
      </div>

      {/* Lawyers Grid */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto max-w-6xl px-4">
          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => <div key={i} className="bg-white rounded-2xl h-72 animate-pulse border border-gray-100" />)}
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((lawyer, i) => {
                const specs = lawyer.specializations ? lawyer.specializations.split(",").map(s => s.trim()) : [];
                return (
                  <motion.div key={lawyer.id} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
                    className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-xl hover:border-[#c9a227]/30 transition-all group"
                  >
                    {/* Photo */}
                    <div className="relative bg-gradient-to-br from-[#0f2044]/5 to-[#c9a227]/10 h-48 flex items-center justify-center overflow-hidden">
                      {lawyer.photo ? (
                        <img src={lawyer.photo} alt={lawyer.name} className="w-32 h-32 rounded-full object-cover" />
                      ) : (
                        <div className="w-24 h-24 rounded-full bg-[#0f2044] flex items-center justify-center text-[#c9a227] text-3xl font-bold">{lawyer.name.charAt(0)}</div>
                      )}
                      {lawyer.yearsOfExperience && (
                        <div className="absolute top-3 right-3 bg-[#c9a227] text-[#0f2044] text-[10px] font-bold px-2.5 py-1 rounded-full">{lawyer.yearsOfExperience} Yrs</div>
                      )}
                    </div>

                    <div className="p-5">
                      <h3 className="font-serif font-bold text-[#0f2044] text-lg leading-tight">{lawyer.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 font-medium">{lawyer.role}</span>
                        {lawyer.department && <><span className="text-gray-300">·</span><span className="text-xs text-[#c9a227] font-semibold">{lawyer.department}</span></>}
                      </div>
                      {lawyer.barCouncilId && <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1"><Award size={9} />Bar ID: {lawyer.barCouncilId}</div>}

                      {lawyer.bio && <p className="text-gray-500 text-xs mt-3 leading-relaxed line-clamp-3">{lawyer.bio}</p>}

                      {specs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {specs.slice(0, 3).map(s => <span key={s} className="text-[10px] bg-[#0f2044]/5 text-[#0f2044] px-2 py-0.5 rounded-full font-medium">{s}</span>)}
                          {specs.length > 3 && <span className="text-[10px] text-gray-400">+{specs.length - 3}</span>}
                        </div>
                      )}

                      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-50">
                        {lawyer.email && <a href={`mailto:${lawyer.email}`} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#0f2044] transition-colors"><Mail size={12} />{lawyer.email}</a>}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#0f2044] text-center px-4">
        <h2 className="font-serif text-3xl font-bold text-white mb-4">Need to speak with a specialist?</h2>
        <p className="text-white/60 mb-8 max-w-lg mx-auto">Book a free 30-minute consultation with the right lawyer for your matter.</p>
        <Link href="/services/consult-expert" className="inline-block bg-[#c9a227] text-[#0f2044] font-bold px-8 py-4 rounded-xl hover:bg-[#e0b83a] transition-all">Book Free Consultation →</Link>
      </section>
    </>
  );
}
