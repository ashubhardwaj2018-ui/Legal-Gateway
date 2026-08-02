import { useRoute, Link } from "wouter";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle2, IndianRupee, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SERVICES_DATA, CATEGORIES } from "@/data/services";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { toSlug } from "@/lib/slug";
import NotFound from "./not-found";
import { Helmet } from "react-helmet-async";

export default function ServiceCategory() {
  const [match, params] = useRoute("/services/:id");
  const settings = useSiteSettings();
  const categoryId = params?.id as string;
  
  if (!match || !SERVICES_DATA[categoryId as keyof typeof SERVICES_DATA]) {
    return <NotFound />;
  }

  const category = SERVICES_DATA[categoryId as keyof typeof SERVICES_DATA];

  const metaTitle = `${category.title} Services in India | Vakil & Co. Legal Associates`;
  const metaDescription = `${category.description} Expert legal professionals at Vakil & Co. help you with ${category.services.slice(0, 3).map(s => s.name).join(", ")} and more. Fast, affordable, online.`;
  const canonicalUrl = `https://vakil.co.in/services/${category.id}`;

  return (
    <>
    <Helmet>
      <title>{metaTitle}</title>
      <meta name="description" content={metaDescription} />
      <meta name="keywords" content={`${category.title}, ${category.services.slice(0, 5).map(s => s.name).join(", ")}, legal services India, Vakil & Co`} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Vakil & Co. Legal Associates" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDescription} />
    </Helmet>
    <div className="w-full pb-24">
      {/* Category Header */}
      <div className="bg-primary pt-20 pb-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
        <div className="container relative z-10 mx-auto px-4 md:px-6">
          <div className="max-w-3xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-4 mb-6"
            >
              <div className="w-16 h-16 rounded-2xl bg-secondary/20 flex items-center justify-center border border-secondary/30 backdrop-blur-sm text-3xl">
                {category.icon}
              </div>
              <h1 className="text-4xl md:text-5xl font-serif font-bold text-white">
                {category.title}
              </h1>
            </motion.div>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-xl text-primary-foreground/80 leading-relaxed"
            >
              {category.description}
            </motion.p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 -mt-10 relative z-20">
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          
          {/* Main Content - Services Grid */}
          <div className="flex-1 w-full">
            <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border border-border">
              <h2 className="text-2xl font-serif font-bold text-primary mb-8 border-b pb-4">
                Available Services
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {category.services.map((service, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex flex-col p-6 rounded-xl border border-border bg-gray-50 hover:bg-white hover:shadow-lg hover:border-secondary/50 transition-all group"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-base font-bold text-primary pr-4 group-hover:text-secondary transition-colors leading-snug">
                        {service.name}
                      </h3>
                      <div className="shrink-0 bg-secondary/10 px-2.5 py-1 rounded-md text-secondary font-bold text-sm">
                        {service.price}
                      </div>
                    </div>
                    <p className="text-muted-foreground text-sm flex-1 mb-5 leading-relaxed">
                      {service.description}
                    </p>
                    <div className="flex gap-2">
                      <Link href={`/services/${categoryId}/${toSlug(service.name)}`} className="flex-1">
                        <Button className="w-full bg-primary text-white hover:bg-secondary hover:text-primary transition-all text-sm h-9">
                          View Details <ArrowRight size={14} className="ml-1.5" />
                        </Button>
                      </Link>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Sticky Sidebar CTA */}
          <div className="lg:w-[350px] w-full shrink-0 lg:sticky lg:top-[120px]">
            <div className="bg-primary text-white rounded-2xl p-8 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/20 rounded-full blur-3xl"></div>
              
              <h3 className="text-2xl font-serif font-bold mb-4 relative z-10">Not sure what you need?</h3>
              <p className="text-white/70 mb-8 relative z-10 text-sm leading-relaxed">
                Legal matters can be complex. Talk to our experts to get clarity on the right path forward for your specific situation.
              </p>
              
              <ul className="space-y-4 mb-8 relative z-10">
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={20} className="text-secondary shrink-0 mt-0.5" />
                  <span className="text-sm font-medium">Free Initial Assessment</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={20} className="text-secondary shrink-0 mt-0.5" />
                  <span className="text-sm font-medium">Transparent Pricing</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 size={20} className="text-secondary shrink-0 mt-0.5" />
                  <span className="text-sm font-medium">Expert Matching</span>
                </li>
              </ul>
              
              <Button size="lg" className="w-full bg-secondary text-primary hover:bg-secondary/90 font-bold mb-4 relative z-10">
                Book Free Consultation
              </Button>
              <div className="text-center text-white/50 text-xs font-medium relative z-10">
                Or call us at <a href={`tel:${settings.phone_primary.replace(/[^\d+]/g, "")}`} className="text-white hover:underline">{settings.phone_primary}</a>
              </div>
            </div>

            {/* Other categories quick links */}
            <div className="mt-6 bg-white rounded-2xl p-6 border border-border shadow-sm hidden lg:block">
              <h4 className="font-serif font-bold text-primary mb-4">Other Practice Areas</h4>
              <ul className="space-y-2">
                {CATEGORIES.filter(c => c.id !== categoryId).map(c => (
                  <li key={c.id}>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-between font-normal hover:bg-primary/5 hover:text-primary"
                      onClick={() => window.location.href = `${import.meta.env.BASE_URL}services/${c.id}`}
                    >
                      {c.title}
                      <ArrowRight size={14} className="opacity-50" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
    </>
  );
}
