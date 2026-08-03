import { useCallback, useEffect, useRef, useState } from "react";
import { useListSettings, useUpdateSettings, getListSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, Building2, Phone, Clock, Share2, Briefcase, MessageCircle, Wifi, WifiOff, Loader2, Info, Globe, CreditCard, Upload, Trash2, ImageIcon, Activity } from "lucide-react";
import { SITE_SETTINGS_QUERY_KEY } from "@/hooks/useSiteSettings";

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
  {
    id: "branding",
    label: "Website & Branding",
    icon: Globe,
    keys: ["logo_url", "website_whatsapp", "support_email", "footer_text", "copyright_text"],
  },
  {
    id: "firm_pdf",
    label: "Firm Details (PDF)",
    icon: CreditCard,
    keys: ["firm_name", "firm_tagline", "firm_address", "firm_phone", "firm_email", "firm_gstin", "firm_pan", "bank_name", "bank_account_no", "bank_ifsc", "bank_upi"],
  },
];

const KEY_LABELS: Record<string, { label: string; placeholder: string; multiline?: boolean; type?: "select"; options?: string[] }> = {
  site_name: { label: "Firm Name", placeholder: "Legal Filing India India's Trusted Filing Platform" },
  site_tagline: { label: "Tagline", placeholder: "India's Premium Legal Network" },
  gst_number: { label: "GST Number", placeholder: "27AABCV1234F1Z5" },
  phone_primary: { label: "Primary Phone", placeholder: "1800-123-4567" },
  phone_secondary: { label: "Secondary Phone", placeholder: "+91 22 6789 0123" },
  email_primary: { label: "Primary Email", placeholder: "consult@legalfilingindia.com" },
  email_secondary: { label: "Secondary Email", placeholder: "info@legalfilingindia.com" },
  address: { label: "Office Address", placeholder: "Level 7, Capital Building...", multiline: true },
  hours_weekdays: { label: "Monday – Friday", placeholder: "9:00 AM – 7:00 PM" },
  hours_saturday: { label: "Saturday", placeholder: "10:00 AM – 4:00 PM" },
  hours_sunday: { label: "Sunday", placeholder: "Closed" },
  linkedin_url: { label: "LinkedIn URL", placeholder: "https://linkedin.com/company/legalfilingindia" },
  twitter_url: { label: "Twitter/X URL", placeholder: "https://twitter.com/legalfilingindia" },
  facebook_url: { label: "Facebook URL", placeholder: "https://facebook.com/legalfilingindia" },
  instagram_url: { label: "Instagram URL", placeholder: "https://instagram.com/legalfilingindia" },
  // WhatsApp
  company_whatsapp:            { label: "Company WhatsApp Number (CRM)", placeholder: "+91 98765 43210" },
  whatsapp_provider:           { label: "Provider", placeholder: "web", type: "select" as const, options: ["web", "waba", "twilio", "360dialog", "gupshup", "interakt"] },
  whatsapp_api_key:            { label: "API Key / Token", placeholder: "Leave blank if using WhatsApp Web" },
  whatsapp_phone_number_id:    { label: "Phone Number ID (WABA)", placeholder: "Meta phone_number_id" },
  whatsapp_business_account_id:{ label: "Business Account ID (WABA)", placeholder: "Meta waba_id" },
  // Branding
  logo_url:        { label: "Logo URL", placeholder: "https://yoursite.com/logo.png" },
  website_whatsapp:{ label: "WhatsApp Number (Website Link)", placeholder: "+91 98765 43210 — shown as click-to-chat on website" },
  support_email:   { label: "Support Email", placeholder: "support@legalfilingindia.com — shown in footer & contact section" },
  footer_text:     { label: "Footer Description Text", placeholder: "Short description shown under your logo in the footer", multiline: true },
  copyright_text:  { label: "Copyright Text", placeholder: `© ${new Date().getFullYear()} Legal Filing India All rights reserved.` },
  // Firm details for PDFs
  firm_name:       { label: "Firm Name (PDF header)", placeholder: "Legal Filing India" },
  firm_tagline:    { label: "Tagline / Designation (PDF)", placeholder: "Advocates & Legal Consultants" },
  firm_address:    { label: "Registered Address (PDF)", placeholder: "123, Legal Complex, Connaught Place, New Delhi — 110001", multiline: true },
  firm_phone:      { label: "Phone (PDF)", placeholder: "+91 98765 43210" },
  firm_email:      { label: "Email (PDF)", placeholder: "info@legalfilingindia.com" },
  firm_gstin:      { label: "GSTIN (PDF)", placeholder: "07AABCV1234P1Z5" },
  firm_pan:        { label: "PAN (PDF)", placeholder: "AABCV1234P" },
  bank_name:       { label: "Bank Name & Branch", placeholder: "HDFC Bank, New Delhi" },
  bank_account_no: { label: "Account Number", placeholder: "12345678901234" },
  bank_ifsc:       { label: "IFSC Code", placeholder: "HDFC0001234" },
  bank_upi:        { label: "UPI ID", placeholder: "legalfilingindia@hdfcbank" },
};

