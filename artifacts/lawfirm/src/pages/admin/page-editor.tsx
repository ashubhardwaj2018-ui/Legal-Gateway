import { AdminLayout } from "./AdminLayout";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Save, Eye, Loader2, CheckCircle2, Home, Info, Briefcase, Shield, FileText, AlertCircle } from "lucide-react";

type FieldType = "text" | "textarea";

type FieldDef = {
  id: string;
  label: string;
  type: FieldType;
  hint?: string;
  placeholder?: string;
};

type SectionDef = {
  title: string;
  fields: FieldDef[];
};

type PageDef = {
  id: string;
  name: string;
  icon: React.ElementType;
  url: string;
  description: string;
  sections: SectionDef[];
};

const PAGES: PageDef[] = [
  {
    id: "home",
    name: "Home Page",
    icon: Home,
    url: "/",
    description: "Main landing page visible to all visitors",
    sections: [
      {
        title: "Hero Banner",
        fields: [
          { id: "hero_badge", label: "Top Badge Text", type: "text", hint: "Small text shown in the gold badge above the headline", placeholder: "India's Premium Legal Network" },
          { id: "hero_title", label: "Headline — Line 1", type: "text", placeholder: "Expert Legal Counsel," },
          { id: "hero_subtitle", label: "Headline — Line 2 (displays in gold colour)", type: "text", placeholder: "Made Accessible." },
          { id: "hero_description", label: "Subtitle / Description Paragraph", type: "textarea", placeholder: "From protecting your intellectual property to complex corporate litigation..." },
        ],
      },
      {
        title: "Trust Stats (4 numbers shown on the home page and about page)",
        fields: [
          { id: "stat_1_value", label: "Stat 1 — Number", type: "text", placeholder: "5000+" },
          { id: "stat_1_label", label: "Stat 1 — Label", type: "text", placeholder: "Clients Served" },
          { id: "stat_2_value", label: "Stat 2 — Number", type: "text", placeholder: "15+" },
          { id: "stat_2_label", label: "Stat 2 — Label", type: "text", placeholder: "Years Experience" },
          { id: "stat_3_value", label: "Stat 3 — Number", type: "text", placeholder: "98%" },
          { id: "stat_3_label", label: "Stat 3 — Label", type: "text", placeholder: "Success Rate" },
          { id: "stat_4_value", label: "Stat 4 — Number", type: "text", placeholder: "500+" },
          { id: "stat_4_label", label: "Stat 4 — Label", type: "text", placeholder: "Legal Experts" },
        ],
      },
      {
        title: "Why Choose Us — 3 Features",
        fields: [
          { id: "feature_1_title", label: "Feature 1 — Title", type: "text", placeholder: "Absolute Confidentiality" },
          { id: "feature_1_desc", label: "Feature 1 — Description", type: "textarea", placeholder: "Your data and legal matters are protected with bank-grade security and strict NDAs." },
          { id: "feature_2_title", label: "Feature 2 — Title", type: "text", placeholder: "Transparent Timelines" },
          { id: "feature_2_desc", label: "Feature 2 — Description", type: "textarea", placeholder: "Clear deadlines for every milestone. Track your case progress in real-time." },
          { id: "feature_3_title", label: "Feature 3 — Title", type: "text", placeholder: "Specialized Experts" },
          { id: "feature_3_desc", label: "Feature 3 — Description", type: "textarea", placeholder: "Work with lawyers who specialize exclusively in your specific legal requirement." },
        ],
      },
      {
        title: "How It Works Section",
        fields: [
          { id: "process_title", label: "Section Title", type: "text", placeholder: "Legal Solutions, Simplified." },
          { id: "process_desc", label: "Section Description", type: "textarea", placeholder: "We've streamlined the process of getting expert legal help..." },
        ],
      },
      {
        title: "Bottom CTA Banner",
        fields: [
          { id: "cta_title", label: "CTA Headline", type: "text", placeholder: "Ready to Get Started?" },
          { id: "cta_desc", label: "CTA Description", type: "textarea", placeholder: "Book a free consultation with our expert lawyers..." },
        ],
      },
    ],
  },
  {
    id: "about",
    name: "About Us",
    icon: Info,
    url: "/about",
    description: "About page — your firm's story and values",
    sections: [
      {
        title: "Hero Section",
        fields: [
          { id: "hero_badge", label: "Top Badge", type: "text", placeholder: "Est. 2009 · Mumbai, India" },
          { id: "hero_title", label: "Headline — Line 1", type: "text", placeholder: "India's Trusted" },
          { id: "hero_subtitle", label: "Headline — Line 2 (gold)", type: "text", placeholder: "Legal Partner" },
          { id: "hero_description", label: "Description Paragraph", type: "textarea", placeholder: "For over 15 years, Vakil & Co. has been at the forefront of making premium legal services accessible..." },
        ],
      },
      {
        title: "Stats Bar",
        fields: [
          { id: "stat_1_value", label: "Stat 1 — Number", type: "text", placeholder: "5,000+" },
          { id: "stat_1_label", label: "Stat 1 — Label", type: "text", placeholder: "Clients Served" },
          { id: "stat_2_value", label: "Stat 2 — Number", type: "text", placeholder: "15+" },
          { id: "stat_2_label", label: "Stat 2 — Label", type: "text", placeholder: "Years Experience" },
          { id: "stat_3_value", label: "Stat 3 — Number", type: "text", placeholder: "500+" },
          { id: "stat_3_label", label: "Stat 3 — Label", type: "text", placeholder: "Legal Experts" },
          { id: "stat_4_value", label: "Stat 4 — Number", type: "text", placeholder: "12" },
          { id: "stat_4_label", label: "Stat 4 — Label", type: "text", placeholder: "Cities Across India" },
        ],
      },
    ],
  },
  {
    id: "careers",
    name: "Careers Page",
    icon: Briefcase,
    url: "/careers",
    description: "Careers & job openings page",
    sections: [
      {
        title: "Hero Section",
        fields: [
          { id: "hero_title", label: "Page Title", type: "text", placeholder: "Join Our Team" },
          { id: "hero_description", label: "Description", type: "textarea", placeholder: "Be part of India's fastest-growing legal network..." },
        ],
      },
    ],
  },
  {
    id: "privacy-policy",
    name: "Privacy Policy",
    icon: Shield,
    url: "/privacy-policy",
    description: "Privacy policy page",
    sections: [
      {
        title: "Page Header",
        fields: [
          { id: "hero_title", label: "Page Title", type: "text", placeholder: "Privacy Policy" },
          { id: "last_updated", label: "Last Updated Date", type: "text", placeholder: "January 2024" },
          { id: "intro_text", label: "Introduction Paragraph", type: "textarea", placeholder: "This Privacy Policy describes how Vakil & Co. Legal Associates collects, uses, and shares information..." },
        ],
      },
    ],
  },
  {
    id: "terms-of-use",
    name: "Terms of Use",
    icon: FileText,
    url: "/terms-of-use",
    description: "Terms of use / Terms & conditions page",
    sections: [
      {
        title: "Page Header",
        fields: [
          { id: "hero_title", label: "Page Title", type: "text", placeholder: "Terms of Use" },
          { id: "last_updated", label: "Last Updated Date", type: "text", placeholder: "January 2024" },
          { id: "intro_text", label: "Introduction Paragraph", type: "textarea", placeholder: "These Terms of Use govern your access to and use of the Vakil & Co. website and services." },
        ],
      },
    ],
  },
];

