// ============================================================================
// SEED SCRIPT — "The Meridian" Luxury Apartment Building
// ============================================================================
// Generates realistic data for a premium 40-unit building in Brooklyn Heights:
//   - 1 building
//   - 20 resident profiles with varied trust scores and reputation tags
//   - 50 items across 8 categories (the things affluent urbanites actually share)
//   - 80 historical transactions with realistic state distribution
//   - 15 trust events
//   - 3 disputes (1 resolved, 1 pending, 1 normal wear)
//
// Run: npx tsx supabase/seed/seed.ts
// ============================================================================
import 'dotenv/config';
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role for seeding
);

// --- Deterministic IDs for referential integrity ---
const BUILDING_ID = "550e8400-e29b-41d4-a716-000000000000";

function uid(n: number): string {
  // UUID last segment must be exactly 12 hex chars
  return `550e8400-e29b-41d4-a716-${n.toString().padStart(12, "0")}`;
}

// ============================================================================
// BUILDING
// ============================================================================
const building = {
  id: BUILDING_ID,
  name: "The Meridian",
  address: "180 Montague Street, Brooklyn Heights, NY 11201",
  timezone: "America/New_York",
  settings: {
    max_borrow_days_default: 7,
    require_deposit: true,
    auto_approve_trust_above: 75,
    community_rules: "Be kind. Return items clean. Communicate delays early.",
  },
};

// ============================================================================
// PROFILES (20 residents)
// ============================================================================
const profiles = [
  {
    id: uid(1),
    username: "maya_chen",
    display_name: "Maya Chen",
    unit: "4A",
    trust: 92.5,
    tags: ["Gear Guru", "Trusted Lender", "Always On Time"],
    bio: "Product designer. Gadget enthusiast. Ask me about cameras.",
  },
  {
    id: uid(2),
    username: "jdelvecchio",
    display_name: "James DelVecchio",
    unit: "12B",
    trust: 88.0,
    tags: ["Trusted Lender", "Dispute-Free"],
    bio: "Chef at Olmsted. Happy to lend kitchen gear to fellow foodies.",
  },
  {
    id: uid(3),
    username: "priya.k",
    display_name: "Priya Krishnan",
    unit: "7C",
    trust: 95.0,
    tags: ["Community Pillar", "Gear Guru"],
    bio: "VC at a16z. I own way too many gadgets — please borrow them.",
  },
  {
    id: uid(4),
    username: "tomás_r",
    display_name: "Tomás Rivera",
    unit: "2D",
    trust: 76.3,
    tags: ["Power Borrower"],
    bio: "Filmmaker. Always looking for gear between shoots.",
  },
  {
    id: uid(5),
    username: "sarah.builds",
    display_name: "Sarah Kim",
    unit: "9A",
    trust: 84.7,
    tags: ["Always On Time", "Dispute-Free"],
    bio: "Architect. I have every tool known to humanity.",
  },
  {
    id: uid(6),
    username: "dex_outdoors",
    display_name: "Dexter Okonkwo",
    unit: "15C",
    trust: 91.2,
    tags: ["Gear Guru", "Trusted Lender"],
    bio: "Weekend warrior. Camping, climbing, kayaking — I have it all.",
  },
  {
    id: uid(7),
    username: "lena.m",
    display_name: "Lena Müller",
    unit: "6B",
    trust: 70.5,
    tags: ["New Neighbor"],
    bio: "Just moved from Berlin! Still furnishing, would love to borrow.",
  },
  {
    id: uid(8),
    username: "rob_fitness",
    display_name: "Robert Park",
    unit: "11A",
    trust: 87.9,
    tags: ["Trusted Lender"],
    bio: "Personal trainer. Peloton, weights, recovery tools — all shareable.",
  },
  {
    id: uid(9),
    username: "zoe.reads",
    display_name: "Zoe Washington",
    unit: "3C",
    trust: 93.1,
    tags: ["Community Pillar", "Always On Time"],
    bio: "Librarian at BPL. I treat borrowed items like rare manuscripts.",
  },
  {
    id: uid(10),
    username: "nick.audio",
    display_name: "Nick Petrov",
    unit: "8D",
    trust: 82.4,
    tags: ["Gear Guru"],
    bio: "Sound engineer. Mics, monitors, mixers — ask away.",
  },
  {
    id: uid(11),
    username: "amira.cooks",
    display_name: "Amira Hassan",
    unit: "5B",
    trust: 89.6,
    tags: ["Trusted Lender", "Dispute-Free"],
    bio: "Food blogger. My kitchen is a small restaurant at this point.",
  },
  {
    id: uid(12),
    username: "kai_ventures",
    display_name: "Kai Tanaka",
    unit: "14A",
    trust: 78.2,
    tags: ["Power Borrower"],
    bio: "Serial entrepreneur. I move fast and return things on time.",
  },
  {
    id: uid(13),
    username: "olivia.green",
    display_name: "Olivia Greenfeld",
    unit: "10C",
    trust: 85.3,
    tags: ["Always On Time"],
    bio: "Sustainability consultant. Sharing > buying.",
  },
  {
    id: uid(14),
    username: "marcus.dj",
    display_name: "Marcus Williams",
    unit: "1A",
    trust: 90.8,
    tags: ["Gear Guru", "Community Pillar"],
    bio: "DJ + producer. Full studio setup. Building parties welcome.",
  },
  {
    id: uid(15),
    username: "emma.yoga",
    display_name: "Emma Larsson",
    unit: "16B",
    trust: 86.1,
    tags: ["Dispute-Free"],
    bio: "Yoga instructor. Wellness gear, meditation cushions, essential oils.",
  },
  {
    id: uid(16),
    username: "dev_patel",
    display_name: "Dev Patel",
    unit: "13D",
    trust: 52.0,
    tags: [],
    bio: "Software engineer. Mostly here for the Dyson Airwrap.",
  },
  {
    id: uid(17),
    username: "chloe.art",
    display_name: "Chloé Dubois",
    unit: "7A",
    trust: 88.5,
    tags: ["Trusted Lender"],
    bio: "Artist. Projectors, tripods, lighting — borrow anytime.",
  },
  {
    id: uid(18),
    username: "jorge.fixes",
    display_name: "Jorge Ramirez",
    unit: "2A",
    trust: 94.0,
    tags: ["Community Pillar", "Gear Guru", "Always On Time"],
    bio: "Building super (off-duty resident). I can fix anything and lend the tools to do it.",
  },
  {
    id: uid(19),
    username: "ada.games",
    display_name: "Ada Osei",
    unit: "11C",
    trust: 79.8,
    tags: ["Power Borrower"],
    bio: "Game designer. VR headsets, consoles, board games galore.",
  },
  {
    id: uid(20),
    username: "sam.photo",
    display_name: "Sam Reeves",
    unit: "9D",
    trust: 83.7,
    tags: ["Dispute-Free"],
    bio: "Photographer. Lenses, lights, backdrops — the works.",
  },
];

