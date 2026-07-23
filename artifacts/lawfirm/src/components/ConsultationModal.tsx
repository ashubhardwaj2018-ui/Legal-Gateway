import { useState } from "react";
import { useCreateConsultation } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, SERVICES_DATA, type ServiceCategory } from "@/data/services";
import { CheckCircle, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCategory?: string;
  defaultService?: string;
}

export function ConsultationModal({ open, onOpenChange, defaultCategory, defaultService }: Props) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    serviceCategory: defaultCategory ?? "",
    serviceInterest: defaultService ?? "",
    message: "",
    preferredDate: "",
  });
  const [submitted, setSubmitted] = useState(false);

  const mutation = useCreateConsultation();

  const selectedCategory: ServiceCategory | undefined = Object.values(SERVICES_DATA).find(c => c.id === form.serviceCategory);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(
      {
        data: {
          name: form.name,
          email: form.email,
          phone: form.phone,
          serviceCategory: form.serviceCategory,
          serviceInterest: form.serviceInterest,
          message: form.message || null,
          preferredDate: form.preferredDate || null,
        },
      },
      {
        onSuccess: () => {
          setSubmitted(true);
        },
      }
    );
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(() => {
      setSubmitted(false);
      setForm({
        name: "",
        email: "",
        phone: "",
        serviceCategory: defaultCategory ?? "",
        serviceInterest: defaultService ?? "",
        message: "",
        preferredDate: "",
      });
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        {submitted ? (
          <div className="py-12 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle className="text-green-600 w-8 h-8" />
            </div>
            <DialogTitle className="text-2xl font-serif text-primary">Consultation Booked!</DialogTitle>
            <p className="text-muted-foreground">
              Thank you, <strong>{form.name}</strong>. Our legal expert will contact you within 24 hours to schedule your free consultation.
            </p>
            <Button onClick={handleClose} className="mt-4 bg-primary text-white hover:bg-primary/90 w-full">
              Close
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-serif text-primary">Book a Free Consultation</DialogTitle>
              <DialogDescription>
                Fill in your details and our legal expert will reach out within 24 hours. Strictly confidential.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-5 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    placeholder="Rahul Sharma"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone *</Label>
                  <Input
                    id="phone"
                    placeholder="+91 98765 43210"
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="rahul@company.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Service Category *</Label>
                  <Select
                    value={form.serviceCategory}
                    onValueChange={val => setForm(f => ({ ...f, serviceCategory: val, serviceInterest: "" }))}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Specific Service *</Label>
                  <Select
                    value={form.serviceInterest}
                    onValueChange={val => setForm(f => ({ ...f, serviceInterest: val }))}
                    disabled={!selectedCategory}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                      {(selectedCategory?.services ?? []).map((s) => (
                        <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">Brief Description (optional)</Label>
                <Textarea
                  id="message"
                  placeholder="Describe your legal matter briefly..."
                  rows={3}
                  value={form.message}
                  onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="date">Preferred Date (optional)</Label>
                <Input
                  id="date"
                  type="date"
                  value={form.preferredDate}
                  onChange={e => setForm(f => ({ ...f, preferredDate: e.target.value }))}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              {mutation.isError && (
                <p className="text-destructive text-sm">Something went wrong. Please try again.</p>
              )}

              <Button
                type="submit"
                className="w-full bg-primary text-white hover:bg-primary/90 h-12 text-base font-semibold"
                disabled={mutation.isPending}
              >
                {mutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...</>
                ) : (
                  "Book Free Consultation"
                )}
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                By submitting, you agree to our privacy policy. This consultation is free and does not create an attorney-client relationship.
              </p>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
