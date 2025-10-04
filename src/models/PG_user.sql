-- =====================================================
-- CUSTOM TYPES
-- =====================================================
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification', 'deleted');
CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'premium', 'enterprise');
CREATE TYPE kyc_status AS ENUM ('not_started', 'pending', 'in_review', 'verified', 'rejected');
CREATE TYPE risk_profile AS ENUM ('conservative', 'moderate', 'aggressive', 'very_aggressive');
CREATE TYPE account_type AS ENUM ('individual', 'joint', 'corporate', 'trust');
CREATE TYPE notification_preference AS ENUM ('email', 'sms', 'push', 'in_app');

-- =====================================================
-- MAIN USERS TABLE
-- =====================================================
CREATE TABLE users (
    id                          UUID PRIMARY KEY,
    username                    VARCHAR(50) UNIQUE NOT NULL,
    email                       VARCHAR(320) UNIQUE NOT NULL,
    phone                       VARCHAR(20) UNIQUE,
    password_hash               TEXT NOT NULL,
    salt                        TEXT NULL,
    two_factor_secret           TEXT,
    is_two_factor_enabled       BOOLEAN DEFAULT FALSE,
    failed_login_attempts       INTEGER DEFAULT 0,
    locked_until                TIMESTAMP WITH TIME ZONE,
    password_reset_token        TEXT,
    password_reset_expires      TIMESTAMP WITH TIME ZONE,
    email_verification_token    TEXT,
    phone_verification_token    TEXT,
    first_name                  VARCHAR(100) NOT NULL,
    last_name                   VARCHAR(100),
    middle_name                 VARCHAR(100),
    display_name                VARCHAR(200),
    date_of_birth               DATE,
    gender                      VARCHAR(20),
    nationality                 VARCHAR(3),
    address_line1               VARCHAR(255),
    address_line2               VARCHAR(255),
    city                        VARCHAR(100),
    state_province              VARCHAR(100),
    postal_code                 VARCHAR(20),
    country                     VARCHAR(3),
    account_type                account_type DEFAULT 'individual',
    subscription_tier           subscription_tier DEFAULT 'free',
    risk_profile                risk_profile DEFAULT 'moderate',
    annual_income               DECIMAL(15,2),
    net_worth                   DECIMAL(15,2),
    investment_experience       INTEGER,
    preferred_currency          VARCHAR(3) DEFAULT 'USD',
    kyc_status                  kyc_status DEFAULT 'not_started',
    kyc_submitted_at            TIMESTAMP WITH TIME ZONE,
    kyc_verified_at             TIMESTAMP WITH TIME ZONE,
    kyc_rejection_reason        TEXT,
    aml_risk_score              INTEGER CHECK (aml_risk_score >= 0 AND aml_risk_score <= 100),
    tax_id                      VARCHAR(50),
    tax_country                 VARCHAR(3),
    is_us_person                BOOLEAN DEFAULT FALSE,
    fatca_status                VARCHAR(50),
    status                      user_status DEFAULT 'pending_verification',
    is_email_verified           BOOLEAN DEFAULT FALSE,
    is_phone_verified           BOOLEAN DEFAULT FALSE,
    email_verified_at           TIMESTAMP WITH TIME ZONE,
    phone_verified_at           TIMESTAMP WITH TIME ZONE,
    last_login_at               TIMESTAMP WITH TIME ZONE,
    last_login_ip               INET,
    login_count                 INTEGER DEFAULT 0,
    timezone                    VARCHAR(50) DEFAULT 'UTC',
    language                    VARCHAR(5) DEFAULT 'en',
    date_format                 VARCHAR(20) DEFAULT 'DD-MM-YYYY',
    number_format               VARCHAR(20) DEFAULT 'US',
    theme_preference            VARCHAR(20) DEFAULT 'light',
    notification_preferences    JSONB DEFAULT '{
        "email_alerts": true,
        "price_alerts": true,
        "news_updates": true,
        "portfolio_reports": true,
        "marketing": false,
        "channels": ["email"]
    }',
    is_trading_enabled          BOOLEAN DEFAULT FALSE,
    max_daily_trades            INTEGER DEFAULT 10,
    max_position_size           DECIMAL(15,2),
    margin_enabled              BOOLEAN DEFAULT FALSE,
    options_enabled             BOOLEAN DEFAULT FALSE,
    crypto_enabled              BOOLEAN DEFAULT FALSE,
    referral_code               VARCHAR(20) UNIQUE,
    referred_by_code            VARCHAR(20),
    marketing_source            VARCHAR(100),
    utm_campaign                VARCHAR(100),
    utm_source                  VARCHAR(100),
    utm_medium                  VARCHAR(100),
    gdpr_consent_given          BOOLEAN DEFAULT FALSE,
    gdpr_consent_date           TIMESTAMP WITH TIME ZONE,
    data_processing_consent     BOOLEAN DEFAULT FALSE,
    marketing_consent           BOOLEAN DEFAULT FALSE,
    cookie_consent              JSONB,
    created_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by                  UUID,
    updated_by                  UUID,
    version                     INTEGER DEFAULT 1,
    is_deleted                  BOOLEAN DEFAULT FALSE,
    deleted_at                  TIMESTAMP WITH TIME ZONE,
    deleted_by                  UUID,
    deletion_reason             TEXT,
    metadata                    JSONB DEFAULT '{}'
);

