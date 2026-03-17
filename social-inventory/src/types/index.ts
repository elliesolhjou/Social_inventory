// ============================================================================
// THE SOCIAL INVENTORY — Core Type Definitions
// ============================================================================

// --- Enums ---
export type ItemStatus =
  | "available"
  | "borrowed"
  | "maintenance"
  | "retired"
  | "flagged";
export type TransactionState =
  | "requested"
  | "approved"
  | "picked_up"
  | "returned"
  | "disputed"
  | "resolved";
export type AgentType = "vision" | "ledger" | "social" | "mediator";
export type DisputeVerdict =
  | "normal_wear"
  | "damage_confirmed"
  | "inconclusive"
  | "owner_fault";
export type TrustEvent =
  | "lend_complete"
  | "borrow_complete"
  | "dispute_won"
  | "dispute_lost"
  | "vouched"
  | "flagged";

// --- Core Models ---
export interface Building {
  id: string;
  name: string;
  address: string;
  geo?: { x: number; y: number };
  timezone: string;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface Profile {
  id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  building_id?: string;
  unit_number?: string;
  trust_score: number;
  reputation_tags: string[];
  bio?: string;
  settings: ProfileSettings;
  onboarded_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileSettings {
  notifications: boolean;
  public_profile: boolean;
}

export interface Item {
  id: string;
  owner_id: string;
  building_id: string;
  title: string;
  description?: string;
  category: string;
  subcategory?: string;
  metadata: ItemMetadata;
  ai_description?: string;
  ai_category?: string;
  ai_condition?: string;
  vision_signature?: number[];
  thumbnail_url?: string;
  media_urls: string[];
  status: ItemStatus;
  max_borrow_days: number;
  deposit_cents: number;
  rules?: string;
  times_borrowed: number;
  avg_rating: number;
  last_health_check?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  owner?: Profile;
}

export interface ItemMetadata {
  brand?: string;
  model?: string;
  year?: number;
  color?: string;
  size?: string;
  original_price_cents?: number;
  condition_at_listing?: string;
  serial_number?: string;
  [key: string]: unknown;
}

export interface Transaction {
  id: string;
  item_id: string;
  borrower_id: string;
  owner_id: string;
  building_id: string;
  state: TransactionState;
  pickup_photo_url?: string;
  pickup_signature?: number[];
  return_photo_url?: string;
  return_signature?: number[];
  requested_at: string;
  approved_at?: string;
  picked_up_at?: string;
  due_at?: string;
  returned_at?: string;
  deposit_held: number;
  deposit_returned?: number;
  borrower_rating?: number;
  owner_rating?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined
  item?: Item;
  borrower?: Profile;
  owner?: Profile;
}

export interface Dispute {
  id: string;
  transaction_id: string;
  initiated_by: string;
  reason: string;
  evidence_urls: string[];
  ai_analysis?: AIMediatorAnalysis;
  verdict?: DisputeVerdict;
  resolution_note?: string;
  payout_cents: number;
  resolved_at?: string;
  created_at: string;
}

export interface AIMediatorAnalysis {
  checkout_condition: string;
  checkin_condition: string;
  damage_detected: boolean;
  damage_description?: string;
  confidence: number;
  wear_classification: "normal" | "excessive" | "negligent";
  recommended_action: string;
  recommended_payout_cents: number;
  reasoning_chain: string[];
}

export interface AgentLog {
  id: string;
  agent: AgentType;
  transaction_id?: string;
  item_id?: string;
  profile_id?: string;
  action: string;
  input_summary?: string;
  output_summary?: string;
  reasoning?: string;
  confidence?: number;
  vlm_analysis?: Record<string, unknown>;
  token_count?: number;
  latency_ms?: number;
  created_at: string;
}

// --- Agent Protocol (Mailbox) ---
export interface AgentMessage {
  id: string;
  from: AgentType;
  to: AgentType;
  action: string;
  payload: Record<string, unknown>;
  correlation_id: string;
  priority: "low" | "normal" | "high" | "critical";
  timestamp: string;
}

export interface AgentResponse {
  message_id: string;
  agent: AgentType;
  success: boolean;
  result: Record<string, unknown>;
  reasoning?: string;
  confidence?: number;
  duration_ms: number;
}

// --- Building Intelligence ---
export interface TrendingReport {
  building_id: string;
  trending_categories: {
    category: string;
    demand_score: number;
    velocity: number;
  }[];
  wishlist_gaps: { description: string; requested_count: number }[];
  peak_hours: { hour: number; transaction_count: number }[];
  community_health: number; // 0-100
  generated_at: string;
}

// --- VLM Types ---
export interface VisionAnalysis {
  item_identified: string;
  category: string;
  subcategory?: string;
  condition: string;
  description: string;
  notable_features: string[];
  damage_areas: { location: string; severity: string; description: string }[];
  confidence: number;
  embedding?: number[];
}

export interface TrustHandshakeResult {
  matches_original: boolean;
  condition_delta: string;
  new_damage_detected: boolean;
  damage_details?: string[];
  confidence: number;
  recommendation: "approve" | "flag" | "dispute";
}