const PROVIDER_HINTS: Record<string, { name: string; hint: string; needsKey: boolean; needsPhoneId: boolean }> = {
  web:       { name: "WhatsApp Web",  hint: "No API needed. Staff send via whatsapp.com. Suitable for small volumes.", needsKey: false, needsPhoneId: false },
  waba:      { name: "Meta WABA",     hint: "Meta Cloud API. Enter your System User Token as API Key and the Phone Number ID from Meta Business Manager.", needsKey: true, needsPhoneId: true },
  twilio:    { name: "Twilio",        hint: "Enter credentials as AccountSID:AuthToken in the API Key field. Phone Number ID is your Twilio WhatsApp-enabled number (e.g. +14155238886).", needsKey: true, needsPhoneId: true },
  "360dialog": { name: "360dialog",  hint: "Enter your 360dialog partner API key. Phone Number ID is optional for account-level actions.", needsKey: true, needsPhoneId: false },
  gupshup:   { name: "Gupshup",      hint: "Enter your Gupshup App API key. Phone Number ID is your registered source number.", needsKey: true, needsPhoneId: true },
  interakt:  { name: "Interakt",      hint: "Enter your Interakt API key. Phone Number ID is not required for Interakt.", needsKey: true, needsPhoneId: false },
};

type TestStatus = { ok: boolean; message: string } | null;
type HealthStatus = { ok: boolean; db: string; uptime: number } | null;

