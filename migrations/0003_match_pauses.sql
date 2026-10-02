ALTER TABLE matches ADD COLUMN paused_at TEXT;
ALTER TABLE matches ADD COLUMN paused_duration_seconds INTEGER NOT NULL DEFAULT 0;
