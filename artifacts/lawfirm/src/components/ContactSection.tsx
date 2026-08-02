import { useState } from "react";
import { motion } from "framer-motion";
import { useCreateContact } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, Loader2, Mail, Phone, MapPin } from "lucide-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";

export function ContactSection() {
  const settings = useSiteSettings();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const mutation = useCreateContact();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(
      {
        data: {
          name: form.name,
          email: form.email,
          phone: form.phone || null,
          subject: form.subject,
          message: form.message,
        },
      },
      {
        onSuccess: () => setSubmitted(true),
      }
    );
  };

  return (
    <section className="py-24 bg-gray-50" id="contact">
      <div className="container mx-auto px-4 md:px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-primary mb-4">Get in Touch</h2>
          <p className="text-lg text-muted-foreground">
            Have a question or need legal guidance? Send us a message and we will respond within 24 hours.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 max-w-6xl mx-auto">
          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-2 flex flex-col gap-8"
          >
            <div className="bg-primary rounded-2xl p-8 text-white flex flex-col gap-6">
              <h3 className="text-2xl font-serif font-bold">{settings.site_name}</h3>
              <p className="text-white/70 text-sm leading-relaxed">
                {settings.site_tagline}. Our team of expert lawyers is ready to assist you with any legal matter.
              </p>
              <div className="flex flex-col gap-5 mt-2">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
                    <MapPin size={16} className="text-secondary" />
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed">{settings.address}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
                    <Phone size={16} className="text-secondary" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <a href={`tel:${settings.phone_primary.replace(/[^\d+]/g, "")}`} className="text-sm text-white/80 hover:text-white transition-colors">
                      {settings.phone_primary}
                    </a>
                    {settings.phone_secondary && (
                      <a href={`tel:${settings.phone_secondary.replace(/[^\d+]/g, "")}`} className="text-xs text-white/60 hover:text-white/80 transition-colors">
                        {settings.phone_secondary}
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-secondary/20 flex items-center justify-center shrink-0">
                    <Mail size={16} className="text-secondary" />
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <a href={`mailto:${settings.email_primary}`} className="text-sm text-white/80 hover:text-white transition-colors">
                      {settings.email_primary}
                    </a>
                    {settings.email_secondary && (
                      <a href={`mailto:${settings.email_secondary}`} className="text-xs text-white/60 hover:text-white/80 transition-colors">
                        {settings.email_secondary}
                      </a>
                    )}
                  </div>
                </div>
                {settings.gst_number && (
                  <div className="text-xs text-white/50 border-t border-white/10 pt-3 mt-1">
                    GST: <span className="font-mono text-white/70">{settings.gst_number}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="bg-secondary/10 border border-secondary/20 rounded-2xl p-6">
              <h4 className="font-serif font-bold text-primary text-lg mb-2">Office Hours</h4>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex justify-between"><span>Monday – Friday</span><span className="font-medium text-primary">{settings.hours_weekdays}</span></div>
                <div className="flex justify-between"><span>Saturday</span><span className="font-medium text-primary">{settings.hours_saturday}</span></div>
                <div className="flex justify-between"><span>Sunday</span><span className="font-medium text-muted-foreground">{settings.hours_sunday}</span></div>
              </div>
            </div>
          </motion.div>

          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="lg:col-span-3 bg-white rounded-2xl border border-border p-8 shadow-sm"
          >
            {submitted ? (
              <div className="h-full flex flex-col items-center justify-center py-12 text-center gap-4">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle className="text-green-600 w-8 h-8" />
                </div>
                <h3 className="text-2xl font-serif font-bold text-primary">Message Received!</h3>
                <p className="text-muted-foreground max-w-sm">
                  Thank you for reaching out. A member of our team will respond to your inquiry within 24 hours.
                </p>
                <Button
                  variant="outline"
                  onClick={() => { setSubmitted(false); setForm({ name: "", email: "", phone: "", subject: "", message: "" }); }}
                  className="mt-2"
                >
                  Send Another Message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contact-name">Full Name *</Label>
                    <Input id="contact-name" placeholder="Rahul Sharma" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact-phone">Phone</Label>
                    <Input id="contact-phone" placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-email">Email Address *</Label>
                  <Input id="contact-email" type="email" placeholder="rahul@company.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-subject">Subject *</Label>
                  <Input id="contact-subject" placeholder="e.g., Trademark Registration Query" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact-message">Message *</Label>
                  <Textarea id="contact-message" placeholder="Describe your legal matter..." rows={5} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required />
                </div>
                {mutation.isError && (
                  <p className="text-destructive text-sm">Something went wrong. Please try again.</p>
                )}
                <Button type="submit" className="w-full bg-primary text-white hover:bg-primary/90 h-12 text-base font-semibold" disabled={mutation.isPending}>
                  {mutation.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending...</> : "Send Message"}
                </Button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
