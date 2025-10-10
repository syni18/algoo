CREATE TABLE email_audit (
  id UUID PRIMARY KEY,
  job_id text,
  to_email varchar(320),
  subject text,
  type text,
  status varchar(50) NOT NULL, -- queued | sent | failed | dlq
  attempt_count int DEFAULT 0,
  failure_reason text,
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_email_audit_status ON email_audit(status);
CREATE INDEX idx_email_audit_to_email ON email_audit(to_email);
CREATE INDEX idx_email_audit_type ON email_audit(type);
CREATE INDEX idx_email_audit_created_at ON email_audit(created_at DESC);
CREATE INDEX idx_email_audit_job_id ON email_audit(job_id);