export default function AdminSettings() {
  const queryClient = useQueryClient();
  const { data: settings } = useListSettings();
  const updateMutation = useUpdateSettings();
  const { toast } = useToast();

  const [values, setValues] = useState<Record<string, string>>({});
  const [activeGroup, setActiveGroup] = useState("firm");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestStatus>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoRemoving, setLogoRemoving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [health, setHealth] = useState<HealthStatus>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  const checkHealth = useCallback(async () => {
    try {
      const r = await fetch("/api/health", { credentials: "include" });
      const data = await r.json() as HealthStatus;
      setHealth(data);
    } catch {
      setHealth({ ok: false, db: "unreachable", uptime: 0 });
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // Poll health every 30 s; also check immediately on mount
  useEffect(() => {
    void checkHealth();
    const id = setInterval(() => void checkHealth(), 30_000);
    return () => clearInterval(id);
  }, [checkHealth]);

  useEffect(() => {
    if (settings) {
      const map = settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>);
      setValues(map);
    }
  }, [settings]);

  const setValue = (key: string, val: string) => {
    setValues(v => ({ ...v, [key]: val }));
    if (activeGroup === "whatsapp") setTestResult(null); // reset test on any change
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await fetch("/api/admin/whatsapp/test-connection", {
        method: "POST",
        credentials: "include",
      });
      const data = await r.json() as { ok: boolean; message: string };
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, message: "Could not reach the server. Please check your connection." });
    } finally {
      setTesting(false);
    }
  };

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
          queryClient.invalidateQueries({ queryKey: SITE_SETTINGS_QUERY_KEY });
          toast({ title: "Settings saved", description: `${group.label} updated successfully` });
          setSaving(false);
        },
        onError: () => setSaving(false),
      }
    );
  };

  const handleLogoUpload = async (file: File) => {
    setLogoUploading(true);
    const form = new FormData();
    form.append("logo", file);
    try {
      const r = await fetch("/api/admin/settings/logo", {
        method: "POST",
        credentials: "include",
        body: form,
      });
      if (!r.ok) {
        const err = await r.json() as { error?: string };
        throw new Error(err.error ?? "Upload failed");
      }
      const { logo_url } = await r.json() as { logo_url: string };
      setValue("logo_url", logo_url);
      queryClient.invalidateQueries({ queryKey: getListSettingsQueryKey() });
      queryClient.invalidateQueries({ queryKey: SITE_SETTINGS_QUERY_KEY });
      toast({ title: "Logo uploaded ✓", description: "Navbar and footer will now use your logo." });
    } catch (err) {
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleLogoRemove = async () => {
    setLogoRemoving(true);
    try {
      const r = await fetch("/api/admin/settings/logo", {
        method: "DELETE",
        credentials: "include",
      });
      if (!r.ok) throw new Error("Remove failed");
      setValue("logo_url", "");
      queryClient.invalidateQueries({ queryKey: getListSettingsQueryKey() });
      queryClient.invalidateQueries({ queryKey: SITE_SETTINGS_QUERY_KEY });
      toast({ title: "Logo removed", description: "Default LFI mark will be shown." });
    } catch {
      toast({ title: "Error", description: "Could not remove logo.", variant: "destructive" });
    } finally {
      setLogoRemoving(false);
    }
  };

  const currentGroup = SETTING_GROUPS.find(g => g.id === activeGroup)!;

  const healthBadge = () => {
    if (healthLoading) return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        <Loader2 size={11} className="animate-spin" /> Checking…
      </span>
    );
    if (!health || !health.ok) return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        API {health?.db === "unreachable" ? "unreachable" : `DB ${health?.db ?? "error"}`}
      </span>
    );
    const mins = Math.floor(health.uptime / 60);
    const hrs  = Math.floor(mins / 60);
    const uptimeStr = hrs > 0 ? `${hrs}h ${mins % 60}m` : `${mins}m`;
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        API &amp; DB healthy · up {uptimeStr}
      </span>
    );
  };

  return (
    <AdminLayout title="Site Settings" subtitle="Manage firm contact information, hours and social links">
      {/* Server health banner */}
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Activity size={13} className="text-gray-400" />
          <span>Server status</span>
        </div>
        <div className="flex items-center gap-2">
          {healthBadge()}
          <button onClick={() => { setHealthLoading(true); void checkHealth(); }} className="text-[11px] text-gray-400 hover:text-gray-600 underline-offset-2 hover:underline">refresh</button>
        </div>
      </div>

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

            {/* Logo upload card — Branding group only */}
            {activeGroup === "branding" && (
              <div className="mb-5 p-4 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
                <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5"><ImageIcon size={13} /> Firm Logo</p>
                {values["logo_url"] ? (
                  <div className="flex items-center gap-4">
                    <div className="bg-white border border-gray-200 rounded-lg p-2 shrink-0">
                      <img src={values["logo_url"]} alt="Logo" className="h-12 max-w-[160px] object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => logoInputRef.current?.click()} disabled={logoUploading}>
                        {logoUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />} Replace
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8 text-red-600 border-red-200 hover:bg-red-50" onClick={() => void handleLogoRemove()} disabled={logoRemoving}>
                        {logoRemoving ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />} Remove
                      </Button>
                    </div>
                    <p className="text-[11px] text-gray-400 leading-snug">Shown in navbar,<br/>footer &amp; PDF prints</p>
                  </div>
                ) : (
                  <button onClick={() => logoInputRef.current?.click()} disabled={logoUploading}
                    className="w-full border-2 border-dashed border-gray-300 rounded-xl py-6 flex flex-col items-center gap-2 text-gray-400 hover:border-[#0f2044] hover:text-[#0f2044] transition-colors disabled:opacity-50">
                    {logoUploading ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                    <span className="text-xs font-medium">{logoUploading ? "Uploading…" : "Click to upload logo"}</span>
                    <span className="text-[11px]">PNG, JPG, WebP, SVG · max 5 MB</span>
                  </button>
                )}
                <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/svg+xml" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void handleLogoUpload(f); }} />
              </div>
            )}

            {/* Provider hint banner — WhatsApp group only */}
            {activeGroup === "whatsapp" && (() => {
              const providerKey = values["whatsapp_provider"] ?? "web";
              const hint = PROVIDER_HINTS[providerKey] ?? PROVIDER_HINTS.web;
              return (
                <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-4 text-xs text-blue-800">
                  <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
                  <div>
                    <span className="font-semibold">{hint.name}: </span>{hint.hint}
                    {!hint.needsKey && <span className="ml-1 text-blue-600 font-medium">(API Key not required)</span>}
                  </div>
                </div>
              );
            })()}

            <div className="space-y-4">
              {currentGroup.keys.map(key => {
                // logo_url is rendered separately via the upload card above
                if (key === "logo_url") return null;

                const meta = KEY_LABELS[key] ?? { label: key, placeholder: "" };
                // For WhatsApp group: dim API fields when provider is "web"
                const isWebProvider = activeGroup === "whatsapp" && (values["whatsapp_provider"] ?? "web") === "web";
                const isApiOnlyField = ["whatsapp_api_key", "whatsapp_phone_number_id", "whatsapp_business_account_id"].includes(key);
                const dimField = isWebProvider && isApiOnlyField;
                return (
                  <div key={key} className={dimField ? "opacity-40 pointer-events-none" : ""}>
                    <Label className="text-xs text-gray-700">{meta.label}</Label>
                    {meta.type === "select" ? (
                      <select
                        className="mt-1 h-9 w-full border border-input rounded-md px-3 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                        value={values[key] ?? ""}
                        onChange={e => setValue(key, e.target.value)}
                      >
                        {(meta.options ?? []).map(opt => (
                          <option key={opt} value={opt}>
                            {opt === "web" ? "WhatsApp Web (no API)" :
                             opt === "waba" ? "Meta WABA (Cloud API)" :
                             opt === "twilio" ? "Twilio" :
                             opt === "360dialog" ? "360dialog" :
                             opt === "gupshup" ? "Gupshup" :
                             opt === "interakt" ? "Interakt" : opt}
                          </option>
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
                        type={key === "whatsapp_api_key" ? "password" : "text"}
                        value={values[key] ?? ""}
                        onChange={e => setValue(key, e.target.value)}
                        placeholder={meta.placeholder}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className={`mt-6 flex gap-3 ${activeGroup === "whatsapp" ? "flex-col" : ""}`}>
              <Button
                onClick={handleSave}
                disabled={saving || updateMutation.isPending}
                className="w-full bg-[#0f2044] hover:bg-[#0f2044]/90 text-white gap-2"
              >
                <Save size={14} /> {saving ? "Saving..." : `Save ${currentGroup.label}`}
              </Button>

              {/* Test Connection — WhatsApp group only */}
              {activeGroup === "whatsapp" && (
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={handleTest}
                    disabled={testing}
                    className="w-full gap-2 border-green-300 text-green-700 hover:bg-green-50"
                  >
                    {testing
                      ? <><Loader2 size={14} className="animate-spin" /> Testing…</>
                      : <><Wifi size={14} /> Test Connection</>}
                  </Button>

                  {testResult && (
                    <div className={`flex items-start gap-2.5 rounded-lg px-4 py-3 text-sm border ${
                      testResult.ok
                        ? "bg-green-50 border-green-200 text-green-800"
                        : "bg-red-50 border-red-200 text-red-800"
                    }`}>
                      {testResult.ok
                        ? <Wifi size={15} className="shrink-0 mt-0.5 text-green-600" />
                        : <WifiOff size={15} className="shrink-0 mt-0.5 text-red-500" />}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
