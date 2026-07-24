import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Briefcase, MapPin, Clock, ArrowRight, Users, Heart, Lightbulb, TrendingUp, GraduationCap } from "lucide-react";

const openings = [
  { title: "Senior Corporate Lawyer", dept: "Corporate Law", location: "Mumbai", type: "Full-time", exp: "5-8 years" },
  { title: "Intellectual Property Attorney", dept: "Trademark & IP", location: "Delhi NCR", type: "Full-time", exp: "3-6 years" },
  { title: "Tax & GST Consultant", dept: "Tax & Compliance", location: "Bangalore", type: "Full-time", exp: "4-7 years" },
  { title: "Legal Researcher", dept: "Research & Analysis", location: "Remote", type: "Full-time", exp: "1-3 years" },
  { title: "Client Relationship Manager", dept: "Operations", location: "Mumbai", type: "Full-time", exp: "2-4 years" },
  { title: "Family Law Advocate", dept: "Personal Law", location: "Hyderabad", type: "Full-time", exp: "3-5 years" },
  { title: "Real Estate Legal Advisor", dept: "Property Law", location: "Pune", type: "Full-time", exp: "4-6 years" },
  { title: "Legal Intern", dept: "Multiple Departments", location: "Pan India", type: "Internship", exp: "LLB Final Year" },
];

const perks = [
  { icon: TrendingUp, title: "Career Growth", desc: "Structured growth paths with clear milestones, mentoring from senior partners." },
  { icon: GraduationCap, title: "Learning & Development", desc: "Annual training budget, access to legal databases, and conference sponsorships." },
  { icon: Heart, title: "Health & Wellness", desc: "Comprehensive medical insurance for you and your family, mental health support." },
  { icon: Lightbulb, title: "Innovation Culture", desc: "Work on legal-tech initiatives and help shape the future of Indian legal services." },
  { icon: Users, title: "Inclusive Workplace", desc: "Diverse team with a strong culture of respect, collaboration, and inclusion." },
  { icon: Clock, title: "Work-Life Balance", desc: "Flexible working options, hybrid policies, and generous leave structure." },
];

export default function Careers() {
  return (
    <>
      <Helmet>
        <title>Careers at Vakil & Co. — Join India's Top Legal Team</title>
        <meta name="description" content="Build your legal career at Vakil & Co. We're hiring lawyers, consultants, and legal professionals across India. View current openings." />
      </Helmet>

      {/* Hero */}
      <section className="bg-[#0f2044] text-white py-24 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#c9a227] blur-3xl" />
        </div>
        <div className="container mx-auto max-w-3xl relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <div className="inline-flex items-center gap-2 bg-[#c9a227]/20 text-[#c9a227] px-4 py-1.5 rounded-full text-sm font-medium mb-6"><Briefcase size={14} />We're Hiring</div>
            <h1 className="font-serif text-4xl md:text-6xl font-bold mb-6">Shape the Future of <span className="text-[#c9a227]">Indian Law</span></h1>
            <p className="text-white/70 text-xl leading-relaxed">Join a team of 500+ legal professionals committed to making quality legal services accessible to every Indian. Your work here creates real impact.</p>
          </motion.div>
        </div>
      </section>

      {/* Culture */}
      <section className="py-20 bg-white">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="text-center mb-14">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#0f2044] mb-4">Why Vakil & Co.?</h2>
            <p className="text-gray-500 max-w-xl mx-auto">We invest in our people as much as we invest in our clients.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {perks.map((p, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <div className="w-11 h-11 rounded-xl bg-[#0f2044] flex items-center justify-center mb-4"><p.icon size={20} className="text-[#c9a227]" /></div>
                <h3 className="font-bold text-[#0f2044] mb-2">{p.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{p.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Openings */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#0f2044] mb-4">Current Openings</h2>
            <p className="text-gray-500">We're growing across all practice areas and cities. Find your role below.</p>
          </div>
          <div className="space-y-3">
            {openings.map((job, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl border border-gray-100 p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-[#c9a227]/40 hover:shadow-md transition-all group cursor-pointer"
                onClick={() => { const el = document.getElementById("apply"); el?.scrollIntoView({ behavior: "smooth" }); }}
              >
                <div className="flex-1">
                  <div className="font-bold text-[#0f2044] group-hover:text-[#c9a227] transition-colors">{job.title}</div>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                    <span className="flex items-center gap-1"><Briefcase size={11} />{job.dept}</span>
                    <span className="flex items-center gap-1"><MapPin size={11} />{job.location}</span>
                    <span className="flex items-center gap-1"><Clock size={11} />{job.type}</span>
                    <span className="flex items-center gap-1"><Users size={11} />{job.exp}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${job.type === "Internship" ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>{job.type}</span>
                  <ArrowRight size={16} className="text-gray-300 group-hover:text-[#c9a227] transition-colors" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Apply */}
      <section id="apply" className="py-20 bg-[#0f2044] px-4">
        <div className="container mx-auto max-w-2xl">
          <div className="text-center mb-10">
            <h2 className="font-serif text-3xl font-bold text-white mb-3">Apply Now</h2>
            <p className="text-white/60">Send us your resume and we'll get back within 5 business days.</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-3xl p-8">
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); alert("Thank you! We'll be in touch soon."); }}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-2">Full Name *</label>
                  <input required placeholder="Your name" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#c9a227]/60 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-2">Email *</label>
                  <input type="email" required placeholder="your@email.com" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#c9a227]/60 text-sm" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-2">Position of Interest *</label>
                <select required className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#c9a227]/60 text-sm">
                  <option value="">Select a role…</option>
                  {openings.map(j => <option key={j.title} className="text-gray-900">{j.title}</option>)}
                  <option className="text-gray-900">Other / General Application</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-2">Years of Experience</label>
                <input placeholder="e.g. 3 years" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#c9a227]/60 text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-2">Cover Note</label>
                <textarea rows={4} placeholder="Tell us about yourself and why you'd like to join Vakil & Co." className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#c9a227]/60 text-sm resize-none" />
              </div>
              <div className="text-white/40 text-xs bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                📎 Email your resume to <span className="text-[#c9a227]">careers@vakilco.in</span> with the subject line: <em>Application — [Role Name]</em>
              </div>
              <button type="submit" className="w-full bg-[#c9a227] text-[#0f2044] font-bold py-3.5 rounded-xl hover:bg-[#e0b83a] transition-all text-sm">Submit Application</button>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
