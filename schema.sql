-- One row per learner ID. `data` is a small JSON blob of lesson progress.
CREATE TABLE IF NOT EXISTS progress (
  id         TEXT PRIMARY KEY,
  data       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
