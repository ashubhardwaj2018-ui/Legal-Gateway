-- Add break timestamp columns to working_hours
ALTER TABLE working_hours
  ADD COLUMN IF NOT EXISTS break_start_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS break_end_at   TIMESTAMPTZ;

-- Attendance correction requests
CREATE TABLE IF NOT EXISTS attendance_corrections (
  id                  SERIAL PRIMARY KEY,
  employee_id         INTEGER     NOT NULL,
  date                TEXT        NOT NULL,
  requested_clock_in  TIMESTAMPTZ,
  requested_clock_out TIMESTAMPTZ,
  reason              TEXT,
  status              TEXT        NOT NULL DEFAULT 'pending',
  reviewed_by         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ac_employee_idx ON attendance_corrections (employee_id);
CREATE INDEX IF NOT EXISTS ac_status_idx   ON attendance_corrections (status);
