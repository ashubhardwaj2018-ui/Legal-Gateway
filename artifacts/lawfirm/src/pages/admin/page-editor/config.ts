import {
  Home, Info, Briefcase, Phone, HelpCircle,
  Shield, RefreshCcw, FileText, Layout, AlignLeft, Rocket,
} from "lucide-react";

export type BlockType = "text" | "textarea" | "richtext" | "image" | "video" | "button" | "html";

export interface Block {
  id: string;
  label: string;
  type: BlockType;
  hint?: string;
  placeholder?: string;
  superAdminOnly?: boolean;
}

export interface Section {
  id: string;
  title: string;
  blocks: Block[];
}

export interface PageDef {
  id: string;
  name: string;
  icon: React.ElementType;
  url: string;
  description: string;
  sections: Section[];
}

export const PAGES: PageDef[] = [
  // ── Homepage ──────────────────────────────────────────────────────────────
  {
    id: "home", name: "Homepage", icon: Home, url: "/",
    description: "Main landing page visible to all visitors",
    sections: [
      {
        id: "hero", title: "Hero Banner",
        blocks: [
          { id: "hero_badge",          label: "Top Badge Text",          type: "text",     placeholder: "India's Premium Legal Network" },
          { id: "hero_title",          label: "Headline — Line 1",       type: "text",     placeholder: "Expert Legal Counsel," },
          { id: "hero_subtitle",       label: "Headline — Line 2 (gold)",type: "text",     placeholder: "Made Accessible." },
          { id: "hero_description",    label: "Sub-description Paragraph",type: "textarea", placeholder: "From protecting your intellectual property..." },
          { id: "hero_cta_primary",    label: "Primary CTA Button",      type: "button",   placeholder: "Book Free Consultation" },
          { id: "hero_cta_secondary",  label: "Secondary CTA Button",    type: "button",   placeholder: "View Services" },
          { id: "hero_image",          label: "Hero Feature Image URL",  type: "image",    hint: "Displayed alongside the headline" },
        ],
      },
      {
        id: "stats", title: "Trust Stats",
        blocks: [
          { id: "stat_1_value", label: "Stat 1 — Number", type: "text", placeholder: "5000+" },
          { id: "stat_1_label", label: "Stat 1 — Label",  type: "text", placeholder: "Clients Served" },
          { id: "stat_2_value", label: "Stat 2 — Number", type: "text", placeholder: "15+" },
          { id: "stat_2_label", label: "Stat 2 — Label",  type: "text", placeholder: "Years Experience" },
          { id: "stat_3_value", label: "Stat 3 — Number", type: "text", placeholder: "98%" },
          { id: "stat_3_label", label: "Stat 3 — Label",  type: "text", placeholder: "Success Rate" },
          { id: "stat_4_value", label: "Stat 4 — Number", type: "text", placeholder: "500+" },
          { id: "stat_4_label", label: "Stat 4 — Label",  type: "text", placeholder: "Legal Experts" },
        ],
      },
      {
        id: "features", title: "Why Choose Us",
        blocks: [
          { id: "features_heading", label: "Section Heading", type: "text", placeholder: "Why Clients Trust Us" },
          { id: "feature_1_title", label: "Feature 1 — Title",       type: "text" },
          { id: "feature_1_desc",  label: "Feature 1 — Description", type: "textarea" },
          { id: "feature_2_title", label: "Feature 2 — Title",       type: "text" },
          { id: "feature_2_desc",  label: "Feature 2 — Description", type: "textarea" },
          { id: "feature_3_title", label: "Feature 3 — Title",       type: "text" },
          { id: "feature_3_desc",  label: "Feature 3 — Description", type: "textarea" },
        ],
      },
      {
        id: "process", title: "How It Works",
        blocks: [
          { id: "process_title",  label: "Section Title",       type: "text" },
          { id: "process_desc",   label: "Section Description", type: "textarea" },
          { id: "process_step_1", label: "Step 1",              type: "text" },
          { id: "process_step_2", label: "Step 2",              type: "text" },
          { id: "process_step_3", label: "Step 3",              type: "text" },
          { id: "process_step_4", label: "Step 4",              type: "text" },
        ],
      },
      {
        id: "cta", title: "Bottom CTA Banner",
        blocks: [
          { id: "cta_title",       label: "CTA Headline",    type: "text" },
          { id: "cta_desc",        label: "CTA Description", type: "textarea" },
          { id: "cta_button_text", label: "CTA Button Text", type: "button" },
        ],
      },
      {
        id: "custom_html_home", title: "Custom HTML Block",
        blocks: [
          { id: "custom_html", label: "Custom HTML (Super Admin Only)", type: "html", superAdminOnly: true, hint: "Raw HTML injected into the page" },
        ],
      },
    ],
  },

  // ── About ─────────────────────────────────────────────────────────────────
  {
    id: "about", name: "About Us", icon: Info, url: "/about",
    description: "Your firm's story, values, and team",
    sections: [
      {
        id: "hero", title: "Hero Section",
        blocks: [
          { id: "hero_badge",       label: "Top Badge",                type: "text" },
          { id: "hero_title",       label: "Headline — Line 1",        type: "text" },
          { id: "hero_subtitle",    label: "Headline — Line 2 (gold)", type: "text" },
          { id: "hero_description", label: "Description Paragraph",    type: "textarea" },
        ],
      },
      {
        id: "stats", title: "Stats Bar",
        blocks: [
          { id: "stat_1_value", label: "Stat 1 — Number", type: "text" },
          { id: "stat_1_label", label: "Stat 1 — Label",  type: "text" },
          { id: "stat_2_value", label: "Stat 2 — Number", type: "text" },
          { id: "stat_2_label", label: "Stat 2 — Label",  type: "text" },
          { id: "stat_3_value", label: "Stat 3 — Number", type: "text" },
          { id: "stat_3_label", label: "Stat 3 — Label",  type: "text" },
          { id: "stat_4_value", label: "Stat 4 — Number", type: "text" },
          { id: "stat_4_label", label: "Stat 4 — Label",  type: "text" },
        ],
      },
      {
        id: "story", title: "Our Story",
        blocks: [
          { id: "story_heading", label: "Story Heading",      type: "text" },
          { id: "story_content", label: "Story Body (Rich Text)", type: "richtext" },
        ],
      },
      {
        id: "values", title: "Our Values",
        blocks: [
          { id: "values_heading", label: "Section Heading",      type: "text" },
          { id: "values_content", label: "Values (Rich Text)", type: "richtext" },
        ],
      },
    ],
  },

  // ── Services ──────────────────────────────────────────────────────────────
  {
    id: "services", name: "Services", icon: Briefcase, url: "/services",
    description: "Services listing page",
    sections: [
      {
        id: "hero", title: "Hero Section",
        blocks: [
          { id: "hero_badge",       label: "Top Badge",                type: "text" },
          { id: "hero_title",       label: "Headline — Line 1",        type: "text" },
          { id: "hero_subtitle",    label: "Headline — Line 2 (gold)", type: "text" },
          { id: "hero_description", label: "Description Paragraph",    type: "textarea" },
        ],
      },
      {
        id: "intro", title: "Services Introduction",
        blocks: [
          { id: "services_intro_heading", label: "Intro Heading",        type: "text" },
          { id: "services_intro_body",    label: "Intro Body (Rich Text)", type: "richtext" },
          { id: "services_video",         label: "Intro Video URL",       type: "video", hint: "YouTube or Vimeo embed link" },
        ],
      },
      {
        id: "cta", title: "Services CTA",
        blocks: [
          { id: "services_cta_title",  label: "CTA Heading",     type: "text" },
          { id: "services_cta_desc",   label: "CTA Description", type: "textarea" },
          { id: "services_cta_button", label: "CTA Button",      type: "button" },
        ],
      },
    ],
  },

  // ── Contact ───────────────────────────────────────────────────────────────
  {
    id: "contact", name: "Contact", icon: Phone, url: "/contact",
    description: "Contact page — office details and form",
    sections: [
      {
        id: "hero", title: "Hero Section",
        blocks: [
          { id: "contact_hero_title", label: "Page Title",   type: "text", placeholder: "Get In Touch" },
          { id: "contact_hero_desc",  label: "Description",  type: "textarea" },
        ],
      },
      {
        id: "office", title: "Office Details",
        blocks: [
          { id: "contact_address_heading", label: "Address Section Heading", type: "text" },
          { id: "contact_address",         label: "Full Address",             type: "textarea" },
          { id: "contact_phone_heading",   label: "Phone Section Heading",   type: "text" },
          { id: "contact_email_heading",   label: "Email Section Heading",   type: "text" },
          { id: "contact_hours_heading",   label: "Hours Section Heading",   type: "text" },
          { id: "contact_map_embed",       label: "Google Maps Embed URL",   type: "text", hint: "src URL from Google Maps embed" },
        ],
      },
      {
        id: "form_labels", title: "Contact Form Labels",
        blocks: [
          { id: "form_name_label",    label: "Name Field Label",    type: "text", placeholder: "Your Full Name" },
          { id: "form_email_label",   label: "Email Field Label",   type: "text", placeholder: "Email Address" },
          { id: "form_phone_label",   label: "Phone Field Label",   type: "text", placeholder: "Phone Number" },
          { id: "form_message_label", label: "Message Field Label", type: "text", placeholder: "How can we help?" },
          { id: "form_submit_button", label: "Submit Button Text",  type: "button", placeholder: "Send Message" },
        ],
      },
    ],
  },

  // ── FAQs ──────────────────────────────────────────────────────────────────
  {
    id: "faqs", name: "FAQs", icon: HelpCircle, url: "/faqs",
    description: "Frequently asked questions page",
    sections: [
      {
        id: "hero", title: "Page Header",
        blocks: [
          { id: "faqs_hero_title", label: "Page Title",   type: "text", placeholder: "Frequently Asked Questions" },
          { id: "faqs_hero_desc",  label: "Description",  type: "textarea" },
        ],
      },
      {
        id: "faq_content", title: "FAQ Content",
        blocks: [
          { id: "faq_body", label: "FAQ Items (Rich Text)", type: "richtext", hint: "Use heading 3 for questions, paragraph for answers" },
        ],
      },
    ],
  },

  // ── Privacy Policy ────────────────────────────────────────────────────────
  {
    id: "privacy-policy", name: "Privacy Policy", icon: Shield, url: "/privacy-policy",
    description: "Privacy policy page",
    sections: [
      {
        id: "header", title: "Page Header",
        blocks: [
          { id: "hero_title",    label: "Page Title",        type: "text", placeholder: "Privacy Policy" },
          { id: "last_updated",  label: "Last Updated Date", type: "text", placeholder: "January 2025" },
          { id: "intro_text",    label: "Introduction",      type: "textarea" },
        ],
      },
      {
        id: "body", title: "Policy Body",
        blocks: [
          { id: "policy_body", label: "Full Policy Content (Rich Text)", type: "richtext" },
        ],
      },
    ],
  },

  // ── Refund Policy ─────────────────────────────────────────────────────────
  {
    id: "refund-policy", name: "Refund Policy", icon: RefreshCcw, url: "/refund-policy",
    description: "Refund and cancellation policy",
    sections: [
      {
        id: "header", title: "Page Header",
        blocks: [
          { id: "hero_title",   label: "Page Title",        type: "text", placeholder: "Refund Policy" },
          { id: "last_updated", label: "Last Updated Date", type: "text", placeholder: "January 2025" },
          { id: "intro_text",   label: "Introduction",      type: "textarea" },
        ],
      },
      {
        id: "body", title: "Refund Policy Body",
        blocks: [
          { id: "refund_body", label: "Full Refund Policy (Rich Text)", type: "richtext" },
        ],
      },
    ],
  },

  // ── Terms of Use ──────────────────────────────────────────────────────────
  {
    id: "terms-of-use", name: "Terms of Use", icon: FileText, url: "/terms-of-use",
    description: "Terms of use / Terms & conditions",
    sections: [
      {
        id: "header", title: "Page Header",
        blocks: [
          { id: "hero_title",   label: "Page Title",        type: "text", placeholder: "Terms of Use" },
          { id: "last_updated", label: "Last Updated Date", type: "text", placeholder: "January 2025" },
          { id: "intro_text",   label: "Introduction",      type: "textarea" },
        ],
      },
      {
        id: "body", title: "Terms Body",
        blocks: [
          { id: "terms_body", label: "Full Terms Content (Rich Text)", type: "richtext" },
        ],
      },
    ],
  },

  // ── Footer ────────────────────────────────────────────────────────────────
  {
    id: "footer", name: "Footer", icon: Layout, url: "/",
    description: "Site-wide footer content and links",
    sections: [
      {
        id: "brand", title: "Brand Section",
        blocks: [
          { id: "footer_tagline",     label: "Tagline / About Text", type: "textarea" },
          { id: "footer_copyright",   label: "Copyright Text",       type: "text", placeholder: "© 2025 Legal Filing India All rights reserved." },
          { id: "footer_bottom_note", label: "Bottom Legal Note",    type: "text" },
        ],
      },
      {
        id: "links_col1", title: "Quick Links Column (Heading & Labels)",
        blocks: [
          { id: "footer_col1_heading", label: "Column 1 Heading",       type: "text", placeholder: "Quick Links" },
          { id: "footer_col2_heading", label: "Column 2 Heading",       type: "text", placeholder: "Practice Areas" },
          { id: "footer_col3_heading", label: "Column 3 Heading",       type: "text", placeholder: "Contact Us" },
        ],
      },
      {
        id: "newsletter", title: "Newsletter Section",
        blocks: [
          { id: "footer_newsletter_heading",     label: "Newsletter Heading",       type: "text" },
          { id: "footer_newsletter_desc",        label: "Newsletter Description",   type: "text" },
          { id: "footer_newsletter_placeholder", label: "Email Input Placeholder",  type: "text" },
          { id: "footer_newsletter_btn",         label: "Subscribe Button Text",    type: "button" },
        ],
      },
    ],
  },

  // ── Header ────────────────────────────────────────────────────────────────
  {
    id: "header", name: "Header / Nav", icon: AlignLeft, url: "/",
    description: "Site-wide header — announcement bar and navigation CTA",
    sections: [
      {
        id: "announcement", title: "Announcement Bar",
        blocks: [
          { id: "announcement_text",    label: "Announcement Text",          type: "text", hint: "Leave blank to hide the bar" },
          { id: "announcement_cta",     label: "Announcement CTA Link Text", type: "text" },
          { id: "announcement_cta_url", label: "Announcement CTA URL",       type: "text" },
        ],
      },
      {
        id: "nav", title: "Navigation",
        blocks: [
          { id: "nav_cta_text", label: "Nav CTA Button Text", type: "button", placeholder: "Free Consultation" },
          { id: "nav_cta_url",  label: "Nav CTA Button URL",  type: "text",   placeholder: "/contact" },
          { id: "nav_phone",    label: "Header Phone Number", type: "text" },
        ],
      },
    ],
  },

  // ── Landing Pages ─────────────────────────────────────────────────────────
  {
    id: "landing", name: "Landing Pages", icon: Rocket, url: "/landing",
    description: "Custom campaign landing page",
    sections: [
      {
        id: "lp_hero", title: "Hero",
        blocks: [
          { id: "lp_badge",       label: "Badge Text",              type: "text" },
          { id: "lp_title",       label: "Headline",                type: "text" },
          { id: "lp_subtitle",    label: "Sub-headline (gold)",     type: "text" },
          { id: "lp_description", label: "Description",             type: "textarea" },
          { id: "lp_hero_image",  label: "Hero Image URL",          type: "image" },
          { id: "lp_cta_primary", label: "Primary CTA Button",      type: "button" },
          { id: "lp_video",       label: "Promo Video URL",         type: "video" },
        ],
      },
      {
        id: "lp_body", title: "Body Content",
        blocks: [
          { id: "lp_body_content", label: "Body Content (Rich Text)", type: "richtext" },
        ],
      },
      {
        id: "lp_cta", title: "Bottom CTA",
        blocks: [
          { id: "lp_cta_title",  label: "CTA Headline",    type: "text" },
          { id: "lp_cta_desc",   label: "CTA Description", type: "textarea" },
          { id: "lp_cta_button", label: "CTA Button",      type: "button" },
        ],
      },
      {
        id: "lp_html", title: "Custom HTML",
        blocks: [
          { id: "lp_custom_html", label: "Custom HTML (Super Admin Only)", type: "html", superAdminOnly: true },
        ],
      },
    ],
  },
];