// ============================================================================
// ITEMS (50 items across 8 categories)
// ============================================================================
const items = [
  // --- ELECTRONICS (10) ---
  {
    id: uid(51),
    owner: uid(3),
    title: "DJI Mini 5",
    category: "electronics",
    sub: "drone",
    deposit: 5000,
    meta: {
      brand: "DJI",
      model: "Mini 5",
      year: 2025,
      original_price_cents: 57900,
      color: "Gray",
    },
  },
  {
    id: uid(52),
    owner: uid(1),
    title: "Sony A7C II",
    category: "electronics",
    sub: "camera",
    deposit: 10000,
    meta: {
      brand: "Sony",
      model: "A7C II",
      year: 2024,
      original_price_cents: 219800,
    },
  },
  {
    id: uid(53),
    owner: uid(10),
    title: "Shure SM7dB Microphone",
    category: "electronics",
    sub: "audio",
    deposit: 3000,
    meta: {
      brand: "Shure",
      model: "SM7dB",
      year: 2024,
      original_price_cents: 44900,
    },
  },
  {
    id: uid(54),
    owner: uid(14),
    title: "Pioneer DDJ-FLX10 Controller",
    category: "electronics",
    sub: "dj_equipment",
    deposit: 8000,
    meta: {
      brand: "Pioneer",
      model: "DDJ-FLX10",
      year: 2024,
      original_price_cents: 129900,
    },
  },
  {
    id: uid(55),
    owner: uid(19),
    title: "Meta Quest 3S",
    category: "electronics",
    sub: "vr_headset",
    deposit: 3000,
    meta: {
      brand: "Meta",
      model: "Quest 3S",
      year: 2025,
      original_price_cents: 29999,
    },
  },
  {
    id: uid(56),
    owner: uid(1),
    title: "Apple Vision Pro",
    category: "electronics",
    sub: "vr_headset",
    deposit: 15000,
    meta: {
      brand: "Apple",
      model: "Vision Pro",
      year: 2024,
      original_price_cents: 349900,
    },
  },
  {
    id: uid(57),
    owner: uid(3),
    title: "Fujifilm Instax Mini Evo",
    category: "electronics",
    sub: "camera",
    deposit: 2000,
    meta: {
      brand: "Fujifilm",
      model: "Instax Mini Evo",
      year: 2024,
      original_price_cents: 19995,
    },
  },
  {
    id: uid(58),
    owner: uid(20),
    title: "Profoto B10X Plus",
    category: "electronics",
    sub: "lighting",
    deposit: 7000,
    meta: {
      brand: "Profoto",
      model: "B10X Plus",
      year: 2023,
      original_price_cents: 209900,
    },
  },
  {
    id: uid(59),
    owner: uid(10),
    title: "Rode Wireless PRO",
    category: "electronics",
    sub: "audio",
    deposit: 2500,
    meta: {
      brand: "Rode",
      model: "Wireless PRO",
      year: 2024,
      original_price_cents: 39900,
    },
  },
  {
    id: uid(60),
    owner: uid(14),
    title: "Teenage Engineering EP-133",
    category: "electronics",
    sub: "music",
    deposit: 2000,
    meta: {
      brand: "Teenage Engineering",
      model: "EP-133",
      year: 2024,
      original_price_cents: 29900,
    },
  },

  // --- KITCHEN (8) ---
  {
    id: uid(61),
    owner: uid(2),
    title: "Dyson Airwrap Complete Long",
    category: "beauty",
    sub: "hair_styling",
    deposit: 4000,
    meta: {
      brand: "Dyson",
      model: "Airwrap Complete Long",
      year: 2024,
      original_price_cents: 59999,
    },
  },
  {
    id: uid(62),
    owner: uid(11),
    title: "KitchenAid Artisan Mixer",
    category: "kitchen",
    sub: "appliance",
    deposit: 3000,
    meta: {
      brand: "KitchenAid",
      model: "Artisan 5qt",
      color: "Empire Red",
      original_price_cents: 37999,
    },
  },
  {
    id: uid(63),
    owner: uid(2),
    title: "Breville Barista Express",
    category: "kitchen",
    sub: "coffee",
    deposit: 4000,
    meta: {
      brand: "Breville",
      model: "Barista Express Impress",
      year: 2024,
      original_price_cents: 74995,
    },
  },
  {
    id: uid(64),
    owner: uid(11),
    title: "Vitamix A3500",
    category: "kitchen",
    sub: "appliance",
    deposit: 3500,
    meta: {
      brand: "Vitamix",
      model: "A3500",
      year: 2023,
      original_price_cents: 62995,
    },
  },
  {
    id: uid(65),
    owner: uid(2),
    title: "Ooni Koda 16 Pizza Oven",
    category: "kitchen",
    sub: "outdoor_cooking",
    deposit: 3000,
    meta: {
      brand: "Ooni",
      model: "Koda 16",
      year: 2024,
      original_price_cents: 59900,
    },
  },
  {
    id: uid(66),
    owner: uid(11),
    title: "Le Creuset Dutch Oven 7.25qt",
    category: "kitchen",
    sub: "cookware",
    deposit: 2000,
    meta: {
      brand: "Le Creuset",
      model: "Round Dutch Oven",
      color: "Marseille",
      original_price_cents: 41000,
    },
  },
  {
    id: uid(67),
    owner: uid(9),
    title: "Staub Cocotte 5.5qt",
    category: "kitchen",
    sub: "cookware",
    deposit: 1500,
    meta: {
      brand: "Staub",
      model: "Round Cocotte",
      color: "Cherry",
      original_price_cents: 37500,
    },
  },
  {
    id: uid(68),
    owner: uid(13),
    title: "Fellow Ode Gen 2 Grinder",
    category: "kitchen",
    sub: "coffee",
    deposit: 1500,
    meta: {
      brand: "Fellow",
      model: "Ode Gen 2",
      year: 2024,
      original_price_cents: 34500,
    },
  },

  // --- OUTDOOR & SPORTS (8) ---
  {
    id: uid(69),
    owner: uid(6),
    title: "Solo Stove Bonfire 2.0",
    category: "outdoor",
    sub: "fire_pit",
    deposit: 2500,
    meta: {
      brand: "Solo Stove",
      model: "Bonfire 2.0",
      year: 2024,
      original_price_cents: 34999,
    },
  },
  {
    id: uid(70),
    owner: uid(6),
    title: "REI Co-op Half Dome 2 Plus",
    category: "outdoor",
    sub: "tent",
    deposit: 2000,
    meta: {
      brand: "REI",
      model: "Half Dome 2 Plus",
      year: 2024,
      original_price_cents: 22900,
    },
  },
  {
    id: uid(71),
    owner: uid(6),
    title: "YETI Tundra 45 Cooler",
    category: "outdoor",
    sub: "cooler",
    deposit: 1500,
    meta: {
      brand: "YETI",
      model: "Tundra 45",
      color: "Charcoal",
      original_price_cents: 32500,
    },
  },
  {
    id: uid(72),
    owner: uid(8),
    title: "Peloton Bike+",
    category: "sports",
    sub: "cycling",
    deposit: 8000,
    meta: {
      brand: "Peloton",
      model: "Bike+",
      year: 2024,
      original_price_cents: 249500,
    },
  },
  {
    id: uid(73),
    owner: uid(8),
    title: "Hyperice Hypervolt 2 Pro",
    category: "sports",
    sub: "recovery",
    deposit: 1500,
    meta: {
      brand: "Hyperice",
      model: "Hypervolt 2 Pro",
      year: 2024,
      original_price_cents: 32900,
    },
  },
  {
    id: uid(74),
    owner: uid(6),
    title: "Oru Kayak Inlet",
    category: "outdoor",
    sub: "watersport",
    deposit: 3000,
    meta: {
      brand: "Oru",
      model: "Inlet",
      year: 2024,
      original_price_cents: 59900,
    },
  },
  {
    id: uid(75),
    owner: uid(8),
    title: "TRX Pro4 Suspension Kit",
    category: "sports",
    sub: "fitness",
    deposit: 1000,
    meta: {
      brand: "TRX",
      model: "Pro4",
      year: 2024,
      original_price_cents: 24995,
    },
  },
  {
    id: uid(76),
    owner: uid(15),
    title: "Manduka PRO Yoga Mat",
    category: "sports",
    sub: "yoga",
    deposit: 500,
    meta: {
      brand: "Manduka",
      model: 'PRO 85"',
      color: "Black Sage",
      original_price_cents: 13600,
    },
  },

  // --- TOOLS (6) ---
  {
    id: uid(77),
    owner: uid(18),
    title: "DeWalt 20V MAX Drill Kit",
    category: "tools",
    sub: "power_tools",
    deposit: 1500,
    meta: {
      brand: "DeWalt",
      model: "DCD791D2",
      year: 2024,
      original_price_cents: 16900,
    },
  },
  {
    id: uid(78),
    owner: uid(5),
    title: "Festool Track Saw TS 55",
    category: "tools",
    sub: "power_tools",
    deposit: 4000,
    meta: {
      brand: "Festool",
      model: "TS 55 REQ",
      year: 2023,
      original_price_cents: 61500,
    },
  },
  {
    id: uid(79),
    owner: uid(18),
    title: "Milwaukee M18 Impact Driver",
    category: "tools",
    sub: "power_tools",
    deposit: 1200,
    meta: {
      brand: "Milwaukee",
      model: "M18 FUEL",
      year: 2024,
      original_price_cents: 14900,
    },
  },
  {
    id: uid(80),
    owner: uid(5),
    title: "Bosch Laser Level GLL 3-330",
    category: "tools",
    sub: "measuring",
    deposit: 2000,
    meta: {
      brand: "Bosch",
      model: "GLL 3-330CG",
      year: 2024,
      original_price_cents: 37900,
    },
  },
  {
    id: uid(81),
    owner: uid(18),
    title: "Ryobi 40V Leaf Blower",
    category: "tools",
    sub: "outdoor_power",
    deposit: 1000,
    meta: {
      brand: "Ryobi",
      model: "RY404015",
      year: 2024,
      original_price_cents: 22900,
    },
  },
  {
    id: uid(82),
    owner: uid(5),
    title: "Dremel 4300 Rotary Tool Kit",
    category: "tools",
    sub: "rotary_tools",
    deposit: 800,
    meta: {
      brand: "Dremel",
      model: "4300-5/40",
      year: 2024,
      original_price_cents: 9900,
    },
  },

  // --- ENTERTAINMENT (5) ---
  {
    id: uid(83),
    owner: uid(19),
    title: "Nintendo Switch OLED",
    category: "entertainment",
    sub: "console",
    deposit: 2000,
    meta: {
      brand: "Nintendo",
      model: "Switch OLED",
      color: "White",
      original_price_cents: 34999,
    },
  },
  {
    id: uid(84),
    owner: uid(14),
    title: "Sonos Era 300 (pair)",
    category: "entertainment",
    sub: "speakers",
    deposit: 3000,
    meta: {
      brand: "Sonos",
      model: "Era 300",
      year: 2024,
      original_price_cents: 89800,
    },
  },
  {
    id: uid(85),
    owner: uid(19),
    title: "Settlers of Catan + Expansions",
    category: "entertainment",
    sub: "board_games",
    deposit: 300,
    meta: {
      brand: "Catan Studio",
      contents: "Base + Seafarers + Cities & Knights",
    },
  },
  {
    id: uid(86),
    owner: uid(17),
    title: "Epson EpiqVision Mini EF12",
    category: "entertainment",
    sub: "projector",
    deposit: 3500,
    meta: {
      brand: "Epson",
      model: "EF12",
      year: 2024,
      original_price_cents: 79999,
    },
  },
  {
    id: uid(87),
    owner: uid(20),
    title: "Canon PIXMA Pro-200",
    category: "entertainment",
    sub: "printer",
    deposit: 2000,
    meta: {
      brand: "Canon",
      model: "PIXMA Pro-200",
      year: 2023,
      original_price_cents: 59999,
    },
  },

  // --- HOME & WELLNESS (6) ---
  {
    id: uid(88),
    owner: uid(15),
    title: "Dyson V15 Detect",
    category: "home",
    sub: "vacuum",
    deposit: 3000,
    meta: {
      brand: "Dyson",
      model: "V15 Detect Absolute",
      year: 2024,
      original_price_cents: 74999,
    },
  },
  {
    id: uid(89),
    owner: uid(13),
    title: "iRobot Roomba j9+",
    category: "home",
    sub: "vacuum",
    deposit: 3500,
    meta: {
      brand: "iRobot",
      model: "Roomba j9+",
      year: 2024,
      original_price_cents: 89999,
    },
  },
  {
    id: uid(90),
    owner: uid(15),
    title: "Theragun PRO Plus",
    category: "wellness",
    sub: "recovery",
    deposit: 2000,
    meta: {
      brand: "Therabody",
      model: "Theragun PRO Plus",
      year: 2024,
      original_price_cents: 49900,
    },
  },
  {
    id: uid(91),
    owner: uid(9),
    title: "Kindle Scribe 64GB",
    category: "home",
    sub: "reading",
    deposit: 1500,
    meta: {
      brand: "Amazon",
      model: "Kindle Scribe",
      year: 2024,
      original_price_cents: 39999,
    },
  },
  {
    id: uid(92),
    owner: uid(13),
    title: "Blueair Classic 480i",
    category: "home",
    sub: "air_purifier",
    deposit: 2500,
    meta: {
      brand: "Blueair",
      model: "Classic 480i",
      year: 2024,
      original_price_cents: 64999,
    },
  },
  {
    id: uid(93),
    owner: uid(17),
    title: "Nanoleaf Shapes Hexagons 15pk",
    category: "home",
    sub: "lighting",
    deposit: 1500,
    meta: {
      brand: "Nanoleaf",
      model: "Shapes Hexagons",
      year: 2024,
      original_price_cents: 29999,
    },
  },

  // --- TRAVEL (4) ---
  {
    id: uid(94),
    owner: uid(3),
    title: "Rimowa Original Cabin",
    category: "travel",
    sub: "luggage",
    deposit: 5000,
    meta: {
      brand: "Rimowa",
      model: "Original Cabin",
      color: "Silver",
      original_price_cents: 128000,
    },
  },
  {
    id: uid(95),
    owner: uid(12),
    title: "Peak Design Travel Backpack 45L",
    category: "travel",
    sub: "backpack",
    deposit: 1500,
    meta: {
      brand: "Peak Design",
      model: "Travel Backpack 45L",
      color: "Sage",
      original_price_cents: 29995,
    },
  },
  {
    id: uid(96),
    owner: uid(6),
    title: "Garmin inReach Mini 2",
    category: "travel",
    sub: "safety",
    deposit: 2000,
    meta: {
      brand: "Garmin",
      model: "inReach Mini 2",
      year: 2024,
      original_price_cents: 39999,
    },
  },
  {
    id: uid(97),
    owner: uid(12),
    title: "DJI Osmo Pocket 3",
    category: "travel",
    sub: "camera",
    deposit: 3000,
    meta: {
      brand: "DJI",
      model: "Osmo Pocket 3",
      year: 2024,
      original_price_cents: 51900,
    },
  },

  // --- ART & CREATIVE (3) ---
  {
    id: uid(98),
    owner: uid(17),
    title: "Cricut Maker 3",
    category: "creative",
    sub: "crafting",
    deposit: 2000,
    meta: {
      brand: "Cricut",
      model: "Maker 3",
      year: 2024,
      original_price_cents: 39999,
    },
  },
  {
    id: uid(99),
    owner: uid(17),
    title: 'iPad Pro 13" M4 + Apple Pencil Pro',
    category: "creative",
    sub: "digital_art",
    deposit: 6000,
    meta: {
      brand: "Apple",
      model: 'iPad Pro 13" M4',
      year: 2024,
      original_price_cents: 179900,
    },
  },
  {
    id: uid(100),
    owner: uid(20),
    title: "Godox AD600 Pro",
    category: "creative",
    sub: "lighting",
    deposit: 4000,
    meta: {
      brand: "Godox",
      model: "AD600Pro",
      year: 2024,
      original_price_cents: 74900,
    },
  },
];

