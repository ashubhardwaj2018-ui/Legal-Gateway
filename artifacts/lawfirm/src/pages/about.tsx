import { Helmet } from "react-helmet-async";
import { motion } from "framer-motion";
import { Scale, Award, Users, ShieldCheck, Target, Heart, Globe2, Lightbulb } from "lucide-react";
import { Link } from "wouter";
import { usePageContent } from "@/hooks/usePageContent";

const values = [
  { icon: ShieldCheck, title: "Integrity", desc: "We operate with absolute transparency and ethical standards in every engagement." },
  { icon: Target, title: "Excellence", desc: "We pursue the highest quality in legal research, drafting, and representation." },
  { icon: Heart, title: "Client-First", desc: "Every decision we make is guided by what's best for our clients' long-term interests." },
  { icon: Globe2, title: "Accessibility", desc: "Premium legal services should be available to every business and individual in India." },
  { icon: Lightbulb, title: "Innovation", desc: "We leverage technology to make legal processes faster, cheaper, and more transparent." },
  { icon: Users, title: "Collaboration", desc: "A multidisciplinary team that brings together legal, financial, and domain expertise." },
];

const milestones = [
  { year: "2009", event: "Founded in Mumbai with a team of 3 senior advocates focused on corporate law." },
  { year: "2013", event: "Expanded to Delhi NCR and launched our Intellectual Property practice." },
  { year: "2016", event: "Reached 1,000 clients served milestone. Opened Bangalore and Hyderabad offices." },
  { year: "2019", event: "Launched digital-first legal services platform, reducing turnaround times by 60%." },
  { year: "2022", event: "Crossed 5,000+ clients. Ranked among India's top 50 boutique law firms." },
  { year: "2024", event: "Launched Legal Filing India Connect — India's first AI-powered legal case tracking portal for clients." },
];

export default function AboutUs() {
  const get = usePageContent("about");
  return (
    <>
      <Helmet>
        <title>About Us — Legal Filing India India's Trusted Filing Platform</title>
        <meta name="description" content="Learn about Legal Filing India — India's trusted legal services firm with 15+ years of expertise in corporate law, intellectual property, tax compliance, and more." />
      </Helmet>

      {/* Hero */}
      <section className="bg-[#0f2044] text-white py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-96 h-96 rounded-full bg-[#c9a227] blur-3xl" />
          <div className="absolute bottom-0 right-0 w-64 h-64 rounded-full bg-white blur-3xl" />
        </div>
        <div className="container mx-auto max-w-4xl text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 bg-[#c9a227]/20 text-[#c9a227] px-4 py-1.5 rounded-full text-sm font-medium mb-6">
              <Scale size={14} /> {get("hero_badge", "Est. 2009 · Mumbai, India")}
            </div>
            <h1 className="font-serif text-4xl md:text-6xl font-bold mb-6">{get("hero_title", "India's Trusted")} <br /><span className="text-[#c9a227]">{get("hero_subtitle", "Legal Partner")}</span></h1>
            <p className="text-white/70 text-xl max-w-3xl mx-auto leading-relaxed">
              {get("hero_description", "For over 15 years, Legal Filing India has been at the forefront of making premium legal services accessible, transparent, and effective for businesses and individuals across India.")}
            </p>
          </motion.div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-[#c9a227] py-12">
        <div className="container mx-auto max-w-5xl px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: get("stat_1_value", "5,000+"), label: get("stat_1_label", "Clients Served") },
              { value: get("stat_2_value", "15+"), label: get("stat_2_label", "Years Experience") },
              { value: get("stat_3_value", "500+"), label: get("stat_3_label", "Legal Experts") },
              { value: get("stat_4_value", "12"), label: get("stat_4_label", "Cities Across India") },
            ].map(s => (
              <div key={s.label}>
                <div className="text-3xl md:text-4xl font-bold text-[#0f2044] font-serif">{s.value}</div>
                <div className="text-[#0f2044]/70 text-sm font-medium mt-1">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 bg-white">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <div className="inline-flex items-center gap-2 text-[#c9a227] text-sm font-semibold mb-4"><Award size={14} />Our Story</div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#0f2044] mb-6">Built on a Simple Belief — Legal Help Shouldn't Be a Luxury</h2>
              <div className="space-y-4 text-gray-600 leading-relaxed">
                <p>Legal Filing India was founded in 2009 by a group of senior advocates who had spent years watching small businesses and individuals struggle to access quality legal advice due to high costs, complex processes, and limited access.</p>
                <p>We set out to change that — by combining deep legal expertise with modern processes and technology to deliver outcomes that were once only available to large corporations.</p>
                <p>Today, we are a 500+ member team operating across 12 cities, serving everyone from solo founders and families to Fortune 500 companies — with the same commitment to excellence, transparency, and results.</p>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="grid grid-cols-2 gap-4">
              {[
                { icon: Award, label: "Top 50 Boutique Law Firm", sub: "Ranked 2022" },
                { icon: ShieldCheck, label: "ISO 27001 Certified", sub: "Data Security" },
                { icon: Users, label: "500+ Legal Experts", sub: "Across India" },
                { icon: Globe2, label: "12 Cities", sub: "Mumbai to Chennai" },
              ].map((item, i) => (
                <div key={i} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                  <item.icon size={24} className="text-[#c9a227] mb-3" />
                  <div className="font-bold text-[#0f2044] text-sm leading-snug">{item.label}</div>
                  <div className="text-gray-400 text-xs mt-1">{item.sub}</div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 bg-gray-50">
        <div className="container mx-auto max-w-6xl px-4">
          <div className="text-center mb-14">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#0f2044] mb-4">Our Core Values</h2>
            <p className="text-gray-500 max-w-xl mx-auto">These aren't just words on a wall. They guide every case, every interaction, and every decision we make.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {values.map((v, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="bg-white rounded-2xl p-6 border border-gray-100 hover:border-[#c9a227]/40 hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-xl bg-[#0f2044]/5 flex items-center justify-center mb-4"><v.icon size={22} className="text-[#0f2044]" /></div>
                <h3 className="font-bold text-[#0f2044] text-lg mb-2">{v.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-white">
        <div className="container mx-auto max-w-3xl px-4">
          <div className="text-center mb-14">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-[#0f2044] mb-4">Our Journey</h2>
          </div>
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-[#c9a227]/30" />
            <div className="space-y-10">
              {milestones.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="flex gap-8 relative">
                  <div className="w-16 h-16 rounded-full bg-[#0f2044] border-4 border-[#c9a227] flex items-center justify-center shrink-0 z-10">
                    <span className="text-[#c9a227] text-xs font-bold">{m.year}</span>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-5 flex-1 border border-gray-100">
                    <p className="text-gray-700 text-sm leading-relaxed">{m.event}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-[#0f2044] text-white text-center px-4">
        <h2 className="font-serif text-3xl md:text-4xl font-bold mb-4">Ready to work with us?</h2>
        <p className="text-white/60 mb-8 max-w-lg mx-auto">Get a free consultation with one of our specialists and see how we can help your business or personal legal needs.</p>
        <Link href="/services/consult-expert" className="inline-block bg-[#c9a227] text-[#0f2044] font-bold px-8 py-4 rounded-xl hover:bg-[#e0b83a] transition-all text-sm">Book Free Consultation →</Link>
      </section>
    </>
  );
}
