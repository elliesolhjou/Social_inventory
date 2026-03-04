-- ============================================================================
-- THE SOCIAL INVENTORY — Initial Schema Migration
-- ============================================================================
-- Architecture: Agent-based (VisionAgent, LedgerAgent, SocialAgent)
-- Design for: 1M token context window ingestion of building history
-- ============================================================================

-- 0. EXTENSIONS
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";        -- pgvector for vision signatures
CREATE EXTENSION IF NOT EXISTS "pg_trgm";       -- fuzzy text search on items

-- 1. ENUMS
-- ============================================================================
CREATE TYPE item_status       AS ENUM ('available', 'borrowed', 'maintenance', 'retired', 'flagged');
CREATE TYPE transaction_state AS ENUM ('requested', 'approved', 'picked_up', 'returned', 'disputed', 'resolved');
CREATE TYPE agent_type        AS ENUM ('vision', 'ledger', 'social', 'mediator');
CREATE TYPE dispute_verdict   AS ENUM ('normal_wear', 'damage_confirmed', 'inconclusive', 'owner_fault');
CREATE TYPE trust_event       AS ENUM ('lend_complete', 'borrow_complete', 'dispute_won', 'dispute_lost', 'vouched', 'flagged');

-- 2. CORE TABLES
-- ============================================================================

-- 2a. BUILDINGS — the atomic unit of a sharing community
CREATE TABLE buildings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    address         TEXT NOT NULL,
    geo             POINT,
    timezone        TEXT DEFAULT 'America/New_York',
    settings        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);

-- 2b. PROFILES — extends Supabase auth.users
CREATE TABLE profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username        TEXT UNIQUE NOT NULL CHECK (char_length(username) BETWEEN 3 AND 30),
    display_name    TEXT,
    avatar_url      TEXT,
    building_id     UUID REFERENCES buildings(id) ON DELETE SET NULL,
    unit_number     TEXT,
    trust_score     NUMERIC(5,2) DEFAULT 50.00 CHECK (trust_score BETWEEN 0 AND 100),
    reputation_tags TEXT[] DEFAULT '{}',
    bio             TEXT,
    settings        JSONB DEFAULT '{"notifications": true, "public_profile": true}',
    onboarded_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_building ON profiles(building_id);
CREATE INDEX idx_profiles_trust    ON profiles(trust_score DESC);
CREATE INDEX idx_profiles_tags     ON profiles USING GIN(reputation_tags);