// ============================================================================
// TRANSACTIONS (80 realistic historical transactions)
// ============================================================================
function generateTransactions() {
  const states: Array<{ state: string; weight: number }> = [
    { state: "returned", weight: 50 },
    { state: "picked_up", weight: 15 },
    { state: "approved", weight: 8 },
    { state: "requested", weight: 10 },
    { state: "disputed", weight: 5 },
    { state: "resolved", weight: 12 },
  ];

  const transactions = [];
  const borrowers = [
    uid(4),
    uid(7),
    uid(12),
    uid(16),
    uid(19),
    uid(9),
    uid(13),
    uid(15),
  ];
  let txCount = 0;

  for (const item of items) {
    // Each item gets 1-3 transactions
    const numTx = 1 + Math.floor(Math.random() * 3);
    for (let t = 0; t < numTx && txCount < 80; t++) {
      const borrower = borrowers[txCount % borrowers.length];
      if (borrower === item.owner) continue; // can't borrow own item

      const stateRoll = Math.random() * 100;
      let cumulative = 0;
      let state = "returned";
      for (const s of states) {
        cumulative += s.weight;
        if (stateRoll <= cumulative) {
          state = s.state;
          break;
        }
      }

      const daysAgo = Math.floor(Math.random() * 180);
      const requestedAt = new Date(Date.now() - daysAgo * 86400000);

      transactions.push({
        id: uid(200 + txCount),
        item_id: item.id,
        borrower_id: borrower,
        owner_id: item.owner,
        building_id: BUILDING_ID,
        state,
        requested_at: requestedAt.toISOString(),
        approved_at:
          state !== "requested"
            ? new Date(requestedAt.getTime() + 3600000).toISOString()
            : null,
        picked_up_at: [
          "picked_up",
          "returned",
          "disputed",
          "resolved",
        ].includes(state)
          ? new Date(requestedAt.getTime() + 86400000).toISOString()
          : null,
        returned_at: ["returned", "resolved"].includes(state)
          ? new Date(requestedAt.getTime() + 5 * 86400000).toISOString()
          : null,
        due_at:
          state !== "requested"
            ? new Date(requestedAt.getTime() + 7 * 86400000).toISOString()
            : null,
        deposit_held: item.deposit,
        notes: null,
      });

      txCount++;
    }
  }

  return transactions;
}

