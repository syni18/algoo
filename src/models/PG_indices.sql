CREATE TABLE market_indices (
  id SERIAL PRIMARY KEY,
  index_name VARCHAR(64) UNIQUE NOT NULL,
  is_constituents BOOLEAN DEFAULT TRUE
);

CREATE TABLE index_snapshots (
  id SERIAL PRIMARY KEY,
  index_id INT REFERENCES market_indices(id),
  snapshot_time TIMESTAMP NOT NULL,
  open NUMERIC(10, 2),
  high NUMERIC(10, 2),
  low NUMERIC(10, 2),
  last NUMERIC(10, 2),
  previous_close NUMERIC(10, 2),
  perc_change NUMERIC(6, 2),
  year_high NUMERIC(10, 2),
  year_low NUMERIC(10, 2),
  indicative_close NUMERIC(10, 2),
  ic_change NUMERIC(6, 2),
  ic_per_change NUMERIC(6, 2),
  UNIQUE(index_id, snapshot_time)
);

CREATE INDEX idx_snapshot_time ON index_snapshots(snapshot_time);
CREATE INDEX idx_index_id ON index_snapshots(index_id);

-- Example partitioning, optional for high frequency
-- CREATE TABLE index_snapshots_y2025 PARTITION OF index_snapshots
--     FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');