-- =====================================================
-- USER SESSIONS TABLE
-- =====================================================
CREATE TABLE user_sessions (
    id                 UUID PRIMARY KEY,
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token      TEXT UNIQUE NOT NULL,
    ip_address         INET,
    user_agent         TEXT,
    device_info        JSONB,
    location_info      JSONB,
    is_active          BOOLEAN DEFAULT TRUE,
    expires_at         TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at         TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at   TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- USER AUDIT LOG
-- =====================================================
CREATE TABLE user_audit_log (
    id             BIGSERIAL PRIMARY KEY,
    user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    action         VARCHAR(100) NOT NULL,
    table_name     VARCHAR(100) NOT NULL,
    old_values     JSONB,
    new_values     JSONB,
    ip_address     INET,
    user_agent     TEXT,
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by     UUID
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE UNIQUE INDEX idx_users_username_lower ON users (LOWER(username));
CREATE UNIQUE INDEX idx_users_email_lower ON users (LOWER(email));
CREATE UNIQUE INDEX idx_users_phone ON users (phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX idx_users_referral_code ON users (referral_code) WHERE referral_code IS NOT NULL;

CREATE INDEX idx_users_status ON users (status) WHERE status != 'deleted';
CREATE INDEX idx_users_active ON users (id) WHERE status = 'active' AND is_deleted = FALSE;
CREATE INDEX idx_users_subscription_tier ON users (subscription_tier);
CREATE INDEX idx_users_kyc_status ON users (kyc_status);

CREATE INDEX idx_users_password_reset ON users (password_reset_token) WHERE password_reset_token IS NOT NULL;
CREATE INDEX idx_users_email_verification ON users (email_verification_token) WHERE email_verification_token IS NOT NULL;
CREATE INDEX idx_users_locked_until ON users (locked_until);

CREATE INDEX idx_users_created_at ON users (created_at);
CREATE INDEX idx_users_last_login ON users (last_login_at) WHERE last_login_at IS NOT NULL;

CREATE INDEX idx_users_country ON users (country) WHERE country IS NOT NULL;
CREATE INDEX idx_users_location ON users (country, state_province, city) WHERE country IS NOT NULL;

CREATE INDEX idx_users_name_search ON users (first_name, last_name);
CREATE INDEX idx_users_display_name_search ON users (display_name) WHERE display_name IS NOT NULL;
CREATE INDEX idx_users_notification_prefs ON users ((notification_preferences::text));
CREATE INDEX idx_users_metadata ON users ((metadata::text));

CREATE INDEX idx_sessions_user_id ON user_sessions (user_id);
CREATE INDEX idx_sessions_token ON user_sessions (session_token);
CREATE INDEX idx_sessions_active ON user_sessions (user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_expires ON user_sessions (expires_at) WHERE is_active = TRUE;

CREATE INDEX idx_audit_user_id ON user_audit_log (user_id);
CREATE INDEX idx_audit_action ON user_audit_log (action, created_at);
CREATE INDEX idx_audit_created_at ON user_audit_log (created_at);

-- =====================================================
-- ALTER TABLE - ADDITIONAL COLUMNS
-- =====================================================

ALTER TABLE users
ADD COLUMN social_media_profiles JSONB,
ADD COLUMN profile_picture_url VARCHAR(255),
ADD COLUMN last_password_change TIMESTAMPTZ,
ADD COLUMN account_verified_at TIMESTAMPTZ,
ADD COLUMN user_role JSONB,
ADD COLUMN timezone_auto_detected BOOLEAN DEFAULT FALSE,
ADD COLUMN locale VARCHAR(10),
ADD COLUMN biometric_auth_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN last_password_fail_reason VARCHAR(255),
ADD COLUMN opt_in_beta_features BOOLEAN DEFAULT FALSE,
ADD COLUMN security_questions JSONB,
ADD COLUMN max_concurrent_sessions INTEGER,
ADD COLUMN user_engagement_metrics JSONB,
ADD COLUMN preferred_communication_time VARCHAR(20),
ADD COLUMN account_expiry_date DATE,
ADD COLUMN api_key UUID,
ADD COLUMN two_factor_backup_codes JSONB,
ADD COLUMN data_retention_consent_date TIMESTAMPTZ;


-- =====================================================
-- PARTITIONING SETUP FOR AUDIT LOG
-- =====================================================
CREATE TABLE user_audit_log_partitioned (
    LIKE user_audit_log INCLUDING ALL
) PARTITION BY RANGE (created_at);

CREATE TABLE user_audit_log_y2024 PARTITION OF user_audit_log_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE user_audit_log_y2025 PARTITION OF user_audit_log_partitioned
    FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_isolation_policy ON users
    FOR ALL
    TO application_role
    USING (id = current_setting('app.current_user_id')::UUID);

-- =====================================================
-- USER MANAGEMENT FUNCTIONS
-- =====================================================
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
    code TEXT;
    exists BOOLEAN := TRUE;
BEGIN
    WHILE exists LOOP
        code := upper(substr(md5(random()::text), 1, 8));
        SELECT EXISTS(SELECT 1 FROM users WHERE referral_code = code) INTO exists;
    END LOOP;
    RETURN code;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_user(
    p_username VARCHAR(50),
    p_email VARCHAR(320),
    p_password_hash TEXT,
    p_salt TEXT,
    p_first_name VARCHAR(100),
    p_last_name VARCHAR(100)
)
RETURNS UUID AS $$
DECLARE
    new_user_id UUID;
BEGIN
    INSERT INTO users (
        username, email, password_hash, salt, first_name, last_name, referral_code
    ) VALUES (
        p_username, LOWER(p_email), p_password_hash, p_salt, p_first_name, p_last_name, generate_referral_code()
    ) RETURNING id INTO new_user_id;
    RETURN new_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SAMPLE DATA VIEWS
-- =====================================================
CREATE VIEW user_public_info AS
SELECT 
    id,
    username,
    display_name,
    first_name,
    last_name,
    subscription_tier,
    created_at,
    country
FROM users
WHERE status = 'active' AND is_deleted = FALSE;

CREATE VIEW user_dashboard AS
SELECT 
    id,
    username,
    email,
    first_name,
    last_name,
    subscription_tier,
    status,
    kyc_status,
    last_login_at,
    notification_preferences,
    preferred_currency,
    risk_profile
FROM users
WHERE is_deleted = FALSE;
