import { motion } from "framer-motion";
import { Link } from "wouter";
import { 
  ArrowRight, ShieldCheck, Clock, Award, Users, FileText, 
  Building2, Scale, Building, Heart, Shield, Landmark, MapPin, Star, MessageSquare, Phone, BookOpen, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/data/services";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useListBlogs } from "@workspace/api-client-react";

const CATEGORY_LABELS: Record<string, string> = {
  "legal-advice": "Legal Advice", "business-setup": "Business Setup",
  "tax-compliance": "Tax & Compliance", "trademark-ip": "Trademark & IP",
  "property": "Property Law", "ngo": "NGO & Non-Profit",
  "fundraising": "Fundraising", "general": "General",
};

const stats = [
  { value: "5000+", label: "Clients Served" },
  { value: "15+", label: "Years Experience" },
  { value: "98%", label: "Success Rate" },
  { value: "500+", label: "Legal Experts" }
];

const features = [
  { icon: ShieldCheck, title: "Absolute Confidentiality", desc: "Your data and legal matters are protected with bank-grade security and strict NDAs." },
  { icon: Clock, title: "Transparent Timelines", desc: "Clear deadlines for every milestone. Track your case progress in real-time." },
  { icon: Award, title: "Specialized Experts", desc: "Work with lawyers who specialize exclusively in your specific legal requirement." }
];

const categoryIcons: Record<string, React.ElementType> = {
  "trademark-ip": Shield,
  "documentation": FileText,
  "fundraising": Landmark,
  "ngo": Building,
  "property-personal": Heart,
  "lawyers": Users
};

const lawyers = [
  { name: "Adv. Rajesh Sharma", spec: "Corporate & M&A", exp: "18 Yrs Exp.", img: "https://api.dicebear.com/7.x/notionists/svg?seed=Rajesh&backgroundColor=f1f5f9" },
  { name: "Adv. Priya Desai", spec: "Intellectual Property", exp: "12 Yrs Exp.", img: "https://api.dicebear.com/7.x/notionists/svg?seed=Priya&backgroundColor=f1f5f9" },
  { name: "Adv. Vikram Singh", spec: "Real Estate & Property", exp: "22 Yrs Exp.", img: "https://api.dicebear.com/7.x/notionists/svg?seed=Vikram&backgroundColor=f1f5f9" },
  { name: "Adv. Neha Gupta", spec: "Family & Civil Law", exp: "15 Yrs Exp.", img: "https://api.dicebear.com/7.x/notionists/svg?seed=Neha&backgroundColor=f1f5f9" }
];

function LatestBlogSection() {
  const { data } = useListBlogs({ limit: 3 });
  const posts = data?.data ?? [];
  if (posts.length === 0) return null;
  return (
    <section className="py-20 bg-gray-50">
      <div className="container mx-auto px-4 md:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12"
        >
          <div>
            <div className="inline-flex items-center gap-2 text-secondary text-sm font-semibold mb-3">
              <BookOpen size={14} /> Legal Knowledge Hub
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-primary">Latest Articles &amp; Insights</h2>
            <p className="text-muted-foreground mt-2 max-w-lg">Expert analysis on Indian law, compliance updates, and practical legal guidance for businesses and individuals.</p>
          </div>
          <Link href="/blog">
            <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white shrink-0 gap-1.5">
              View All Articles <ArrowRight size={14} />
            </Button>
          </Link>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {posts.map((post, i) => (
            <motion.div
              key={post.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
            >
              <Link href={`/blog/${post.slug}`}>
                <div className="group bg-white rounded-2xl overflow-hidden border hover:shadow-lg transition-all duration-300 h-full flex flex-col cursor-pointer">
                  {post.featuredImage
                    ? <img src={post.featuredImage} alt={post.title} className="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-500" />
                    : <div className="w-full h-44 bg-primary/5 flex items-center justify-center"><BookOpen size={36} className="text-primary/20" /></div>
                  }
                  <div className="p-5 flex flex-col flex-1">
                    <span className="text-secondary text-xs font-semibold uppercase tracking-wide mb-2">
                      {CATEGORY_LABELS[post.category] ?? post.category}
                    </span>
                    <h3 className="font-serif font-bold text-primary text-base leading-snug group-hover:text-secondary transition-colors line-clamp-2 flex-1">
                      {post.title}
                    </h3>
                    {post.excerpt && (
                      <p className="text-muted-foreground text-sm mt-2 line-clamp-2 leading-relaxed">{post.excerpt}</p>
                    )}
                    <div className="flex items-center justify-between mt-4 pt-4 border-t text-xs text-muted-foreground">
                      <span>{post.authorName}</span>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><Clock size={10} /> {post.readingTime} min</span>
                        <span className="flex items-center gap-1"><Eye size={10} /> {post.viewCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <div className="w-full overflow-x-hidden">
      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center pt-10 pb-20">
        <div className="absolute inset-0 z-0">
          <img 
            src="/hero-bg.png" 
            alt="Law office" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/90 via-primary/80 to-primary/40 backdrop-blur-[2px]" />
        </div>

        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/20 text-secondary font-medium text-sm mb-6 backdrop-blur-md border border-secondary/30">
                <Scale size={14} /> India's Premium Legal Network
              </span>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-white leading-[1.1] mb-6">
                Expert Legal Counsel, <br/>
                <span className="text-secondary">Made Accessible.</span>
              </h1>
              <p className="text-lg md:text-xl text-white/80 mb-10 max-w-2xl leading-relaxed">
                From protecting your intellectual property to complex corporate litigation, 
                our network of top-tier attorneys delivers decisive results with complete transparency.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="bg-secondary text-primary hover:bg-secondary/90 text-base font-semibold h-14 px-8">
                  Book Free Consultation
                </Button>
                <Button size="lg" variant="outline" className="bg-white/10 text-white border-white/30 hover:bg-white/20 hover:text-white text-base font-medium h-14 px-8 backdrop-blur-md">
                  Explore Services
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust Stats Bar */}
      <section className="bg-primary border-t border-white/10 py-12 relative z-20 -mt-8 md:-mt-12 mx-4 md:mx-auto max-w-7xl rounded-xl shadow-2xl">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-white/10">
            {stats.map((stat, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center px-4"
              >
                <div className="text-3xl md:text-4xl font-serif font-bold text-secondary mb-2">{stat.value}</div>
                <div className="text-sm font-medium text-white/70 uppercase tracking-wider">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-primary mb-4">Practice Areas</h2>
            <p className="text-lg text-muted-foreground">
              Comprehensive legal solutions tailored for businesses, startups, and individuals. 
              Select a category to explore specific services.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8 max-w-7xl mx-auto">
            {CATEGORIES.map((category, i) => {
              const Icon = categoryIcons[category.id] || Scale;
              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                >
                  <Link 
                    href={`/services/${category.id}`}
                    className="group block h-full bg-white rounded-2xl p-8 border border-border shadow-sm hover:shadow-xl hover:border-secondary/50 transition-all duration-300"
                  >
                    <div className="w-14 h-14 rounded-xl bg-primary/5 flex items-center justify-center text-primary mb-6 group-hover:bg-secondary group-hover:text-primary transition-colors">
                      <Icon size={28} />
                    </div>
                    <h3 className="text-2xl font-serif font-bold text-primary mb-3 group-hover:text-secondary transition-colors">
                      {category.title}
                    </h3>
                    <p className="text-muted-foreground mb-6 line-clamp-2">
                      {category.description}
                    </p>
                    <div className="flex items-center text-sm font-semibold text-primary group-hover:text-secondary transition-colors">
                      Explore Services <ArrowRight size={16} className="ml-2 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col lg:flex-row gap-16 items-center">
            <div className="lg:w-1/2">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
              >
                <h2 className="text-3xl md:text-5xl font-serif font-bold text-primary mb-6">
                  Legal Solutions,<br/> Simplified.
                </h2>
                <p className="text-lg text-muted-foreground mb-8">
                  We've streamlined the process of getting expert legal help. No endless waiting rooms, no confusing jargon — just clear, actionable advice and decisive execution.
                </p>

                <div className="space-y-8">
                  {[
                    { step: "01", title: "Select Your Service", desc: "Browse our comprehensive list of legal services with transparent pricing." },
                    { step: "02", title: "Consult with an Expert", desc: "Get matched with a specialist lawyer for a detailed consultation on your specific matter." },
                    { step: "03", title: "Swift Execution", desc: "Our team handles all documentation, filings, and representation while keeping you updated." }
                  ].map((item, i) => (
                    <div key={i} className="flex gap-6">
                      <div className="w-12 h-12 rounded-full bg-secondary/20 text-secondary flex items-center justify-center font-bold font-serif text-xl shrink-0">
                        {item.step}
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-primary mb-2">{item.title}</h4>
                        <p className="text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
            <div className="lg:w-1/2 w-full">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                className="relative rounded-2xl overflow-hidden shadow-2xl aspect-[4/3]"
              >
                <img 
                  src="/lawyers-team.png" 
                  alt="Our professional team" 
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 border border-white/20 rounded-2xl ring-1 ring-inset ring-black/10"></div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Features */}
      <section className="py-20 bg-primary text-white">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {features.map((feature, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-secondary mb-6">
                  <feature.icon size={32} />
                </div>
                <h3 className="text-xl font-bold font-serif mb-3">{feature.title}</h3>
                <p className="text-white/70 leading-relaxed">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Lawyers Showcase */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex justify-between items-end mb-12">
            <div className="max-w-2xl">
              <h2 className="text-3xl md:text-5xl font-serif font-bold text-primary mb-4">Meet Our Experts</h2>
              <p className="text-lg text-muted-foreground">
                Our network comprises seasoned practitioners from top law firms and former corporate counsels.
              </p>
            </div>
            <Button variant="outline" className="hidden md:flex border-primary text-primary hover:bg-primary hover:text-white">
              View All Lawyers
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {lawyers.map((lawyer, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-xl overflow-hidden border border-border hover:shadow-xl transition-all group"
              >
                <div className="aspect-square bg-muted relative overflow-hidden">
                  <img src={lawyer.img} alt={lawyer.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-primary flex items-center gap-1 shadow-sm">
                    <Star size={12} className="fill-secondary text-secondary" /> {lawyer.exp}
                  </div>
                </div>
                <div className="p-5 text-center border-t border-border">
                  <h4 className="font-serif font-bold text-lg text-primary">{lawyer.name}</h4>
                  <p className="text-sm text-secondary font-medium mt-1">{lawyer.spec}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <div className="mt-8 text-center md:hidden">
            <Button variant="outline" className="border-primary text-primary w-full">
              View All Lawyers
            </Button>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-white" id="testimonials">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-primary mb-4">Client Success Stories</h2>
            <p className="text-lg text-muted-foreground">
              Don't just take our word for it. Hear from businesses and individuals who trusted us with their legal needs.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {[
              {
                quote: "Vakil & Co made our startup's incorporation and trademark registration completely seamless. Their clear communication and fast turnaround let us focus on building our product.",
                name: "Rahul Verma",
                role: "Founder, TechFlow AI"
              },
              {
                quote: "We've been using their corporate legal advisory services for 3 years. The expertise of their lawyers rivals any top-tier firm but with much better accessibility and transparent pricing.",
                name: "Anjali Desai",
                role: "Director, Desai Logistics"
              },
              {
                quote: "When we faced a complex property dispute, their litigation team handled the matter with utmost professionalism and secured a favorable outcome in record time.",
                name: "Vikram Kapoor",
                role: "Real Estate Investor"
              }
            ].map((testimonial, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-gray-50 rounded-2xl p-8 border border-border relative"
              >
                <div className="text-secondary mb-6">
                  <MessageSquare size={32} className="opacity-50" />
                </div>
                <p className="text-primary/80 italic mb-8 leading-relaxed">"{testimonial.quote}"</p>
                <div>
                  <div className="font-bold font-serif text-primary">{testimonial.name}</div>
                  <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-4 md:px-6 max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-5xl font-serif font-bold text-primary mb-4">Frequently Asked Questions</h2>
            <p className="text-lg text-muted-foreground">Clear answers to your common legal queries.</p>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1" className="border-b border-border py-2">
              <AccordionTrigger className="text-left text-lg font-medium text-primary hover:text-secondary data-[state=open]:text-secondary">
                How does the consultation process work?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                Once you select a service or request a general consultation, our team will match you with the right expert. The initial consultation is free. We discuss your case, outline the legal strategy, and provide a transparent fee structure before proceeding.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2" className="border-b border-border py-2">
              <AccordionTrigger className="text-left text-lg font-medium text-primary hover:text-secondary data-[state=open]:text-secondary">
                Are your prices fixed or hourly?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                Most of our standard services (like trademark registration, standard contracts, company incorporation) have fixed, transparent pricing. For complex litigation or customized corporate advisory, we provide a clear estimate or hourly rate after the initial consultation.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3" className="border-b border-border py-2">
              <AccordionTrigger className="text-left text-lg font-medium text-primary hover:text-secondary data-[state=open]:text-secondary">
                Do I need to visit your office in person?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                No. We are a technology-forward firm. Over 90% of our services can be completed entirely online through secure document sharing, video consultations, and e-signatures. However, you are always welcome to visit our Mumbai office by appointment.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4" className="border-b border-border py-2">
              <AccordionTrigger className="text-left text-lg font-medium text-primary hover:text-secondary data-[state=open]:text-secondary">
                How long does trademark registration take in India?
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-base leading-relaxed">
                The initial filing takes 2-3 days, after which you can use the 'TM' symbol. The complete registration process until you receive the certificate (and can use the 'R' symbol) typically takes 6 to 12 months, provided there are no government objections or third-party oppositions.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Latest Blog Posts */}
      <LatestBlogSection />

      {/* CTA */}
      <section className="py-20 bg-secondary relative overflow-hidden">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-[800px] h-[800px] bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="bg-primary rounded-3xl p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-10 shadow-2xl">
            <div className="md:w-2/3">
              <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-4">
                Ready to resolve your legal matters?
              </h2>
              <p className="text-primary-foreground/80 text-lg md:text-xl">
                Get expert guidance from India's leading legal professionals today. Your first consultation is completely free and strictly confidential.
              </p>
            </div>
            <div className="md:w-1/3 w-full flex flex-col sm:flex-row md:flex-col gap-4 shrink-0">
              <Button size="lg" className="w-full bg-secondary text-primary hover:bg-secondary/90 h-14 text-lg font-bold">
                Book Free Consultation
              </Button>
              <Button size="lg" variant="outline" className="w-full bg-transparent border-white/20 text-white hover:bg-white/10 h-14 text-lg">
                <Phone className="mr-2 h-5 w-5" /> 1800-123-4567
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
