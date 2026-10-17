-- One row per report. No IP, e-mail or browser information is stored.
CREATE TABLE IF NOT EXISTS reports (
  id            TEXT PRIMARY KEY,   -- random UUID, never shown to visitors
  created_at    TEXT NOT NULL,      -- UTC
  type          TEXT NOT NULL CHECK (type IN
                  ('merge','name','relation','personality','other')),
  archive       TEXT NOT NULL,      -- e.g. main-08
  data_version  TEXT NOT NULL,      -- fullgraph runId
  body          TEXT NOT NULL,      -- the whole Report JSON, with the optional username
  status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN
                  ('new','accepted','rejected','duplicate'))
);
CREATE INDEX IF NOT EXISTS reports_open ON reports (status, created_at);

-- Site-wide count per hour, for the hourly cap. Nothing about visitors.
CREATE TABLE IF NOT EXISTS quota (
  hour TEXT PRIMARY KEY,            -- UTC, e.g. '2026-10-17T05'
  n    INTEGER NOT NULL
);