export default function AdminPageEditor() {
  const [selectedPageId, setSelectedPageId] = useState("home");
  const [content, setContent] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [saveError, setSaveError] = useState("");

  const selectedPage = PAGES.find(p => p.id === selectedPageId)!;

  const { data, isLoading } = useQuery<{ page: string; content: Record<string, string> }>({
    queryKey: ["admin-page-content", selectedPageId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/pages/${selectedPageId}`, { credentials: "include" });
      if (!r.ok) return { page: selectedPageId, content: {} };
      return r.json();
    },
  });

  useEffect(() => {
    if (data) {
      setContent(data.content ?? {});
    }
    setSavedAt(null);
    setSaveError("");
  }, [data, selectedPageId]);

  function handlePageSelect(pageId: string) {
    setSelectedPageId(pageId);
    setContent({});
    setSavedAt(null);
    setSaveError("");
  }

  function handleChange(fieldId: string, value: string) {
    setContent(prev => ({ ...prev, [fieldId]: value }));
    setSavedAt(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    try {
      const r = await fetch(`/api/admin/pages/${selectedPageId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!r.ok) throw new Error("Save failed");
      setSavedAt(new Date());
    } catch {
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout
      title="Page Editor"
      subtitle="Edit any page on your website — changes go live instantly, no coding needed"
    >
      <div className="flex h-full min-h-0 gap-0 -m-6">

        {/* Left: Page List */}
        <div className="w-52 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Select a Page</p>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {PAGES.map(page => {
              const Icon = page.icon;
              const isActive = selectedPageId === page.id;
              return (
                <button
                  key={page.id}
                  onClick={() => handlePageSelect(page.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
                    isActive
                      ? "bg-[#0f2044] text-white"
                      : "text-gray-700 hover:bg-white hover:text-[#0f2044]"
                  }`}
                >
                  <Icon size={16} className={isActive ? "text-[#c9a227]" : "text-gray-400"} />
                  <div>
                    <div className="font-medium">{page.name}</div>
                  </div>
                </button>
              );
            })}
          </div>
          <div className="border-t border-gray-200 p-4">
            <p className="text-xs text-gray-400 leading-relaxed">
              Leave a field blank to use the default text already on the page.
            </p>
          </div>
        </div>

        {/* Right: Editor */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">

          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white flex-shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-gray-900">{selectedPage.name}</h2>
                <span className="text-xs text-gray-400 font-mono bg-gray-100 rounded px-2 py-0.5">{selectedPage.url}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{selectedPage.description}</p>
            </div>
            <div className="flex items-center gap-3">
              {savedAt && (
                <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
                  <CheckCircle2 size={13} /> Saved successfully
                </span>
              )}
              {saveError && (
                <span className="flex items-center gap-1.5 text-xs text-red-500">
                  <AlertCircle size={13} /> {saveError}
                </span>
              )}
              <a
                href={selectedPage.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors font-medium"
              >
                <Eye size={14} /> View Live Page
              </a>
              <button
                onClick={handleSave}
                disabled={saving || isLoading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#0f2044] text-white rounded-lg hover:bg-[#0f2044]/90 disabled:opacity-60 transition-colors font-medium"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {isLoading ? (
              <div className="flex items-center gap-3 text-gray-400 py-12 justify-center">
                <Loader2 size={22} className="animate-spin" />
                <span>Loading page content…</span>
              </div>
            ) : (
              <>
                {/* Info banner */}
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700">
                  <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                  <div>
                    <strong>How this works:</strong> Type in any field below and click <strong>Save Changes</strong>. Your website updates immediately. Leave a field empty to keep the existing default text.
                  </div>
                </div>

                {selectedPage.sections.map(section => (
                  <div key={section.title} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                    <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700">{section.title}</h3>
                    </div>
                    <div className="p-5 space-y-4">
                      {section.fields.map(field => (
                        <div key={field.id}>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">
                            {field.label}
                            {field.hint && (
                              <span className="ml-2 text-xs text-gray-400 font-normal">({field.hint})</span>
                            )}
                          </label>
                          {field.type === "textarea" ? (
                            <textarea
                              rows={3}
                              value={content[field.id] ?? ""}
                              onChange={e => handleChange(field.id, e.target.value)}
                              placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}…`}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 focus:border-[#0f2044] resize-y transition placeholder:text-gray-300"
                            />
                          ) : (
                            <input
                              type="text"
                              value={content[field.id] ?? ""}
                              onChange={e => handleChange(field.id, e.target.value)}
                              placeholder={field.placeholder ?? `Enter ${field.label.toLowerCase()}…`}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 focus:border-[#0f2044] transition placeholder:text-gray-300"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                <div className="flex justify-end pb-4">
                  <button
                    onClick={handleSave}
                    disabled={saving || isLoading}
                    className="flex items-center gap-2 px-6 py-2.5 text-sm bg-[#0f2044] text-white rounded-lg hover:bg-[#0f2044]/90 disabled:opacity-60 transition-colors font-medium shadow-sm"
                  >
                    {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {saving ? "Saving…" : "Save All Changes"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
