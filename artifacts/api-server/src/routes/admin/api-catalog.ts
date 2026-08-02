export interface ApiField {
  key:         string;
  label:       string;
  sensitive?:  boolean;   // encrypted, never returned to client
  placeholder?: string;
  type?:       "text" | "url" | "password" | "textarea";
  hint?:       string;
}

export interface ApiDefinition {
  slug:        string;
  name:        string;
  category:    string;
  description: string;
  docsUrl?:    string;
  fields:      ApiField[];
  testable?:   boolean;
  badge?:      string;      // e.g. "Popular"
}

export const API_CATALOG: ApiDefinition[] = [
  // ── AI ──────────────────────────────────────────────────────────────────────
  {
    slug: "openai", name: "OpenAI", category: "ai",
    description: "GPT-4, GPT-3.5, embeddings, assistants, DALL-E",
    docsUrl: "https://platform.openai.com/docs",
    badge: "Popular",
    testable: true,
    fields: [
      { key: "api_key",   label: "API Key",        sensitive: true,  placeholder: "sk-..." },
      { key: "org_id",    label: "Organisation ID", placeholder: "org-... (optional)" },
    ],
  },
  {
    slug: "anthropic", name: "Anthropic (Claude)", category: "ai",
    description: "Claude 3 Opus, Sonnet, Haiku models",
    docsUrl: "https://docs.anthropic.com",
    testable: true,
    fields: [
      { key: "api_key", label: "API Key", sensitive: true, placeholder: "sk-ant-..." },
    ],
  },
  {
    slug: "gemini", name: "Google Gemini", category: "ai",
    description: "Gemini Pro, Flash — multimodal AI",
    docsUrl: "https://ai.google.dev/docs",
    fields: [
      { key: "api_key", label: "API Key", sensitive: true },
    ],
  },
  {
    slug: "openrouter", name: "OpenRouter", category: "ai",
    description: "Unified API for 100+ AI models",
    docsUrl: "https://openrouter.ai/docs",
    fields: [
      { key: "api_key", label: "API Key", sensitive: true, placeholder: "sk-or-..." },
    ],
  },

  // ── Google ──────────────────────────────────────────────────────────────────
  {
    slug: "google_maps", name: "Google Maps", category: "google",
    description: "Maps JavaScript API, Embed, Static Maps",
    docsUrl: "https://developers.google.com/maps",
    testable: true,
    fields: [
      { key: "api_key", label: "API Key", sensitive: true },
    ],
  },
  {
    slug: "google_places", name: "Google Places", category: "google",
    description: "Place search, autocomplete, details",
    docsUrl: "https://developers.google.com/maps/documentation/places",
    fields: [
      { key: "api_key", label: "API Key", sensitive: true, hint: "Same key as Google Maps if enabled" },
    ],
  },
  {
    slug: "google_geocoding", name: "Google Geocoding", category: "google",
    description: "Convert addresses to coordinates",
    docsUrl: "https://developers.google.com/maps/documentation/geocoding",
    fields: [
      { key: "api_key", label: "API Key", sensitive: true },
    ],
  },
  {
    slug: "google_analytics", name: "Google Analytics (GA4)", category: "google",
    description: "Website traffic & user analytics",
    docsUrl: "https://developers.google.com/analytics",
    fields: [
      { key: "measurement_id", label: "Measurement ID",  placeholder: "G-XXXXXXXXXX" },
      { key: "api_key",        label: "API Secret",      sensitive: true, hint: "For Measurement Protocol" },
    ],
  },
  {
    slug: "google_search_console", name: "Google Search Console", category: "google",
    description: "Search performance & indexing",
    docsUrl: "https://developers.google.com/webmaster-tools",
    fields: [
      { key: "api_key", label: "Service Account JSON", sensitive: true, type: "textarea", hint: "Paste the full service account JSON" },
    ],
  },
  {
    slug: "recaptcha", name: "Google reCAPTCHA", category: "google",
    description: "Bot protection for forms (v2/v3/Enterprise)",
    docsUrl: "https://developers.google.com/recaptcha",
    fields: [
      { key: "site_key",    label: "Site Key",    placeholder: "6Le..." },
      { key: "secret_key",  label: "Secret Key",  sensitive: true, placeholder: "6Le..." },
    ],
  },

  // ── Payments ────────────────────────────────────────────────────────────────
  {
    slug: "razorpay", name: "Razorpay", category: "payments",
    description: "Indian payment gateway — UPI, cards, wallets, EMI",
    docsUrl: "https://razorpay.com/docs",
    badge: "Popular",
    testable: true,
    fields: [
      { key: "key_id",         label: "Key ID",          placeholder: "rzp_live_..." },
      { key: "key_secret",     label: "Key Secret",      sensitive: true },
      { key: "webhook_secret", label: "Webhook Secret",  sensitive: true },
      { key: "callback_url",   label: "Webhook URL",     type: "url" },
    ],
  },
  {
    slug: "stripe", name: "Stripe", category: "payments",
    description: "Global payment processing — cards, subscriptions, payouts",
    docsUrl: "https://stripe.com/docs",
    testable: true,
    fields: [
      { key: "publishable_key",  label: "Publishable Key",   placeholder: "pk_live_..." },
      { key: "secret_key",       label: "Secret Key",         sensitive: true, placeholder: "sk_live_..." },
      { key: "webhook_secret",   label: "Webhook Secret",     sensitive: true, placeholder: "whsec_..." },
      { key: "callback_url",     label: "Webhook URL",        type: "url" },
    ],
  },
  {
    slug: "cashfree", name: "Cashfree", category: "payments",
    description: "Indian payment gateway — payouts, subscriptions",
    docsUrl: "https://docs.cashfree.com",
    fields: [
      { key: "app_id",       label: "App ID" },
      { key: "secret_key",   label: "Secret Key",   sensitive: true },
      { key: "callback_url", label: "Return URL",    type: "url" },
    ],
  },
  {
    slug: "phonepe", name: "PhonePe", category: "payments",
    description: "UPI payment gateway",
    docsUrl: "https://developer.phonepe.com",
    fields: [
      { key: "merchant_id",  label: "Merchant ID" },
      { key: "salt_key",     label: "Salt Key",     sensitive: true },
      { key: "salt_index",   label: "Salt Index",   placeholder: "1" },
      { key: "callback_url", label: "Redirect URL", type: "url" },
    ],
  },
  {
    slug: "paytm", name: "Paytm", category: "payments",
    description: "UPI & wallet payments",
    docsUrl: "https://developer.paytm.com",
    fields: [
      { key: "merchant_id",  label: "Merchant ID" },
      { key: "merchant_key", label: "Merchant Key", sensitive: true },
      { key: "callback_url", label: "Callback URL",  type: "url" },
    ],
  },

  // ── Messaging ───────────────────────────────────────────────────────────────
  {
    slug: "whatsapp_waba", name: "WhatsApp Business (Meta WABA)", category: "messaging",
    description: "Official Meta Cloud API for WhatsApp Business messaging",
    docsUrl: "https://developers.facebook.com/docs/whatsapp",
    badge: "Popular",
    testable: true,
    fields: [
      { key: "system_token",    label: "System User Token",     sensitive: true },
      { key: "phone_number_id", label: "Phone Number ID",       hint: "From Meta Business Manager" },
      { key: "waba_id",         label: "Business Account ID",   hint: "WABA ID from Meta" },
      { key: "verify_token",    label: "Webhook Verify Token",  sensitive: true },
      { key: "callback_url",    label: "Webhook URL",            type: "url" },
    ],
  },
  {
    slug: "twilio", name: "Twilio", category: "messaging",
    description: "SMS, WhatsApp, voice calls via Twilio",
    docsUrl: "https://www.twilio.com/docs",
    testable: true,
    fields: [
      { key: "account_sid",  label: "Account SID",  placeholder: "AC..." },
      { key: "auth_token",   label: "Auth Token",    sensitive: true },
      { key: "phone_number", label: "Phone Number",  placeholder: "+1..." },
    ],
  },
  {
    slug: "interakt", name: "Interakt", category: "messaging",
    description: "WhatsApp Business messaging via Interakt",
    docsUrl: "https://docs.interakt.ai",
    fields: [
      { key: "api_key",      label: "API Key",       sensitive: true },
      { key: "phone_number", label: "WhatsApp Number" },
    ],
  },
  {
    slug: "gupshup", name: "Gupshup", category: "messaging",
    description: "WhatsApp Business API via Gupshup",
    docsUrl: "https://docs.gupshup.io",
    fields: [
      { key: "api_key",      label: "API Key",       sensitive: true },
      { key: "app_name",     label: "App Name" },
      { key: "phone_number", label: "Source Number" },
    ],
  },
  {
    slug: "msg91", name: "MSG91", category: "messaging",
    description: "SMS & WhatsApp messaging via MSG91",
    docsUrl: "https://msg91.com/help",
    fields: [
      { key: "auth_key",     label: "Auth Key",    sensitive: true },
      { key: "sender_id",    label: "Sender ID" },
      { key: "template_id",  label: "SMS Template ID" },
    ],
  },
  {
    slug: "360dialog", name: "360dialog", category: "messaging",
    description: "WhatsApp Business API via 360dialog",
    docsUrl: "https://docs.360dialog.com",
    fields: [
      { key: "api_key",      label: "Partner API Key", sensitive: true },
      { key: "phone_number", label: "Phone Number" },
    ],
  },

  // ── Notifications ────────────────────────────────────────────────────────────
  {
    slug: "onesignal", name: "OneSignal", category: "notifications",
    description: "Web & mobile push notifications",
    docsUrl: "https://documentation.onesignal.com",
    fields: [
      { key: "app_id",       label: "App ID" },
      { key: "api_key",      label: "REST API Key",    sensitive: true },
      { key: "callback_url", label: "Webhook URL",     type: "url" },
    ],
  },
  {
    slug: "firebase_fcm", name: "Firebase (FCM)", category: "notifications",
    description: "Firebase Cloud Messaging — push notifications",
    docsUrl: "https://firebase.google.com/docs/cloud-messaging",
    fields: [
      { key: "project_id",      label: "Project ID" },
      { key: "service_account", label: "Service Account JSON", sensitive: true, type: "textarea" },
    ],
  },

  // ── Storage ─────────────────────────────────────────────────────────────────
  {
    slug: "aws_s3", name: "AWS S3", category: "storage",
    description: "Amazon S3 — file and object storage",
    docsUrl: "https://docs.aws.amazon.com/s3",
    testable: true,
    fields: [
      { key: "access_key_id",     label: "Access Key ID",      placeholder: "AKIA..." },
      { key: "secret_access_key", label: "Secret Access Key",  sensitive: true },
      { key: "region",            label: "Region",             placeholder: "ap-south-1" },
      { key: "bucket",            label: "Bucket Name" },
    ],
  },
  {
    slug: "cloudinary", name: "Cloudinary", category: "storage",
    description: "Image & video hosting with transformation",
    docsUrl: "https://cloudinary.com/documentation",
    fields: [
      { key: "cloud_name", label: "Cloud Name" },
      { key: "api_key",    label: "API Key" },
      { key: "api_secret", label: "API Secret",  sensitive: true },
    ],
  },
  {
    slug: "firebase_storage", name: "Firebase Storage", category: "storage",
    description: "Google Firebase file storage",
    docsUrl: "https://firebase.google.com/docs/storage",
    fields: [
      { key: "project_id",      label: "Project ID" },
      { key: "service_account", label: "Service Account JSON", sensitive: true, type: "textarea" },
      { key: "storage_bucket",  label: "Storage Bucket",       placeholder: "project.appspot.com" },
    ],
  },

  // ── Security ─────────────────────────────────────────────────────────────────
  {
    slug: "cloudflare", name: "Cloudflare", category: "security",
    description: "CDN, DDoS protection, Turnstile CAPTCHA, DNS",
    docsUrl: "https://developers.cloudflare.com",
    fields: [
      { key: "api_token",  label: "API Token",    sensitive: true },
      { key: "account_id", label: "Account ID" },
      { key: "zone_id",    label: "Zone ID" },
      { key: "site_key",   label: "Turnstile Site Key",   hint: "For Turnstile CAPTCHA" },
      { key: "secret_key", label: "Turnstile Secret Key", sensitive: true },
    ],
  },

  // ── OCR & Vision ─────────────────────────────────────────────────────────────
  {
    slug: "google_vision", name: "Google Vision (OCR)", category: "ocr",
    description: "Google Cloud Vision — OCR, labels, face detection",
    docsUrl: "https://cloud.google.com/vision/docs",
    fields: [
      { key: "api_key", label: "API Key / Service Account", sensitive: true, type: "textarea" },
    ],
  },
  {
    slug: "ocr_space", name: "OCR.space", category: "ocr",
    description: "Free & paid OCR API for document scanning",
    docsUrl: "https://ocr.space/ocrapi",
    testable: true,
    fields: [
      { key: "api_key", label: "API Key", sensitive: true, placeholder: "helloworld (free tier)" },
    ],
  },
  {
    slug: "aws_textract", name: "AWS Textract", category: "ocr",
    description: "Amazon Textract — structured document analysis",
    docsUrl: "https://docs.aws.amazon.com/textract",
    fields: [
      { key: "access_key_id",     label: "Access Key ID",     placeholder: "AKIA..." },
      { key: "secret_access_key", label: "Secret Access Key", sensitive: true },
      { key: "region",            label: "Region",            placeholder: "us-east-1" },
    ],
  },

  // ── Social / Meta ────────────────────────────────────────────────────────────
  {
    slug: "meta", name: "Meta (Facebook / Instagram)", category: "social",
    description: "Facebook Graph API, Instagram API, Meta Pixel",
    docsUrl: "https://developers.facebook.com/docs",
    fields: [
      { key: "app_id",       label: "App ID" },
      { key: "app_secret",   label: "App Secret",    sensitive: true },
      { key: "pixel_id",     label: "Meta Pixel ID", hint: "For Meta Pixel / Conversions API" },
      { key: "callback_url", label: "Redirect URI",  type: "url" },
    ],
  },

  // ── Email ────────────────────────────────────────────────────────────────────
  {
    slug: "smtp", name: "SMTP Email", category: "email",
    description: "Transactional email delivery",
    docsUrl: "",
    fields: [
      { key: "_redirect", label: "_redirect", hint: "Configured in Site Settings → Email section" },
    ],
  },
  {
    slug: "sendgrid", name: "SendGrid", category: "email",
    description: "Transactional & marketing emails via SendGrid",
    docsUrl: "https://docs.sendgrid.com",
    fields: [
      { key: "api_key",       label: "API Key",       sensitive: true, placeholder: "SG...." },
      { key: "from_email",    label: "From Email" },
      { key: "from_name",     label: "From Name" },
      { key: "callback_url",  label: "Webhook URL",   type: "url" },
    ],
  },
  {
    slug: "mailgun", name: "Mailgun", category: "email",
    description: "Transactional email via Mailgun",
    docsUrl: "https://documentation.mailgun.com",
    fields: [
      { key: "api_key",    label: "API Key",     sensitive: true },
      { key: "domain",     label: "Domain",      placeholder: "mg.yourdomain.com" },
      { key: "from_email", label: "From Email" },
    ],
  },
];

export const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  ai:            { label: "AI & ML",           icon: "🤖" },
  google:        { label: "Google APIs",        icon: "🔍" },
  payments:      { label: "Payments",           icon: "💳" },
  messaging:     { label: "Messaging",          icon: "💬" },
  notifications: { label: "Notifications",      icon: "🔔" },
  storage:       { label: "Storage",            icon: "🗄️" },
  security:      { label: "Security",           icon: "🛡️" },
  ocr:           { label: "OCR & Vision",       icon: "📄" },
  social:        { label: "Social / Meta",      icon: "📱" },
  email:         { label: "Email",              icon: "✉️" },
};

export const SENSITIVE_FALLBACK = "__SET__" as const;
