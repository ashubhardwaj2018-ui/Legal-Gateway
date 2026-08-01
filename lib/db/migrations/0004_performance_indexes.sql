-- Performance & integrity indexes added during QA audit
-- Safe to run multiple times (IF NOT EXISTS)

-- Quotations: add lead_id column and index
ALTER TABLE quotations ADD COLUMN IF NOT EXISTS lead_id integer;
CREATE INDEX IF NOT EXISTS quotations_lead_id_idx ON quotations(lead_id);
CREATE INDEX IF NOT EXISTS quotations_status_idx ON quotations(status);

-- Consultations (leads): status, assigned_to, created_at, next_follow_up
CREATE INDEX IF NOT EXISTS consultations_status_idx ON consultations(status);
CREATE INDEX IF NOT EXISTS consultations_assigned_to_idx ON consultations(assigned_to);
CREATE INDEX IF NOT EXISTS consultations_created_at_idx ON consultations(created_at DESC);
CREATE INDEX IF NOT EXISTS consultations_next_follow_up_idx ON consultations(next_follow_up) WHERE next_follow_up IS NOT NULL;

-- Lead sub-tables: always queried by lead_id
CREATE INDEX IF NOT EXISTS lead_notes_lead_id_idx ON lead_notes(lead_id);
CREATE INDEX IF NOT EXISTS lead_timeline_lead_id_idx ON lead_timeline(lead_id);
CREATE INDEX IF NOT EXISTS lead_tasks_lead_id_idx ON lead_tasks(lead_id);
CREATE INDEX IF NOT EXISTS lead_tasks_assignee_idx ON lead_tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS lead_assignments_lead_id_idx ON lead_assignments(lead_id);
CREATE INDEX IF NOT EXISTS lead_assignments_employee_id_idx ON lead_assignments(employee_id);

-- Invoices: lead_id (already has status/type indexes)
CREATE INDEX IF NOT EXISTS invoices_lead_id_idx ON invoices(lead_id) WHERE lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS invoices_client_email_idx ON invoices(client_email);
CREATE INDEX IF NOT EXISTS invoices_created_at_idx ON invoices(created_at DESC);

-- Activity & Login logs: frequently filtered by user
CREATE INDEX IF NOT EXISTS activity_logs_user_id_idx ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS activity_logs_created_at_idx ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS login_history_user_id_idx ON login_history(user_id);
CREATE INDEX IF NOT EXISTS login_history_created_at_idx ON login_history(created_at DESC);

-- Portal documents: lead_id is already indexed, add client_email
CREATE INDEX IF NOT EXISTS portal_documents_created_at_idx ON portal_documents(created_at DESC);

-- Contacts
CREATE INDEX IF NOT EXISTS contacts_email_idx ON contacts(email);
CREATE INDEX IF NOT EXISTS contacts_created_at_idx ON contacts(created_at DESC);

-- Notifications: is_read for fast unread queries
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications(recipient_id, is_read) WHERE NOT is_read;

-- Tasks: lead_id for lead detail views
CREATE INDEX IF NOT EXISTS tasks_lead_id_idx ON tasks(lead_id) WHERE lead_id IS NOT NULL;

-- WhatsApp messages: already indexed by lead_id and created_at (wa_messages_lead_idx, wa_messages_created_idx)
-- Add compound for status filtering
CREATE INDEX IF NOT EXISTS wa_messages_status_idx ON whatsapp_messages(status);

-- Blogs: published_at for blog listing
CREATE INDEX IF NOT EXISTS blogs_published_at_idx ON blogs(published_at DESC) WHERE status = 'published';

-- Locations: population for sorting, state for hub pages
CREATE INDEX IF NOT EXISTS locations_population_idx ON locations(population DESC NULLS LAST) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS locations_state_idx ON locations(state) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS locations_district_idx ON locations(district) WHERE is_active = true;

-- Indian companies: common search fields
CREATE INDEX IF NOT EXISTS indian_companies_company_name_idx ON indian_companies(company_name);
CREATE INDEX IF NOT EXISTS indian_companies_state_idx ON indian_companies(state);
