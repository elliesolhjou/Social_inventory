-- ============================================================================
-- THE SOCIAL INVENTORY — Clean Schema (Dev Mode)
-- Run this AFTER running 00000_drop_all.sql
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ENUMS
CREATE TYPE item_status       AS ENUM ('available', 'borrowed', 'maintenance', 'retired', 'flagged');
CREATE TYPE transaction_state AS ENUM ('requested', 'approved', 'picked_up', 'returned', 'disputed', 'resolved');
CREATE TYPE agent_type        AS ENUM ('vision', 'ledger', 'social', 'mediator');
CREATE TYPE dispute_verdict   AS ENUM ('normal_wear', 'damage_confirmed', 'inconclusive', 'owner_fault');
CREATE TYPE trust_event       AS ENUM ('lend_complete', 'borrow_complete', 'dispute_won', 'dispute_lost', 'vouched', 'flagged');

-- BUILDINGS
CREATE TABLE buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    timezone TEXT DEFAULT 'America/New_York',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- PROFILES (no auth.users FK for dev/seed mode)
CREATE TABLE profiles (
    id UUID PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
    unit_number TEXT,
    trust_score NUMERIC(5,2) DEFAULT 50.00,
    reputation_tags TEXT[] DEFAULT '{}',
    bio TEXT,
    settings JSONB DEFAULT '{}',
    onboarded_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- ITEMS
CREATE TABLE items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL,
    subcategory TEXT,
    metadata JSONB DEFAULT '{}',
    ai_description TEXT,
    ai_category TEXT,
    ai_condition TEXT,
    vision_signature vector(1536),
    thumbnail_url TEXT,
    media_urls TEXT[] DEFAULT '{}',
    status item_status DEFAULT 'available',
    max_borrow_days INT DEFAULT 7,
    deposit_cents INT DEFAULT 0,
    rules TEXT,
    times_borrowed INT DEFAULT 0,
    avg_rating NUMERIC(3,2) DEFAULT 0,
    last_health_check TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- TRANSACTIONS
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    borrower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    building_id UUID NOT NULL REFERENCES buildings(id),
    state transaction_state DEFAULT 'requested',
    pickup_photo_url TEXT,
    pickup_signature vector(1536),
    return_photo_url TEXT,
    return_signature vector(1536),
    requested_at TIMESTAMPTZ DEFAULT now(),
    approved_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    due_at TIMESTAMPTZ,
    returned_at TIMESTAMPTZ,
    deposit_held INT DEFAULT 0,
    deposit_returned INT,
    borrower_rating INT,
    owner_rating INT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- DISPUTES
CREATE TABLE disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    initiated_by UUID NOT NULL REFERENCES profiles(id),
    reason TEXT NOT NULL,
    evidence_urls TEXT[] DEFAULT '{}',
    ai_analysis JSONB,
    verdict dispute_verdict,
    resolution_note TEXT,
    payout_cents INT DEFAULT 0,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- AGENT LOGS
CREATE TABLE agent_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent agent_type NOT NULL,
    transaction_id UUID REFERENCES transactions(id),
    item_id UUID REFERENCES items(id),
    profile_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,
    input_summary TEXT,
    output_summary TEXT,
    reasoning TEXT,
    confidence NUMERIC(4,3),
    vlm_analysis JSONB,
    token_count INT,
    latency_ms INT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- TRUST EVENTS
CREATE TABLE trust_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    event trust_event NOT NULL,
    delta NUMERIC(5,2) NOT NULL,
    reference_id UUID,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- BUILDING INTELLIGENCE
CREATE TABLE building_intelligence (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    report_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    generated_at TIMESTAMPTZ DEFAULT now(),
    expires_at TIMESTAMPTZ
);

-- INDEXES
CREATE INDEX idx_items_building ON items(building_id);
CREATE INDEX idx_items_owner ON items(owner_id);
CREATE INDEX idx_items_status ON items(status);
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_tx_item ON transactions(item_id);
CREATE INDEX idx_tx_borrower ON transactions(borrower_id);
CREATE INDEX idx_tx_state ON transactions(state);
CREATE INDEX idx_tx_building ON transactions(building_id);
CREATE INDEX idx_disputes_tx ON disputes(transaction_id);
CREATE INDEX idx_logs_agent ON agent_logs(agent);
CREATE INDEX idx_trust_profile ON trust_events(profile_id);
CREATE INDEX idx_intel_building ON building_intelligence(building_id, report_type);

-- TRIGGERS
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_items_updated BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_transactions_updated BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- VIEW
CREATE VIEW building_transaction_feed AS
SELECT t.id AS transaction_id, t.building_id, t.state, t.created_at,
       i.title AS item_title, i.category,
       bp.username AS borrower_name, bp.trust_score AS borrower_trust,
       op.username AS owner_name, op.trust_score AS owner_trust
FROM transactions t
JOIN items i ON t.item_id = i.id
JOIN profiles bp ON t.borrower_id = bp.id
JOIN profiles op ON t.owner_id = op.id
ORDER BY t.created_at DESC;