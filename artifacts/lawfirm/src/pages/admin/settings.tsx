import { useEffect, useState } from "react";
import { useListSettings, useUpdateSettings, getListSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Building2, Phone, Clock, Share2, Briefcase, MessageCircle } from "lucide-react";

const SETTING_GROUPS = [
  {
    id: "firm",
    label: "Firm Identity",
    icon: Building2,
    keys: ["site_name", "site_tagline", "gst_number"],
  },
  {
    id: "contact",
    label: "Contact Information",
    icon: Phone,
    keys: ["phone_primary", "phone_secondary", "email_primary", "email_secondary", "address"],
  },
  {
    id: "hours",
    label: "Office Hours",
    icon: Clock,
    keys: ["hours_weekdays", "hours_saturday", "hours_sunday"],
  },
  {
    id: "social",
    label: "Social Media Links",
    icon: Share2,
    keys: ["linkedin_url", "twitter_url", "facebook_url", "instagram_url"],
  },
  {
    id: "whatsapp",
    label: "WhatsApp Settings",
    icon: MessageCircle,
    keys: ["company_whatsapp", "whatsapp_provider", "whatsapp_api_key", "whatsapp_phone_number_id", "whatsapp_business_account_id"],
  },
];

const KEY_LABELS: Record<string, { label: string; placeholder: string; multiline?: boolean; type?: "select"; options?: string[] }> = {
  site_name: { label: "Firm Name", placeholder: "Vakil & Co. Legal Associates" },
  site_tagline: { label: "Tagline", placeholder: "India's Premium Legal Network" },
  gst_number: { label: "GST Number", placeholder: "27AABCV1234F1Z5" },
  phone_primary: { label: "Primary Phone", placeholder: "1800-123-4567" },
  phone_secondary: { label: "Secondary Phone", placeholder: "+91 22 6789 0123" },
  email_primary: { label: "Primary Email", placeholder: "consult@vakilco.in" },
  email_secondary: { label: "Secondary Email", placeholder: "info@vakilco.in" },
  address: { label: "Office Address", placeholder: "Level 7, Capital Building...", multiline: true },
  hours_weekdays: { label: "Monday – Friday", placeholder: "9:00 AM – 7:00 PM" },
  hours_saturday: { label: "Saturday", placeholder: "10:00 AM – 4:00 PM" },
  hours_sunday: { label: "Sunday", placeholder: "Closed" },
  linkedin_url: { label: "LinkedIn URL", placeholder: "https://linkedin.com/company/vakilco" },
  twitter_url: { label: "Twitter/X URL", placeholder: "https://twitter.com/vakilco" },
  facebook_url: { label: "Facebook URL", placeholder: "https://facebook.com/vakilco" },
  instagram_url: { label: "Instagram URL", placeholder: "https://instagram.com/vakilco" },
  // WhatsApp
  company_whatsapp:            { label: "Company WhatsApp Number", placeholder: "+91 98765 43210" },
  whatsapp_provider:           { label: "Provider", placeholder: "web", type: "select" as const, options: ["web", "waba", "twilio", "360dialog", "gupshup", "interakt"] },
  whatsapp_api_key:            { label: "API Key / Token", placeholder: "Leave blank if using WhatsApp Web" },
  whatsapp_phone_number_id:    { label: "Phone Number ID (WABA)", placeholder: "Meta phone_number_id" },
  whatsapp_business_account_id:{ label: "Business Account ID (WABA)", placeholder: "Meta waba_id" },
};

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const { data: settings } = useListSettings();
  const updateMutation = useUpdateSettings();
  const { toast } = useToast();

  const [values, setValues] = useState<Record<string, string>>({});
  const [activeGroup, setActiveGroup] = useState("firm");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      const map = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>);
      setValues(map);
    }
  }, [settings]);

  const setValue = (key: string, val: string) => setValues(v => ({ ...v, [key]: val }));

  const handleSave = () => {
    const group = SETTING_GROUPS.find(g => g.id === activeGroup);
    if (!group) return;
    setSaving(true);
    const settingsList = group.keys.map(key => ({ key, value: values[key] ?? "" }));
    updateMutation.mutate(
      { data: { settings: settingsList } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListSettingsQueryKey() });
          toast({ title: "Settings saved", description: `${group.label} updated successfully` });
          setSaving(false);
        },
        onError: () => setSaving(false),
      }
    );
  };

  const currentGroup = SETTING_GROUPS.find(g => g.id === activeGroup)!;

  return (
    <AdminLayout title="Site Settings" subtitle="Manage firm contact information, hours and social links">
      <div className="flex flex-col lg:flex-row gap-5">
        {/* Group Selector */}
        <div className="lg:w-52 xl:w-64 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                <Briefcase size={12} /> Settings Groups
              </p>
            </div>
            <nav className="p-2 space-y-0.5">
              {SETTING_GROUPS.map(group => (
                <button
                  key={group.id}
                  onClick={() => setActiveGroup(group.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-2.5 ${
                    activeGroup === group.id ? "bg-[#0f2044] text-white" : "text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  <group.icon size={14} className="shrink-0" />
                  {group.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Settings Form */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-3 pb-4 mb-5 border-b border-gray-100">
              <div className="w-9 h-9 rounded-lg bg-[#0f2044]/10 flex items-center justify-center">
                <currentGroup.icon size={16} className="text-[#0f2044]" />
              </div>
              <div>
                <h3 className="font-semibold text-[#0f2044]">{currentGroup.label}</h3>
                <p className="text-xs text-gray-500">Configure {currentGroup.label.toLowerCase()}</p>
              </div>
            </div>

            <div className="space-y-4">
              {currentGroup.keys.map(key => {
                const meta = KEY_LABELS[key] ?? { label: key, placeholder: "" };
                return (
                  <div key={key}>
                    <Label className="text-xs text-gray-700">{meta.label}</Label>
                    {meta.type === "select" ? (
                      <select
                        className="mt-1 h-9 w-full border border-input rounded-md px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        value={values[key] ?? ""}
                        onChange={e => setValue(key, e.target.value)}
                      >
                        {(meta.options ?? []).map(opt => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : meta.multiline ? (
                      <Textarea
                        className="mt-1 text-sm resize-none"
                        rows={3}
                        value={values[key] ?? ""}
                        onChange={e => setValue(key, e.target.value)}
                        placeholder={meta.placeholder}
                      />
                    ) : (
                      <Input
                        className="mt-1 h-9 text-sm"
                        value={values[key] ?? ""}
                        onChange={e => setValue(key, e.target.value)}
                        placeholder={meta.placeholder}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <Button
              onClick={handleSave}
              disabled={saving || updateMutation.isPending}
              className="mt-6 w-full bg-[#0f2044] hover:bg-[#0f2044]/90 text-white gap-2"
            >
              <Save size={14} /> {saving ? "Saving..." : `Save ${currentGroup.label}`}
            </Button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
