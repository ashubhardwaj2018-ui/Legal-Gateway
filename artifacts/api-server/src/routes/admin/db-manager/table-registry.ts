// Static table registry — mirrors the Drizzle schema.
// Never constructed from user input; all table/column names here are hardcoded.

export type ColType = "id" | "text" | "number" | "boolean" | "timestamp" | "jsonb" | "real" | "enum";

export interface ColDef {
  name: string;          // camelCase JS key
  db: string;            // snake_case DB column name
  type: ColType;
  label: string;
  nullable?: boolean;
  hidden?: boolean;      // excluded from grid + form (passwords, tokens)
  readonly?: boolean;    // shown but not editable
  enumValues?: string[];
}

export interface TableDef {
  name: string;           // actual DB table name
  label: string;
  category: "CRM" | "Finance" | "Legal" | "Content" | "Team" | "Communication" | "System";
  primaryKey: string;     // camelCase PK field name
  softDeleteCol?: string; // camelCase boolean col for soft-delete
  isProtected: boolean;   // true = read-only for non-super_admin
  columns: ColDef[];
}

export const TABLE_REGISTRY: TableDef[] = [

  // ── CRM ───────────────────────────────────────────────────────────────────

  {
    name: "consultations", label: "Leads / Consultations", category: "CRM",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "name", db: "name", type: "text", label: "Name" },
      { name: "email", db: "email", type: "text", label: "Email" },
      { name: "phone", db: "phone", type: "text", label: "Phone", nullable: true },
      { name: "serviceCategory", db: "service_category", type: "text", label: "Service Category" },
      { name: "serviceInterest", db: "service_interest", type: "text", label: "Service Interest" },
      { name: "message", db: "message", type: "text", label: "Message", nullable: true },
      { name: "status", db: "status", type: "enum", label: "Status", enumValues: ["new", "contacted", "qualified", "proposal", "won", "lost", "unread"] },
      { name: "priority", db: "priority", type: "enum", label: "Priority", nullable: true, enumValues: ["low", "medium", "high", "urgent"] },
      { name: "source", db: "source", type: "text", label: "Source", nullable: true },
      { name: "assignedTo", db: "assigned_to", type: "text", label: "Assigned To", nullable: true },
      { name: "company", db: "company", type: "text", label: "Company", nullable: true },
      { name: "city", db: "city", type: "text", label: "City", nullable: true },
      { name: "state", db: "state", type: "text", label: "State", nullable: true },
      { name: "expectedRevenue", db: "expected_revenue", type: "text", label: "Expected Revenue", nullable: true },
      { name: "probability", db: "probability", type: "number", label: "Probability %", nullable: true },
      { name: "whatsappStatus", db: "whatsapp_status", type: "enum", label: "WhatsApp Status", nullable: true, enumValues: ["unknown", "active", "blocked", "invalid"] },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
      { name: "updatedAt", db: "updated_at", type: "timestamp", label: "Updated", readonly: true },
    ],
  },
  {
    name: "lead_notes", label: "Lead Notes", category: "CRM",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "leadId", db: "lead_id", type: "number", label: "Lead ID" },
      { name: "content", db: "content", type: "text", label: "Content" },
      { name: "createdBy", db: "created_by", type: "text", label: "Created By", nullable: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "lead_activities", label: "Lead Activities", category: "CRM",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "leadId", db: "lead_id", type: "number", label: "Lead ID" },
      { name: "type", db: "type", type: "text", label: "Type" },
      { name: "description", db: "description", type: "text", label: "Description" },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "lead_tasks", label: "Lead Tasks", category: "CRM",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "leadId", db: "lead_id", type: "number", label: "Lead ID" },
      { name: "title", db: "title", type: "text", label: "Title" },
      { name: "description", db: "description", type: "text", label: "Description", nullable: true },
      { name: "dueDate", db: "due_date", type: "text", label: "Due Date", nullable: true },
      { name: "status", db: "status", type: "enum", label: "Status", enumValues: ["pending", "in_progress", "done", "cancelled"] },
      { name: "priority", db: "priority", type: "enum", label: "Priority", nullable: true, enumValues: ["low", "medium", "high"] },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "lead_assignments", label: "Lead Assignments", category: "CRM",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "leadId", db: "lead_id", type: "number", label: "Lead ID" },
      { name: "assignedToName", db: "assigned_to_name", type: "text", label: "Assigned To" },
      { name: "assignedByName", db: "assigned_by_name", type: "text", label: "Assigned By", nullable: true },
      { name: "status", db: "status", type: "enum", label: "Status", enumValues: ["active", "completed", "removed"] },
      { name: "priority", db: "priority", type: "enum", label: "Priority", nullable: true, enumValues: ["low", "medium", "high"] },
      { name: "deadline", db: "deadline", type: "text", label: "Deadline", nullable: true },
      { name: "notes", db: "notes", type: "text", label: "Notes", nullable: true },
      { name: "assignedAt", db: "assigned_at", type: "timestamp", label: "Assigned At", readonly: true },
    ],
  },
  {
    name: "lead_timeline", label: "Lead Timeline", category: "CRM",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "leadId", db: "lead_id", type: "number", label: "Lead ID" },
      { name: "actorId", db: "actor_id", type: "number", label: "Actor ID", nullable: true },
      { name: "actorName", db: "actor_name", type: "text", label: "Actor Name" },
      { name: "actionType", db: "action_type", type: "text", label: "Action Type" },
      { name: "description", db: "description", type: "text", label: "Description" },
      { name: "payload", db: "payload", type: "text", label: "Payload", nullable: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "contacts", label: "Contact Enquiries", category: "CRM",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "name", db: "name", type: "text", label: "Name" },
      { name: "email", db: "email", type: "text", label: "Email" },
      { name: "phone", db: "phone", type: "text", label: "Phone", nullable: true },
      { name: "subject", db: "subject", type: "text", label: "Subject" },
      { name: "message", db: "message", type: "text", label: "Message" },
      { name: "status", db: "status", type: "enum", label: "Status", enumValues: ["unread", "read", "replied", "archived"] },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "newsletter_subscribers", label: "Newsletter Subscribers", category: "CRM",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "email", db: "email", type: "text", label: "Email" },
      { name: "name", db: "name", type: "text", label: "Name", nullable: true },
      { name: "subscribedAt", db: "subscribed_at", type: "timestamp", label: "Subscribed", readonly: true },
    ],
  },

  // ── Finance ───────────────────────────────────────────────────────────────

  {
    name: "invoices", label: "Invoices", category: "Finance",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "number", db: "number", type: "text", label: "Invoice No.", readonly: true },
      { name: "type", db: "type", type: "enum", label: "Type", enumValues: ["invoice", "proforma", "receipt"] },
      { name: "status", db: "status", type: "enum", label: "Status", enumValues: ["draft", "sent", "paid", "partial", "overdue", "cancelled"] },
      { name: "clientName", db: "client_name", type: "text", label: "Client Name" },
      { name: "clientEmail", db: "client_email", type: "text", label: "Client Email", nullable: true },
      { name: "clientPhone", db: "client_phone", type: "text", label: "Client Phone", nullable: true },
      { name: "subtotal", db: "subtotal", type: "text", label: "Subtotal" },
      { name: "gstAmount", db: "gst_amount", type: "text", label: "GST Amount", nullable: true },
      { name: "total", db: "total", type: "text", label: "Total" },
      { name: "paidAmount", db: "paid_amount", type: "text", label: "Paid Amount", nullable: true },
      { name: "dueDate", db: "due_date", type: "text", label: "Due Date", nullable: true },
      { name: "items", db: "items", type: "jsonb", label: "Line Items" },
      { name: "notes", db: "notes", type: "text", label: "Notes", nullable: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "invoice_payments", label: "Invoice Payments", category: "Finance",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "invoiceId", db: "invoice_id", type: "number", label: "Invoice ID" },
      { name: "amount", db: "amount", type: "text", label: "Amount" },
      { name: "mode", db: "mode", type: "enum", label: "Mode", enumValues: ["cash", "upi", "bank_transfer", "cheque", "card", "other"] },
      { name: "transactionId", db: "transaction_id", type: "text", label: "Transaction ID", nullable: true },
      { name: "paidAt", db: "paid_at", type: "text", label: "Paid At" },
      { name: "notes", db: "notes", type: "text", label: "Notes", nullable: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "quotations", label: "Quotations", category: "Finance",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      // quotation_number is NOT NULL in DB — must be user-supplied on CREATE (writable, not readonly)
      { name: "quotationNumber", db: "quotation_number", type: "text", label: "Quotation No." },
      { name: "clientName", db: "client_name", type: "text", label: "Client Name" },
      { name: "clientEmail", db: "client_email", type: "text", label: "Client Email" },
      { name: "clientPhone", db: "client_phone", type: "text", label: "Client Phone", nullable: true },
      { name: "clientCompany", db: "client_company", type: "text", label: "Client Company", nullable: true },
      { name: "status", db: "status", type: "enum", label: "Status", enumValues: ["draft", "sent", "accepted", "rejected", "expired"] },
      { name: "subtotal", db: "subtotal", type: "number", label: "Subtotal (₹)" },
      { name: "taxPercent", db: "tax_percent", type: "number", label: "Tax %" },
      { name: "taxAmount", db: "tax_amount", type: "number", label: "Tax Amount (₹)" },
      { name: "total", db: "total", type: "number", label: "Total (₹)" },
      { name: "validityDays", db: "validity_days", type: "number", label: "Validity (days)" },
      { name: "notes", db: "notes", type: "text", label: "Notes", nullable: true },
      { name: "items", db: "items", type: "jsonb", label: "Line Items" },
      { name: "leadId", db: "lead_id", type: "number", label: "Lead ID", nullable: true },
      { name: "sentAt", db: "sent_at", type: "timestamp", label: "Sent At", nullable: true },
      { name: "acceptedAt", db: "accepted_at", type: "timestamp", label: "Accepted At", nullable: true },
      { name: "rejectedAt", db: "rejected_at", type: "timestamp", label: "Rejected At", nullable: true },
      { name: "rejectedReason", db: "rejected_reason", type: "text", label: "Rejected Reason", nullable: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
      { name: "updatedAt", db: "updated_at", type: "timestamp", label: "Updated", readonly: true },
    ],
  },

  // ── Legal ─────────────────────────────────────────────────────────────────

  {
    name: "services_config", label: "Services Config", category: "Legal",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "categoryId", db: "category_id", type: "text", label: "Category ID" },
      { name: "serviceName", db: "service_name", type: "text", label: "Service Name" },
      { name: "displayName", db: "display_name", type: "text", label: "Display Name", nullable: true },
      { name: "description", db: "description", type: "text", label: "Description", nullable: true },
      { name: "basePrice", db: "base_price", type: "number", label: "Base Price", nullable: true },
      { name: "priceDisplay", db: "price_display", type: "text", label: "Price Display", nullable: true },
      { name: "isPopular", db: "is_popular", type: "boolean", label: "Is Popular" },
      { name: "isActive", db: "is_active", type: "boolean", label: "Is Active" },
      { name: "updatedAt", db: "updated_at", type: "timestamp", label: "Updated", readonly: true },
    ],
  },
  {
    name: "lawyer_profiles", label: "Lawyer Profiles", category: "Legal",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "name", db: "name", type: "text", label: "Name" },
      { name: "specialization", db: "specialization", type: "text", label: "Specialization" },
      { name: "experienceYears", db: "experience_years", type: "number", label: "Experience (yrs)" },
      { name: "bio", db: "bio", type: "text", label: "Bio", nullable: true },
      { name: "photoUrl", db: "photo_url", type: "text", label: "Photo URL", nullable: true },
      { name: "languages", db: "languages", type: "text", label: "Languages", nullable: true },
      { name: "barCouncilNo", db: "bar_council_no", type: "text", label: "Bar Council No.", nullable: true },
      { name: "isActive", db: "is_active", type: "boolean", label: "Is Active" },
      { name: "updatedAt", db: "updated_at", type: "timestamp", label: "Updated", readonly: true },
    ],
  },

  // ── Content ───────────────────────────────────────────────────────────────

  {
    name: "blogs", label: "Blog Posts", category: "Content",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "title", db: "title", type: "text", label: "Title" },
      { name: "slug", db: "slug", type: "text", label: "Slug" },
      { name: "category", db: "category", type: "text", label: "Category" },
      { name: "status", db: "status", type: "enum", label: "Status", enumValues: ["draft", "published", "archived"] },
      { name: "authorName", db: "author_name", type: "text", label: "Author" },
      { name: "viewCount", db: "view_count", type: "number", label: "Views", readonly: true },
      { name: "readingTime", db: "reading_time", type: "number", label: "Reading Time (min)" },
      { name: "publishedAt", db: "published_at", type: "timestamp", label: "Published At", nullable: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "locations", label: "Locations (pSEO)", category: "Content",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      // country is NOT NULL with default 'India' — must be writable for CREATE
      { name: "country", db: "country", type: "text", label: "Country" },
      { name: "state", db: "state", type: "text", label: "State" },
      { name: "district", db: "district", type: "text", label: "District", nullable: true },
      { name: "city", db: "city", type: "text", label: "City", nullable: true },
      { name: "town", db: "town", type: "text", label: "Town", nullable: true },
      { name: "village", db: "village", type: "text", label: "Village", nullable: true },
      { name: "pincode", db: "pincode", type: "text", label: "Pincode", nullable: true },
      { name: "slug", db: "slug", type: "text", label: "Slug" },
      { name: "parentLocation", db: "parent_location", type: "text", label: "Parent Location", nullable: true },
      { name: "latitude", db: "latitude", type: "number", label: "Latitude", nullable: true },
      { name: "longitude", db: "longitude", type: "number", label: "Longitude", nullable: true },
      { name: "population", db: "population", type: "number", label: "Population", nullable: true },
      { name: "isActive", db: "is_active", type: "boolean", label: "Is Active" },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
      { name: "updatedAt", db: "updated_at", type: "timestamp", label: "Updated", readonly: true },
    ],
  },
  {
    name: "seo_settings", label: "SEO Settings", category: "Content",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "page", db: "page", type: "text", label: "Page" },
      { name: "title", db: "title", type: "text", label: "Title" },
      { name: "description", db: "description", type: "text", label: "Description" },
      { name: "keywords", db: "keywords", type: "text", label: "Keywords", nullable: true },
      { name: "ogTitle", db: "og_title", type: "text", label: "OG Title", nullable: true },
      { name: "ogDescription", db: "og_description", type: "text", label: "OG Description", nullable: true },
      { name: "ogImage", db: "og_image", type: "text", label: "OG Image", nullable: true },
      { name: "robots", db: "robots", type: "text", label: "Robots" },
      { name: "updatedAt", db: "updated_at", type: "timestamp", label: "Updated", readonly: true },
    ],
  },
  {
    name: "page_content_versions", label: "Page Content Versions", category: "Content",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "page", db: "page", type: "text", label: "Page" },
      { name: "content", db: "content", type: "jsonb", label: "Content Snapshot" },
      { name: "snapshotLabel", db: "snapshot_label", type: "text", label: "Label", nullable: true },
      { name: "createdBy", db: "created_by", type: "text", label: "Created By", nullable: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", nullable: true, readonly: true },
    ],
  },
  {
    name: "service_locations", label: "Service Locations (pSEO)", category: "Content",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "serviceId", db: "service_id", type: "text", label: "Service ID" },
      { name: "locationId", db: "location_id", type: "number", label: "Location ID" },
      { name: "isFeatured", db: "is_featured", type: "boolean", label: "Is Featured" },
      { name: "customTitle", db: "custom_title", type: "text", label: "Custom Title", nullable: true },
      { name: "customDescription", db: "custom_description", type: "text", label: "Custom Description", nullable: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    // DB: indian_companies — all 19 live columns
    name: "indian_companies", label: "Indian Companies (pSEO)", category: "Content",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "cin", db: "cin", type: "text", label: "CIN" },
      { name: "companyName", db: "company_name", type: "text", label: "Company Name" },
      { name: "slug", db: "slug", type: "text", label: "Slug" },
      { name: "companyStatus", db: "company_status", type: "text", label: "Status", nullable: true },
      { name: "companyType", db: "company_type", type: "text", label: "Type", nullable: true },
      { name: "authorizedCapital", db: "authorized_capital", type: "text", label: "Auth. Capital", nullable: true },
      { name: "paidUpCapital", db: "paid_up_capital", type: "text", label: "Paid Up Capital", nullable: true },
      { name: "registeredOffice", db: "registered_office", type: "text", label: "Reg. Office", nullable: true },
      { name: "state", db: "state", type: "text", label: "State", nullable: true },
      { name: "district", db: "district", type: "text", label: "District", nullable: true },
      { name: "city", db: "city", type: "text", label: "City", nullable: true },
      { name: "pincode", db: "pincode", type: "text", label: "Pincode", nullable: true },
      { name: "industry", db: "industry", type: "text", label: "Industry", nullable: true },
      { name: "roc", db: "roc", type: "text", label: "ROC", nullable: true },
      { name: "email", db: "email", type: "text", label: "Email", nullable: true },
      { name: "incorporationDate", db: "incorporation_date", type: "text", label: "Inc. Date", nullable: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
      { name: "updatedAt", db: "updated_at", type: "timestamp", label: "Updated", readonly: true },
    ],
  },
  {
    // DB: company_data — all 12 live columns
    name: "company_data", label: "Company Data", category: "Content",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "companyName", db: "company_name", type: "text", label: "Company Name" },
      { name: "cin", db: "cin", type: "text", label: "CIN", nullable: true },
      { name: "category", db: "category", type: "text", label: "Category", nullable: true },
      { name: "state", db: "state", type: "text", label: "State", nullable: true },
      { name: "dateOfIncorporation", db: "date_of_incorporation", type: "text", label: "Inc. Date", nullable: true },
      { name: "authorizedCapital", db: "authorized_capital", type: "text", label: "Auth. Capital", nullable: true },
      { name: "paidUpCapital", db: "paid_up_capital", type: "text", label: "Paid Up Capital", nullable: true },
      { name: "companyStatus", db: "company_status", type: "text", label: "Status", nullable: true },
      { name: "email", db: "email", type: "text", label: "Email", nullable: true },
      { name: "registeredAddress", db: "registered_address", type: "text", label: "Address", nullable: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "location_upload_logs", label: "Location Upload Logs", category: "Content",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "fileName", db: "file_name", type: "text", label: "File Name", readonly: true },
      { name: "totalRows", db: "total_rows", type: "number", label: "Total Rows", readonly: true },
      { name: "inserted", db: "inserted", type: "number", label: "Inserted", readonly: true },
      { name: "updated", db: "updated", type: "number", label: "Updated", readonly: true },
      { name: "duplicates", db: "duplicates", type: "number", label: "Duplicates", readonly: true },
      { name: "errors", db: "errors", type: "number", label: "Errors", readonly: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "page_content", label: "Page Content Blocks", category: "Content",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "page", db: "page", type: "text", label: "Page" },
      { name: "blockId", db: "block_id", type: "text", label: "Block ID" },
      { name: "content", db: "content", type: "text", label: "Content" },
      { name: "updatedAt", db: "updated_at", type: "timestamp", label: "Updated", readonly: true },
    ],
  },
  {
    name: "site_settings", label: "Site Settings", category: "Content",
    primaryKey: "key", isProtected: false,
    columns: [
      { name: "key", db: "key", type: "text", label: "Key", readonly: true },
      { name: "value", db: "value", type: "text", label: "Value" },
      { name: "updatedAt", db: "updated_at", type: "timestamp", label: "Updated", readonly: true },
    ],
  },
  {
    name: "chat_typing", label: "Chat Typing Indicators", category: "Communication",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "channelId", db: "channel_id", type: "number", label: "Channel ID" },
      { name: "memberName", db: "member_name", type: "text", label: "Member" },
      { name: "updatedAt", db: "updated_at", type: "timestamp", label: "Updated", readonly: true },
    ],
  },
  {
    name: "sitemap_logs", label: "Sitemap Logs", category: "Content",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "urlsGenerated", db: "urls_generated", type: "number", label: "URLs Generated" },
      { name: "blogsIncluded", db: "blogs_included", type: "number", label: "Blogs Included" },
      { name: "pingedGoogle", db: "pinged_google", type: "boolean", label: "Pinged Google" },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },

  // ── Team ──────────────────────────────────────────────────────────────────

  {
    name: "team_members", label: "Team Members", category: "Team",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "name", db: "name", type: "text", label: "Name" },
      { name: "email", db: "email", type: "text", label: "Email" },
      { name: "phone", db: "phone", type: "text", label: "Phone", nullable: true },
      { name: "department", db: "department", type: "text", label: "Department" },
      { name: "designation", db: "designation", type: "text", label: "Designation" },
      { name: "role", db: "role", type: "text", label: "Role" },
      { name: "status", db: "status", type: "enum", label: "Status", enumValues: ["active", "inactive", "on_leave"] },
      { name: "username", db: "username", type: "text", label: "Username", nullable: true },
      { name: "passwordHash", db: "password_hash", type: "text", label: "Password Hash", hidden: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "tasks", label: "Tasks", category: "Team",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "title", db: "title", type: "text", label: "Title" },
      { name: "description", db: "description", type: "text", label: "Description", nullable: true },
      { name: "priority", db: "priority", type: "enum", label: "Priority", enumValues: ["low", "medium", "high", "urgent"] },
      { name: "status", db: "status", type: "enum", label: "Status", enumValues: ["todo", "in_progress", "review", "done", "cancelled"] },
      { name: "assignedToId", db: "assigned_to_id", type: "number", label: "Assigned To (ID)", nullable: true },
      { name: "assignedToName", db: "assigned_to_name", type: "text", label: "Assigned To", nullable: true },
      { name: "dueDate", db: "due_date", type: "text", label: "Due Date", nullable: true },
      { name: "tags", db: "tags", type: "text", label: "Tags", nullable: true },
      { name: "leadId", db: "lead_id", type: "number", label: "Lead ID", nullable: true },
      { name: "estimatedHours", db: "estimated_hours", type: "text", label: "Est. Hours", nullable: true },
      { name: "completedAt", db: "completed_at", type: "timestamp", label: "Completed At", nullable: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
      { name: "updatedAt", db: "updated_at", type: "timestamp", label: "Updated", readonly: true },
    ],
  },
  {
    name: "task_comments", label: "Task Comments", category: "Team",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "taskId", db: "task_id", type: "number", label: "Task ID" },
      { name: "authorName", db: "author_name", type: "text", label: "Author" },
      { name: "comment", db: "comment", type: "text", label: "Comment" },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "working_hours", label: "Working Hours", category: "Team",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "employeeId", db: "employee_id", type: "number", label: "Employee ID" },
      { name: "date", db: "date", type: "text", label: "Date" },
      { name: "clockIn", db: "clock_in", type: "timestamp", label: "Clock In", nullable: true },
      { name: "clockOut", db: "clock_out", type: "timestamp", label: "Clock Out", nullable: true },
      { name: "totalMinutes", db: "total_minutes", type: "number", label: "Total (min)", nullable: true },
      { name: "breakMinutes", db: "break_minutes", type: "number", label: "Break (min)", nullable: true },
      { name: "status", db: "status", type: "enum", label: "Status", enumValues: ["present", "absent", "half_day", "leave"] },
      { name: "notes", db: "notes", type: "text", label: "Notes", nullable: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "attendance", label: "Attendance", category: "Team",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "memberId", db: "member_id", type: "number", label: "Member ID" },
      { name: "date", db: "date", type: "text", label: "Date" },
      { name: "checkIn", db: "check_in", type: "text", label: "Check In", nullable: true },
      { name: "checkOut", db: "check_out", type: "text", label: "Check Out", nullable: true },
      { name: "status", db: "status", type: "enum", label: "Status", enumValues: ["present", "absent", "half_day", "leave"] },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "leave_requests", label: "Leave Requests", category: "Team",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "memberId", db: "member_id", type: "number", label: "Member ID" },
      { name: "type", db: "type", type: "enum", label: "Type", enumValues: ["casual", "sick", "annual", "unpaid", "other"] },
      { name: "startDate", db: "start_date", type: "text", label: "Start Date" },
      { name: "endDate", db: "end_date", type: "text", label: "End Date" },
      { name: "days", db: "days", type: "number", label: "Days" },
      { name: "status", db: "status", type: "enum", label: "Status", enumValues: ["pending", "approved", "rejected", "cancelled"] },
      { name: "reason", db: "reason", type: "text", label: "Reason", nullable: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },

  // ── Communication ─────────────────────────────────────────────────────────

  {
    name: "chat_channels", label: "Chat Channels", category: "Communication",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "name", db: "name", type: "text", label: "Name" },
      { name: "slug", db: "slug", type: "text", label: "Slug" },
      { name: "type", db: "type", type: "enum", label: "Type", enumValues: ["public", "private", "direct"] },
      { name: "description", db: "description", type: "text", label: "Description", nullable: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "chat_messages", label: "Chat Messages", category: "Communication",
    primaryKey: "id", softDeleteCol: "isDeleted", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "channelId", db: "channel_id", type: "number", label: "Channel ID" },
      { name: "senderName", db: "sender_name", type: "text", label: "Sender" },
      { name: "content", db: "content", type: "text", label: "Content" },
      { name: "msgType", db: "msg_type", type: "enum", label: "Type", enumValues: ["text", "file", "image", "system"] },
      { name: "isDeleted", db: "is_deleted", type: "boolean", label: "Deleted" },
      { name: "isPinned", db: "is_pinned", type: "boolean", label: "Pinned" },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "notifications", label: "Notifications", category: "Communication",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "recipientId", db: "recipient_id", type: "number", label: "Recipient ID" },
      { name: "recipientType", db: "recipient_type", type: "enum", label: "Recipient Type", enumValues: ["admin", "employee"] },
      { name: "type", db: "type", type: "text", label: "Type" },
      { name: "title", db: "title", type: "text", label: "Title" },
      { name: "body", db: "body", type: "text", label: "Body" },
      { name: "readAt", db: "read_at", type: "timestamp", label: "Read At", nullable: true, readonly: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "whatsapp_templates", label: "WhatsApp Templates", category: "Communication",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "name", db: "name", type: "text", label: "Name" },
      { name: "category", db: "category", type: "text", label: "Category" },
      { name: "body", db: "body", type: "text", label: "Body" },
      { name: "isActive", db: "is_active", type: "boolean", label: "Is Active" },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "whatsapp_messages", label: "WhatsApp Messages", category: "Communication",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "toNumber", db: "to_number", type: "text", label: "To Number" },
      { name: "message", db: "message", type: "text", label: "Message" },
      { name: "direction", db: "direction", type: "enum", label: "Direction", enumValues: ["outgoing", "incoming"] },
      { name: "status", db: "status", type: "enum", label: "Status", enumValues: ["pending", "sent", "delivered", "read", "failed"] },
      { name: "provider", db: "provider", type: "text", label: "Provider" },
      { name: "senderName", db: "sender_name", type: "text", label: "Sender", nullable: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "portal_messages", label: "Portal Messages", category: "Communication",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "clientEmail", db: "client_email", type: "text", label: "Client Email" },
      { name: "clientName", db: "client_name", type: "text", label: "Client Name", nullable: true },
      { name: "subject", db: "subject", type: "text", label: "Subject" },
      { name: "message", db: "message", type: "text", label: "Message" },
      { name: "isRead", db: "is_read", type: "text", label: "Is Read" },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "portal_documents", label: "Portal Documents", category: "Communication",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "leadId", db: "lead_id", type: "number", label: "Lead ID" },
      { name: "clientEmail", db: "client_email", type: "text", label: "Client Email" },
      { name: "fileName", db: "file_name", type: "text", label: "File Name" },
      { name: "fileUrl", db: "file_url", type: "text", label: "File URL" },
      { name: "fileSize", db: "file_size", type: "number", label: "File Size (bytes)" },
      { name: "mimeType", db: "mime_type", type: "text", label: "MIME Type" },
      { name: "uploadedAt", db: "uploaded_at", type: "timestamp", label: "Uploaded", readonly: true },
    ],
  },
  {
    name: "portal_access_requests", label: "Portal Access Requests", category: "Communication",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "email", db: "email", type: "text", label: "Email" },
      { name: "name", db: "name", type: "text", label: "Name", nullable: true },
      { name: "phone", db: "phone", type: "text", label: "Phone", nullable: true },
      { name: "message", db: "message", type: "text", label: "Message", nullable: true },
      { name: "status", db: "status", type: "enum", label: "Status", enumValues: ["pending", "approved", "rejected"] },
      { name: "reviewedBy", db: "reviewed_by", type: "text", label: "Reviewed By", nullable: true },
      { name: "reviewedAt", db: "reviewed_at", type: "timestamp", label: "Reviewed At", nullable: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "portal_chat_messages", label: "Portal Chat Messages", category: "Communication",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "leadId", db: "lead_id", type: "number", label: "Lead ID" },
      { name: "clientEmail", db: "client_email", type: "text", label: "Client Email" },
      { name: "senderType", db: "sender_type", type: "enum", label: "Sender Type", enumValues: ["client", "staff"] },
      { name: "senderName", db: "sender_name", type: "text", label: "Sender Name" },
      { name: "message", db: "message", type: "text", label: "Message" },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "email_logs", label: "Email Logs", category: "Communication",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "toEmail", db: "to_email", type: "text", label: "To Email" },
      { name: "toName", db: "to_name", type: "text", label: "To Name", nullable: true },
      { name: "subject", db: "subject", type: "text", label: "Subject" },
      { name: "type", db: "type", type: "text", label: "Type" },
      { name: "status", db: "status", type: "enum", label: "Status", enumValues: ["queued", "sent", "failed", "bounced"] },
      { name: "templateId", db: "template_id", type: "number", label: "Template ID", nullable: true },
      { name: "leadId", db: "lead_id", type: "number", label: "Lead ID", nullable: true },
      { name: "invoiceId", db: "invoice_id", type: "number", label: "Invoice ID", nullable: true },
      { name: "errorMsg", db: "error_msg", type: "text", label: "Error", nullable: true },
      { name: "sentAt", db: "sent_at", type: "timestamp", label: "Sent At", nullable: true, readonly: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "email_templates", label: "Email Templates", category: "Communication",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "name", db: "name", type: "text", label: "Name" },
      { name: "subject", db: "subject", type: "text", label: "Subject" },
      { name: "htmlBody", db: "html_body", type: "text", label: "HTML Body" },
      { name: "type", db: "type", type: "text", label: "Type" },
      { name: "isActive", db: "is_active", type: "boolean", label: "Is Active", nullable: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
      { name: "updatedAt", db: "updated_at", type: "timestamp", label: "Updated", readonly: true },
    ],
  },
  {
    name: "whatsapp_triggers", label: "WhatsApp Triggers", category: "Communication",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "event", db: "event", type: "text", label: "Event" },
      { name: "templateId", db: "template_id", type: "number", label: "Template ID", nullable: true },
      { name: "isEnabled", db: "is_enabled", type: "boolean", label: "Enabled" },
      { name: "updatedAt", db: "updated_at", type: "timestamp", label: "Updated", nullable: true, readonly: true },
    ],
  },
  {
    name: "portal_tokens", label: "Portal Tokens", category: "Communication",
    primaryKey: "id", isProtected: true,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "email", db: "email", type: "text", label: "Email", readonly: true },
      { name: "token", db: "token", type: "text", label: "Token", hidden: true },
      { name: "expiresAt", db: "expires_at", type: "timestamp", label: "Expires At", readonly: true },
      { name: "usedAt", db: "used_at", type: "timestamp", label: "Used At", nullable: true, readonly: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "conversations", label: "AI Conversations", category: "Communication",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "title", db: "title", type: "text", label: "Title" },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "messages", label: "AI Messages", category: "Communication",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "conversationId", db: "conversation_id", type: "number", label: "Conversation ID" },
      { name: "role", db: "role", type: "enum", label: "Role", enumValues: ["user", "assistant", "system"] },
      { name: "content", db: "content", type: "text", label: "Content" },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "message_reads", label: "Message Reads", category: "Communication",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "messageId", db: "message_id", type: "number", label: "Message ID" },
      { name: "channelId", db: "channel_id", type: "number", label: "Channel ID" },
      { name: "readerName", db: "reader_name", type: "text", label: "Reader" },
      { name: "readAt", db: "read_at", type: "timestamp", label: "Read At", readonly: true },
    ],
  },
  {
    name: "user_presence", label: "User Presence", category: "Communication",
    primaryKey: "id", isProtected: false,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "userName", db: "user_name", type: "text", label: "Username" },
      { name: "lastSeenAt", db: "last_seen_at", type: "timestamp", label: "Last Seen", readonly: true },
    ],
  },

  // ── System ────────────────────────────────────────────────────────────────

  {
    name: "admin_users", label: "Admin Users", category: "System",
    primaryKey: "id", isProtected: true,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "username", db: "username", type: "text", label: "Username" },
      { name: "email", db: "email", type: "text", label: "Email" },
      { name: "passwordHash", db: "password_hash", type: "text", label: "Password Hash", hidden: true },
      { name: "role", db: "role", type: "enum", label: "Role", enumValues: ["admin", "super_admin"] },
      { name: "isActive", db: "is_active", type: "boolean", label: "Is Active" },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "roles", label: "Roles", category: "System",
    primaryKey: "id", isProtected: true,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "name", db: "name", type: "text", label: "Name" },
      { name: "description", db: "description", type: "text", label: "Description", nullable: true },
      { name: "isSystem", db: "is_system", type: "boolean", label: "Is System" },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "role_permissions", label: "Role Permissions", category: "System",
    primaryKey: "id", isProtected: true,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "roleId", db: "role_id", type: "number", label: "Role ID" },
      { name: "module", db: "module", type: "text", label: "Module" },
      { name: "action", db: "action", type: "text", label: "Action" },
      { name: "allowed", db: "allowed", type: "boolean", label: "Allowed" },
    ],
  },
  {
    name: "login_history", label: "Login History", category: "System",
    primaryKey: "id", isProtected: true,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "username", db: "username", type: "text", label: "Username", readonly: true },
      { name: "userType", db: "user_type", type: "text", label: "User Type", readonly: true },
      { name: "ipAddress", db: "ip_address", type: "text", label: "IP Address", readonly: true },
      { name: "status", db: "status", type: "enum", label: "Status", enumValues: ["success", "failed", "locked"], readonly: true },
      { name: "loggedInAt", db: "logged_in_at", type: "timestamp", label: "Logged In", readonly: true },
      { name: "loggedOutAt", db: "logged_out_at", type: "timestamp", label: "Logged Out", nullable: true, readonly: true },
    ],
  },
  {
    name: "activity_logs", label: "Activity Logs", category: "System",
    primaryKey: "id", isProtected: true,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "username", db: "username", type: "text", label: "Username", readonly: true },
      { name: "userType", db: "user_type", type: "text", label: "User Type", readonly: true },
      { name: "module", db: "module", type: "text", label: "Module", readonly: true },
      { name: "action", db: "action", type: "text", label: "Action", readonly: true },
      { name: "details", db: "details", type: "text", label: "Details", nullable: true, readonly: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "password_reset_tokens", label: "Password Reset Tokens", category: "System",
    primaryKey: "id", isProtected: true,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "token", db: "token", type: "text", label: "Token", hidden: true },
      { name: "userType", db: "user_type", type: "text", label: "User Type", readonly: true },
      { name: "email", db: "email", type: "text", label: "Email", readonly: true },
      { name: "expiresAt", db: "expires_at", type: "timestamp", label: "Expires At", readonly: true },
      { name: "usedAt", db: "used_at", type: "timestamp", label: "Used At", nullable: true, readonly: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "api_integrations", label: "API Integrations", category: "System",
    primaryKey: "id", isProtected: true,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "slug", db: "slug", type: "text", label: "Slug" },
      { name: "enabled", db: "enabled", type: "boolean", label: "Enabled" },
      { name: "status", db: "status", type: "enum", label: "Status", enumValues: ["untested", "ok", "error"] },
      { name: "statusMessage", db: "status_message", type: "text", label: "Status Message", nullable: true },
      { name: "configEnc", db: "config_enc", type: "text", label: "Config (Encrypted)", hidden: true },
      { name: "lastUsedAt", db: "last_used_at", type: "timestamp", label: "Last Used", nullable: true, readonly: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "api_integration_logs", label: "API Integration Logs", category: "System",
    primaryKey: "id", isProtected: true,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "slug", db: "slug", type: "text", label: "Integration Slug", readonly: true },
      { name: "action", db: "action", type: "text", label: "Action", readonly: true },
      { name: "ok", db: "ok", type: "boolean", label: "Success", readonly: true },
      { name: "message", db: "message", type: "text", label: "Message", nullable: true, readonly: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
  {
    name: "audit_logs", label: "DB Audit Logs", category: "System",
    primaryKey: "id", isProtected: true,
    columns: [
      { name: "id", db: "id", type: "id", label: "ID", readonly: true },
      { name: "tableName", db: "table_name", type: "text", label: "Table", readonly: true },
      { name: "rowId", db: "row_id", type: "text", label: "Row ID", nullable: true, readonly: true },
      { name: "action", db: "action", type: "enum", label: "Action", readonly: true, enumValues: ["create", "update", "delete", "restore", "import", "bulk_delete", "bulk_edit"] },
      { name: "actorUsername", db: "actor_username", type: "text", label: "Actor", readonly: true },
      { name: "ipAddress", db: "ip_address", type: "text", label: "IP", nullable: true, readonly: true },
      { name: "createdAt", db: "created_at", type: "timestamp", label: "Created", readonly: true },
    ],
  },
];

// Lookup map: DB table name → TableDef
export const TABLE_MAP = new Map<string, TableDef>(
  TABLE_REGISTRY.map(t => [t.name, t])
);

// All valid table names (used for allowlist validation)
export const ALLOWED_TABLES = new Set(TABLE_REGISTRY.map(t => t.name));
