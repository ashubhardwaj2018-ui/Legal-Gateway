import { Link } from "wouter";
import { useState, useEffect } from "react";
import { Menu, X, ChevronDown, Scale, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/data/services";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
        isScrolled
          ? "bg-white/95 backdrop-blur-md border-border py-3 shadow-sm"
          : "bg-white border-transparent py-5"
      )}
    >
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-primary text-secondary p-2 rounded-lg group-hover:bg-secondary group-hover:text-primary transition-colors">
              <Scale size={24} />
            </div>
            <div className="flex flex-col">
              <span className="font-serif font-bold text-xl leading-none text-primary">VAKIL & CO.</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Legal Associates</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8">
            <Link href="/" className="text-sm font-medium text-foreground hover:text-secondary transition-colors">
              Home
            </Link>
            
            <div className="relative group">
              <button 
                className="flex items-center gap-1 text-sm font-medium text-foreground hover:text-secondary transition-colors py-2"
                onMouseEnter={() => setServicesOpen(true)}
                onMouseLeave={() => setServicesOpen(false)}
              >
                Practice Areas <ChevronDown size={14} />
              </button>
              
              <div 
                className={cn(
                  "absolute top-full left-1/2 -translate-x-1/2 w-[600px] bg-white border shadow-lg rounded-xl overflow-hidden transition-all duration-200 origin-top",
                  servicesOpen ? "opacity-100 scale-100 pointer-events-auto" : "opacity-0 scale-95 pointer-events-none"
                )}
                onMouseEnter={() => setServicesOpen(true)}
                onMouseLeave={() => setServicesOpen(false)}
              >
                <div className="p-6 grid grid-cols-2 gap-x-8 gap-y-6">
                  {CATEGORIES.map((category) => (
                    <Link 
                      key={category.id} 
                      href={`/services/${category.id}`}
                      className="group/item flex flex-col gap-1"
                    >
                      <span className="font-serif font-semibold text-primary group-hover/item:text-secondary transition-colors">
                        {category.title}
                      </span>
                      <span className="text-xs text-muted-foreground line-clamp-1">
                        {category.description}
                      </span>
                    </Link>
                  ))}
                </div>
                <div className="bg-muted p-4 text-center border-t">
                  <Link href="/services/lawyers" className="text-sm font-medium text-primary hover:text-secondary transition-colors">
                    View All Experts & Lawyers &rarr;
                  </Link>
                </div>
              </div>
            </div>

            <Link href="/#about" className="text-sm font-medium text-foreground hover:text-secondary transition-colors">
              About Us
            </Link>
            
            <Link href="/#testimonials" className="text-sm font-medium text-foreground hover:text-secondary transition-colors">
              Testimonials
            </Link>
          </div>

          <div className="hidden lg:flex items-center gap-4">
            <div className="flex items-center gap-2 text-primary font-medium">
              <Phone size={18} className="text-secondary" />
              <span>1800-123-4567</span>
            </div>
            <Button className="bg-primary hover:bg-primary/90 text-white font-medium">
              Free Consultation
            </Button>
          </div>

          {/* Mobile toggle */}
          <button 
            className="lg:hidden text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-full left-0 right-0 bg-white border-b shadow-lg max-h-[80vh] overflow-y-auto">
          <div className="p-4 flex flex-col gap-4">
            <Link href="/" className="font-medium text-lg py-2 border-b">Home</Link>
            
            <div className="py-2 border-b">
              <div className="font-medium text-lg mb-3">Practice Areas</div>
              <div className="flex flex-col gap-3 pl-4">
                {CATEGORIES.map((category) => (
                  <Link 
                    key={category.id} 
                    href={`/services/${category.id}`}
                    className="text-muted-foreground hover:text-primary transition-colors"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    {category.title}
                  </Link>
                ))}
              </div>
            </div>
            
            <Link href="/#about" className="font-medium text-lg py-2 border-b">About Us</Link>
            
            <div className="pt-4 pb-2 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-primary font-medium justify-center">
                <Phone size={18} className="text-secondary" />
                <span>1800-123-4567</span>
              </div>
              <Button className="w-full bg-primary text-white">
                Book Consultation
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