// ============================================================================
// TRUST EVENTS
// ============================================================================
const trustEvents = [
  {
    profile_id: uid(1),
    event: "lend_complete",
    delta: 3.0,
    note: "Lent Sony A7C II successfully",
  },
  {
    profile_id: uid(4),
    event: "borrow_complete",
    delta: 2.0,
    note: "Returned DJI Mini 5 on time",
  },
  {
    profile_id: uid(3),
    event: "lend_complete",
    delta: 3.0,
    note: "Lent Rimowa Original Cabin",
  },
  {
    profile_id: uid(7),
    event: "borrow_complete",
    delta: 2.0,
    note: "First borrow — welcome!",
  },
  {
    profile_id: uid(6),
    event: "lend_complete",
    delta: 3.0,
    note: "Lent Solo Stove Bonfire",
  },
  {
    profile_id: uid(16),
    event: "dispute_lost",
    delta: -5.0,
    note: "Returned Dyson Airwrap with cracked attachment",
  },
  {
    profile_id: uid(9),
    event: "vouched",
    delta: 1.0,
    note: "Vouched for by maya_chen",
  },
  {
    profile_id: uid(18),
    event: "lend_complete",
    delta: 3.0,
    note: "Lent DeWalt drill kit — 5th time!",
  },
  {
    profile_id: uid(12),
    event: "borrow_complete",
    delta: 2.0,
    note: "Returned Peak Design bag early",
  },
  {
    profile_id: uid(2),
    event: "lend_complete",
    delta: 3.0,
    note: "Lent Breville espresso machine",
  },
  {
    profile_id: uid(11),
    event: "lend_complete",
    delta: 3.0,
    note: "Lent Vitamix A3500",
  },
  {
    profile_id: uid(14),
    event: "lend_complete",
    delta: 3.0,
    note: "Lent Pioneer DDJ-FLX10",
  },
  {
    profile_id: uid(13),
    event: "borrow_complete",
    delta: 2.0,
    note: "Returned Roomba cleaned and docked",
  },
  {
    profile_id: uid(5),
    event: "lend_complete",
    delta: 3.0,
    note: "Lent Festool track saw",
  },
  {
    profile_id: uid(8),
    event: "vouched",
    delta: 1.0,
    note: "Vouched for by dex_outdoors",
  },
];

