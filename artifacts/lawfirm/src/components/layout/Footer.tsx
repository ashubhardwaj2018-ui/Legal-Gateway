import { Link } from "wouter";
import { Scale, Mail, Phone, MapPin, ArrowRight } from "lucide-react";
import { CATEGORIES } from "@/data/services";

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground pt-20 pb-10 border-t border-primary-foreground/10">
      <div className="container mx-auto px-4 md:px-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 lg:gap-8 mb-16">
          
          {/* Brand */}
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2">
              <div className="bg-secondary text-primary p-2 rounded-lg">
                <Scale size={24} />
              </div>
              <div className="flex flex-col">
                <span className="font-serif font-bold text-xl leading-none text-white">VAKIL & CO.</span>
                <span className="text-[10px] uppercase tracking-widest text-secondary font-semibold">Legal Associates</span>
              </div>
            </div>
            <p className="text-primary-foreground/70 text-sm leading-relaxed">
              Premium legal services made accessible. We combine decades of expertise with modern technology to deliver exceptional legal solutions for businesses and individuals across India.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-secondary hover:text-primary transition-all">
                <span className="sr-only">LinkedIn</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect width="4" height="12" x="2" y="9"/><circle cx="4" cy="4" r="2"/></svg>
              </a>
              <a href="#" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-secondary hover:text-primary transition-all">
                <span className="sr-only">Twitter</span>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/></svg>
              </a>
            </div>
          </div>

          {/* Practice Areas — split two mini-columns */}
          <div className="md:col-span-2 lg:col-span-1">
            <h3 className="font-serif font-semibold text-lg text-white mb-6">Practice Areas</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
              {CATEGORIES.map(category => (
                <Link
                  key={category.id}
                  href={`/services/${category.id}`}
                  className="text-primary-foreground/70 hover:text-secondary hover:translate-x-0.5 inline-flex transition-all text-sm truncate"
                >
                  {category.title}
                </Link>
              ))}
            </div>
          </div>

          {/* Resources */}
          <div>
            <h3 className="font-serif font-semibold text-lg text-white mb-6">Company</h3>
            <ul className="flex flex-col gap-3">
              <li><a href="#" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">About Us</a></li>
              <li><a href="#" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">Our Lawyers</a></li>
              <li><a href="#" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">Careers</a></li>
              <li><Link href="/blog" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">Legal Blog</Link></li>
              <li><a href="#" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">Privacy Policy</a></li>
              <li><a href="#" className="text-primary-foreground/70 hover:text-secondary transition-colors text-sm">Terms of Service</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="font-serif font-semibold text-lg text-white mb-6">Contact Us</h3>
            <ul className="flex flex-col gap-4">
              <li className="flex items-start gap-3 text-primary-foreground/70 text-sm">
                <MapPin size={18} className="text-secondary shrink-0 mt-0.5" />
                <span>Level 7, Capital Building, BKC, Bandra East, Mumbai - 400051</span>
              </li>
              <li className="flex items-center gap-3 text-primary-foreground/70 text-sm">
                <Phone size={18} className="text-secondary shrink-0" />
                <span>1800-123-4567 (Toll Free)</span>
              </li>
              <li className="flex items-center gap-3 text-primary-foreground/70 text-sm">
                <Mail size={18} className="text-secondary shrink-0" />
                <span>consult@vakilco.in</span>
              </li>
            </ul>
            
            <div className="mt-6">
              <h4 className="text-sm font-medium text-white mb-3">Subscribe to Newsletter</h4>
              <div className="flex">
                <input 
                  type="email" 
                  placeholder="Email address" 
                  className="bg-white/10 border border-white/20 rounded-l-md px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-secondary w-full"
                />
                <button className="bg-secondary text-primary px-3 py-2 rounded-r-md hover:bg-secondary/90 transition-colors">
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-primary-foreground/50 text-xs">
            © {new Date().getFullYear()} Vakil & Co. Legal Associates. All rights reserved.
          </p>
          <p className="text-primary-foreground/50 text-xs text-center md:text-right">
            The information provided on this website does not constitute legal advice. <br className="hidden md:block" /> Use of this site does not create an attorney-client relationship.
          </p>
        </div>
      </div>
    </footer>
  );
}