-- 2c. ITEMS — the things people share
CREATE TABLE items (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    building_id       UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    title             TEXT NOT NULL,
    description       TEXT,
    category          TEXT NOT NULL,
    subcategory       TEXT,
    metadata          JSONB DEFAULT '{}',
    -- VLM-generated fields (via VisionAgent)
    ai_description    TEXT,
    ai_category       TEXT,
    ai_condition      TEXT,
    vision_signature  vector(1536),       -- embedding of item's "birth state"
    thumbnail_url     TEXT,
    media_urls        TEXT[] DEFAULT '{}',
    -- Availability & rules
    status            item_status DEFAULT 'available',
    max_borrow_days   INT DEFAULT 7,
    deposit_cents     INT DEFAULT 0,
    rules             TEXT,
    -- Metrics
    times_borrowed    INT DEFAULT 0,
    avg_rating        NUMERIC(3,2) DEFAULT 0,
    last_health_check TIMESTAMPTZ,
    created_at        TIMESTAMPTZ DEFAULT now(),
    updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_items_building  ON items(building_id);
CREATE INDEX idx_items_owner     ON items(owner_id);
CREATE INDEX idx_items_status    ON items(status);
CREATE INDEX idx_items_category  ON items(category);
CREATE INDEX idx_items_vision    ON items USING ivfflat (vision_signature vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_items_metadata  ON items USING GIN(metadata);
CREATE INDEX idx_items_search    ON items USING GIN(title gin_trgm_ops);

-- 2d. TRANSACTIONS — the lending lifecycle
CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id         UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    borrower_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    owner_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    building_id     UUID NOT NULL REFERENCES buildings(id),
    state           transaction_state DEFAULT 'requested',
    -- Trust Handshake media
    pickup_photo_url   TEXT,
    pickup_signature   vector(1536),     -- VLM embedding at pickup
    return_photo_url   TEXT,
    return_signature   vector(1536),     -- VLM embedding at return
    -- Timing
    requested_at    TIMESTAMPTZ DEFAULT now(),
    approved_at     TIMESTAMPTZ,
    picked_up_at    TIMESTAMPTZ,
    due_at          TIMESTAMPTZ,
    returned_at     TIMESTAMPTZ,
    -- Financial
    deposit_held    INT DEFAULT 0,
    deposit_returned INT,
    -- Ratings (post-return)
    borrower_rating INT CHECK (borrower_rating BETWEEN 1 AND 5),
    owner_rating    INT CHECK (owner_rating BETWEEN 1 AND 5),
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_tx_item      ON transactions(item_id);
CREATE INDEX idx_tx_borrower  ON transactions(borrower_id);
CREATE INDEX idx_tx_owner     ON transactions(owner_id);
CREATE INDEX idx_tx_state     ON transactions(state);
CREATE INDEX idx_tx_building  ON transactions(building_id);
CREATE INDEX idx_tx_timeline  ON transactions(building_id, created_at DESC);

-- 2e. DISPUTES — escalation layer
CREATE TABLE disputes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id  UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    initiated_by    UUID NOT NULL REFERENCES profiles(id),
    reason          TEXT NOT NULL,
    evidence_urls   TEXT[] DEFAULT '{}',
    -- AI Mediator output
    ai_analysis     JSONB,
    verdict         dispute_verdict,
    resolution_note TEXT,
    payout_cents    INT DEFAULT 0,
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_disputes_tx ON disputes(transaction_id);

-- 2f. AGENT LOGS — full audit trail for all AI agents
CREATE TABLE agent_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent           agent_type NOT NULL,
    transaction_id  UUID REFERENCES transactions(id),
    item_id         UUID REFERENCES items(id),
    profile_id      UUID REFERENCES profiles(id),
    action          TEXT NOT NULL,
    input_summary   TEXT,
    output_summary  TEXT,
    reasoning       TEXT,                  -- chain-of-thought from adaptive reasoning
    confidence      NUMERIC(4,3),
    vlm_analysis    JSONB,
    token_count     INT,
    latency_ms      INT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_logs_agent   ON agent_logs(agent);
CREATE INDEX idx_logs_tx      ON agent_logs(transaction_id);
CREATE INDEX idx_logs_item    ON agent_logs(item_id);
CREATE INDEX idx_logs_time    ON agent_logs(created_at DESC);

-- 2g. TRUST EVENTS — granular trust ledger (feeds trust_score)
CREATE TABLE trust_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event           trust_event NOT NULL,
    delta           NUMERIC(5,2) NOT NULL,
    reference_id    UUID,                  -- transaction or dispute id
    note            TEXT,
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_trust_profile ON trust_events(profile_id, created_at DESC);

-- 2h. BUILDING INTELLIGENCE — materialized analytics cache
CREATE TABLE building_intelligence (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id     UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    report_type     TEXT NOT NULL,          -- 'trending', 'demand_gap', 'trust_network'
    payload         JSONB NOT NULL,
    generated_at    TIMESTAMPTZ DEFAULT now(),
    expires_at      TIMESTAMPTZ
);

CREATE INDEX idx_intel_building ON building_intelligence(building_id, report_type);

-- 3. ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE items              ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_logs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE building_intelligence ENABLE ROW LEVEL SECURITY;

-- Profiles: viewable by same building, editable by self
CREATE POLICY profiles_view ON profiles FOR SELECT
    USING (building_id IN (SELECT building_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY profiles_edit ON profiles FOR UPDATE
    USING (id = auth.uid());

-- Items: viewable by same building, manageable by owner
CREATE POLICY items_view ON items FOR SELECT
    USING (building_id IN (SELECT building_id FROM profiles WHERE id = auth.uid()));
CREATE POLICY items_manage ON items FOR ALL
    USING (owner_id = auth.uid());

-- Transactions: visible to participants
CREATE POLICY tx_participant ON transactions FOR SELECT
    USING (borrower_id = auth.uid() OR owner_id = auth.uid());
CREATE POLICY tx_create ON transactions FOR INSERT
    WITH CHECK (borrower_id = auth.uid());
CREATE POLICY tx_update ON transactions FOR UPDATE
    USING (borrower_id = auth.uid() OR owner_id = auth.uid());

-- Disputes: visible to transaction participants
CREATE POLICY disputes_view ON disputes FOR SELECT
    USING (transaction_id IN (
        SELECT id FROM transactions WHERE borrower_id = auth.uid() OR owner_id = auth.uid()
    ));

-- Agent logs: visible to related user
CREATE POLICY logs_view ON agent_logs FOR SELECT
    USING (profile_id = auth.uid());

-- Trust events: own events only
CREATE POLICY trust_own ON trust_events FOR SELECT
    USING (profile_id = auth.uid());

-- Building intelligence: same building
CREATE POLICY intel_view ON building_intelligence FOR SELECT
    USING (building_id IN (SELECT building_id FROM profiles WHERE id = auth.uid()));

-- 4. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated    BEFORE UPDATE ON profiles     FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_items_updated       BEFORE UPDATE ON items        FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_transactions_updated BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- Recalculate trust_score from trust_events (moving weighted average)
CREATE OR REPLACE FUNCTION recalculate_trust_score()
RETURNS TRIGGER AS $$
DECLARE
    new_score NUMERIC(5,2);
BEGIN
    SELECT GREATEST(0, LEAST(100,
        50 + COALESCE(SUM(
            delta * POWER(0.95, EXTRACT(EPOCH FROM (now() - created_at)) / 86400)
        ), 0)
    ))
    INTO new_score
    FROM trust_events
    WHERE profile_id = NEW.profile_id;

    UPDATE profiles SET trust_score = new_score WHERE id = NEW.profile_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trust_recalc AFTER INSERT ON trust_events
    FOR EACH ROW EXECUTE FUNCTION recalculate_trust_score();

-- Increment borrow count on successful pickup
CREATE OR REPLACE FUNCTION on_item_picked_up()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.state = 'picked_up' AND OLD.state = 'approved' THEN
        UPDATE items SET times_borrowed = times_borrowed + 1 WHERE id = NEW.item_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER item_borrow_count AFTER UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION on_item_picked_up();

-- 5. VIEWS — for Building Intelligence context ingestion
-- ============================================================================

-- Flat view for 1M-token context packing
CREATE VIEW building_transaction_feed AS
SELECT
    t.id AS transaction_id,
    t.building_id,
    t.state,
    t.created_at,
    t.picked_up_at,
    t.returned_at,
    i.title AS item_title,
    i.category,
    i.subcategory,
    i.ai_condition,
    i.times_borrowed,
    bp.username AS borrower_name,
    bp.trust_score AS borrower_trust,
    op.username AS owner_name,
    op.trust_score AS owner_trust,
    d.verdict AS dispute_verdict
FROM transactions t
JOIN items i ON t.item_id = i.id
JOIN profiles bp ON t.borrower_id = bp.id
JOIN profiles op ON t.owner_id = op.id
LEFT JOIN disputes d ON d.transaction_id = t.id
ORDER BY t.created_at DESC;