// ============================================================================
// SEEDER EXECUTION
// ============================================================================
async function seed() {
  console.log("🏗️  Seeding The Meridian...\n");

  // 1. Building
  console.log("  → Building...");
  const { error: bErr } = await supabase.from("buildings").upsert(building);
  if (bErr) console.error("    ✗ Building:", bErr.message);
  else console.log("    ✓ The Meridian created");

  // 2. Profiles
  console.log("  → Profiles...");
  for (const p of profiles) {
    const { error } = await supabase.from("profiles").upsert({
      id: p.id,
      username: p.username,
      display_name: p.display_name,
      building_id: BUILDING_ID,
      unit_number: p.unit,
      trust_score: p.trust,
      reputation_tags: p.tags,
      bio: p.bio,
      onboarded_at: new Date(
        Date.now() - Math.random() * 365 * 86400000,
      ).toISOString(),
    });
    if (error) console.error(`    ✗ ${p.username}:`, error.message);
  }
  console.log(`    ✓ ${profiles.length} residents seeded`);

  // 3. Items
  console.log("  → Items...");
  for (const item of items) {
    const { error } = await supabase.from("items").upsert({
      id: item.id,
      owner_id: item.owner,
      building_id: BUILDING_ID,
      title: item.title,
      category: item.category,
      subcategory: item.sub,
      metadata: item.meta,
      deposit_cents: item.deposit,
      status: "available",
    });
    if (error) console.error(`    ✗ ${item.title}:`, error.message);
  }
  console.log(`    ✓ ${items.length} items seeded`);

  // 4. Transactions
  console.log("  → Transactions...");
  const transactions = generateTransactions();
  for (const tx of transactions) {
    const { error } = await supabase.from("transactions").upsert(tx);
    if (error) console.error(`    ✗ tx ${tx.id}:`, error.message);
  }
  console.log(`    ✓ ${transactions.length} transactions seeded`);

  // 5. Trust events
  console.log("  → Trust events...");
  for (const te of trustEvents) {
    const { error } = await supabase.from("trust_events").insert(te);
    if (error) console.error(`    ✗ trust:`, error.message);
  }
  console.log(`    ✓ ${trustEvents.length} trust events seeded`);

  console.log("\n✅ Seed complete! The Meridian is alive.\n");
}

seed().catch(console.error);
