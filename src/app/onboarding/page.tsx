"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Building = {
  id: string;
  name: string;
  address?: string;
  resident_count?: number;
};

const STEPS = ["Welcome", "Building", "Your Info", "You\u2019re in!"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Building step
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [buildingSearch, setBuildingSearch] = useState("");
  const [selectedBuilding, setSelectedBuilding] = useState<Building | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);
  const [newBuildingName, setNewBuildingName] = useState("");
  const [newBuildingAddress, setNewBuildingAddress] = useState("");

  // Profile step
  const [form, setForm] = useState({
    display_name: "",
    username: "",
    unit_number: "",
    bio: "",
  });

  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth");
        return;
      }
      setUserId(user.id);

      // Pre-fill from existing profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, username, unit_number, bio, building_id")
        .eq("id", user.id)
        .single();

      if (profile) {
        setForm({
          display_name: profile.display_name ?? "",
          username: profile.username ?? "",
          unit_number: profile.unit_number ?? "",
          bio: profile.bio ?? "",
        });
        // If already fully onboarded, skip to dashboard
        if (profile.display_name && profile.unit_number && profile.building_id) {
          router.push("/dashboard");
        }
      }

      // Fetch existing buildings
      const { data: buildingList } = await supabase
        .from("buildings")
        .select("id, name, resident_count")
        .order("name");

      setBuildings(buildingList ?? []);
    };
    load();
  }, []);

  // Filter buildings by search
  const filteredBuildings = useMemo(() => {
    if (!buildingSearch.trim()) return buildings;
    const q = buildingSearch.toLowerCase();
    return buildings.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.address?.toLowerCase().includes(q)
    );
  }, [buildings, buildingSearch]);

  // Join existing building
  const handleJoinBuilding = async () => {
    if (!userId || !selectedBuilding) return;
    setSaving(true);

    await supabase
      .from("profiles")
      .update({ building_id: selectedBuilding.id })
      .eq("id", userId);

    // Increment resident count
    await supabase.rpc("increment_resident_count", {
      p_building_id: selectedBuilding.id,
    }).catch(() => {
      // RPC might not exist yet — ignore
    });

    setSaving(false);
    setStep(2);
  };

  // Create new building + join
  const handleCreateBuilding = async () => {
    if (!userId || !newBuildingName.trim()) return;
    setSaving(true);

    const { data: newBuilding, error } = await supabase
      .from("buildings")
      .insert({
        name: newBuildingName.trim(),
        resident_count: 1,
      })
      .select("id, name")
      .single();

    if (!error && newBuilding) {
      await supabase
        .from("profiles")
        .update({ building_id: newBuilding.id })
        .eq("id", userId);

      setSelectedBuilding(newBuilding);
    }

    setSaving(false);
    setStep(2);
  };

  // Save profile
  const handleSaveProfile = async () => {
    if (!userId || !form.display_name || !form.unit_number) return;
    setSaving(true);

    const username =
      form.username ||
      form.display_name.toLowerCase().replace(/\s+/g, ".") +
        Math.floor(Math.random() * 99);

    await supabase.from("profiles").upsert({
      id: userId,
      display_name: form.display_name,
      username,
      unit_number: form.unit_number,
      bio: form.bio,
      onboarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    setSaving(false);
    setStep(3);
  };

  const isProfileValid = form.display_name.trim().length > 0;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-white via-inventory-50 to-orange-50/30">
      <div className="w-full max-w-sm">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  i < step
                    ? "bg-trust-high text-white"
                    : i === step
                      ? "bg-accent text-white scale-110"
                      : "bg-inventory-200 text-inventory-400"
                }`}
              >
                {i < step ? "\u2713" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-6 h-0.5 rounded-full transition-all ${
                    i < step ? "bg-trust-high" : "bg-inventory-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        <div className="glass rounded-3xl p-7 shadow-xl border border-inventory-100">
          {/* ═══════════════════════════════════════════════════════════
              STEP 0 — Welcome
              ═══════════════════════════════════════════════════════ */}
          {step === 0 && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-5">
                <span className="font-display font-black text-white text-2xl">
                  P
                </span>
              </div>
              <h1 className="font-display font-bold text-2xl mb-3">
                Welcome to Proxe 👋
              </h1>
              <p className="text-inventory-500 text-sm leading-relaxed mb-8">
                Join your building&apos;s sharing community. Borrow what you
                need, lend what you have.
              </p>
              <div className="space-y-3 text-left mb-8">
                {[
                  ["🔒", "Deposits protect lenders"],
                  ["⭐", "Trust scores build over time"],
                  ["🤝", "Your neighbors are vetted"],
                  ["🤖", "Miles AI finds what you need"],
                ].map(([icon, text]) => (
                  <div
                    key={text}
                    className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-inventory-50"
                  >
                    <span className="text-lg">{icon}</span>
                    <p className="text-sm text-inventory-600 font-medium">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep(1)}
                className="w-full py-3.5 bg-accent text-white rounded-2xl font-display font-bold text-sm hover:bg-accent-dark transition-colors"
              >
                Get Started →
              </button>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              STEP 1 — Building Selection
              ═══════════════════════════════════════════════════════ */}
          {step === 1 && !creatingNew && (
            <div>
              {/* Hero illustration area */}
              <div className="relative w-full h-36 rounded-2xl overflow-hidden bg-gradient-to-br from-accent/10 via-inventory-50 to-emerald-50 mb-6 flex items-center justify-center">
                <div className="text-center">
                  <span className="text-5xl block mb-2">🏢</span>
                  <p className="text-xs text-inventory-400">
                    {buildings.length} building{buildings.length !== 1 ? "s" : ""} on Proxe
                  </p>
                </div>
              </div>

              <h2 className="font-display font-bold text-xl mb-1">
                Which building do you live in?
              </h2>
              <p className="text-inventory-400 text-sm mb-5">
                Connect with neighbors and discover shared resources.
              </p>

              {/* Search */}
              <div className="relative mb-3">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-inventory-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={buildingSearch}
                  onChange={(e) => {
                    setBuildingSearch(e.target.value);
                    setSelectedBuilding(null);
                  }}
                  placeholder="Search for your building..."
                  className="w-full pl-10 pr-4 py-3.5 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm transition-colors"
                  autoFocus
                />
              </div>

              {/* Building list */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 mb-4">
                {filteredBuildings.length > 0 ? (
                  filteredBuildings.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setSelectedBuilding(b)}
                      className={`w-full text-left p-3.5 rounded-2xl flex items-center justify-between transition-all ${
                        selectedBuilding?.id === b.id
                          ? "bg-accent/10 border-2 border-accent ring-1 ring-accent/20"
                          : "bg-inventory-50 border-2 border-transparent hover:border-inventory-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                            selectedBuilding?.id === b.id
                              ? "bg-accent text-white"
                              : "bg-inventory-100 text-inventory-500"
                          }`}
                        >
                          <span className="text-sm">🏢</span>
                        </div>
                        <div>
                          <p className="font-display font-bold text-sm">
                            {b.name}
                          </p>
                          {b.resident_count ? (
                            <p className="text-[10px] text-inventory-400">
                              {b.resident_count} resident{b.resident_count !== 1 ? "s" : ""} sharing
                            </p>
                          ) : null}
                        </div>
                      </div>
                      {selectedBuilding?.id === b.id && (
                        <span className="text-accent text-lg">✓</span>
                      )}
                    </button>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <span className="text-3xl block mb-2">🔍</span>
                    <p className="text-sm text-inventory-400">
                      No buildings match &ldquo;{buildingSearch}&rdquo;
                    </p>
                  </div>
                )}
              </div>

              {/* Join button */}
              <button
                onClick={handleJoinBuilding}
                disabled={!selectedBuilding || saving}
                className="w-full py-3.5 bg-accent text-white rounded-2xl font-display font-bold text-sm hover:bg-accent-dark transition-colors disabled:opacity-40 flex items-center justify-center gap-2 mb-3"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Joining...
                  </>
                ) : selectedBuilding ? (
                  `Join ${selectedBuilding.name} →`
                ) : (
                  "Select your building"
                )}
              </button>

              {/* Create new */}
              <button
                onClick={() => setCreatingNew(true)}
                className="w-full py-2.5 text-inventory-500 font-display font-semibold text-xs hover:text-accent transition-colors"
              >
                Don&apos;t see your building? Add it →
              </button>

              {/* Miles tip */}
              <div className="mt-4 p-4 rounded-2xl bg-gradient-to-br from-purple-50/50 via-inventory-50/30 to-emerald-50/30">
                <div className="flex gap-3 items-start">
                  <div className="w-8 h-8 rounded-xl bg-white shadow-sm flex items-center justify-center flex-shrink-0">
                    <span className="text-sm">🤖</span>
                  </div>
                  <div>
                    <p className="font-display font-bold text-xs text-inventory-700">
                      Miles AI Tip
                    </p>
                    <p className="text-[11px] text-inventory-500 mt-0.5 leading-relaxed">
                      Joining your building unlocks the sharing marketplace.
                      Borrow a drill, lend a projector, build trust with your
                      neighbors.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              STEP 1b — Create New Building
              ═══════════════════════════════════════════════════════ */}
          {step === 1 && creatingNew && (
            <div>
              <button
                onClick={() => setCreatingNew(false)}
                className="flex items-center gap-1 text-inventory-500 text-sm mb-4 hover:text-accent transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to building list
              </button>

              <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🏗️</span>
              </div>

              <h2 className="font-display font-bold text-xl text-center mb-1">
                Add your building
              </h2>
              <p className="text-inventory-400 text-sm text-center mb-6">
                You&apos;ll be the first resident on Proxe!
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                    Building Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newBuildingName}
                    onChange={(e) => setNewBuildingName(e.target.value)}
                    placeholder="e.g. The Meridian, Parkview Apartments"
                    className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm transition-colors"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                    Address <span className="text-inventory-300">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={newBuildingAddress}
                    onChange={(e) => setNewBuildingAddress(e.target.value)}
                    placeholder="123 Main St, Mountain View, CA"
                    className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm transition-colors"
                  />
                </div>

                <button
                  onClick={handleCreateBuilding}
                  disabled={!newBuildingName.trim() || saving}
                  className="w-full py-3.5 bg-accent text-white rounded-2xl font-display font-bold text-sm hover:bg-accent-dark transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : (
                    `Create ${newBuildingName.trim() || "Building"} →`
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              STEP 2 — Profile Info
              ═══════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div>
              <h2 className="font-display font-bold text-xl mb-1">
                Set up your profile
              </h2>
              <p className="text-inventory-400 text-sm mb-6">
                Your neighbors at{" "}
                <strong>{selectedBuilding?.name ?? "your building"}</strong> will
                see this
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.display_name}
                    onChange={(e) =>
                      setForm({ ...form, display_name: e.target.value })
                    }
                    placeholder="Jane Smith"
                    className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm transition-colors"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                    Unit Number <span className="text-inventory-300">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={form.unit_number}
                    onChange={(e) =>
                      setForm({ ...form, unit_number: e.target.value })
                    }
                    placeholder="e.g. 4B"
                    className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                    Username{" "}
                    <span className="text-inventory-300">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-inventory-400 text-sm">
                      @
                    </span>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          username: e.target.value
                            .toLowerCase()
                            .replace(/\s/g, ""),
                        })
                      }
                      placeholder="jane.smith"
                      className="w-full pl-8 pr-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                    Bio <span className="text-inventory-300">(optional)</span>
                  </label>
                  <textarea
                    value={form.bio}
                    onChange={(e) =>
                      setForm({ ...form, bio: e.target.value })
                    }
                    rows={2}
                    placeholder="Hey neighbors! I'm on the 4th floor..."
                    className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm resize-none transition-colors"
                  />
                </div>

                <button
                  onClick={handleSaveProfile}
                  disabled={saving || !isProfileValid}
                  className="w-full py-3.5 bg-accent text-white rounded-2xl font-display font-bold text-sm hover:bg-accent-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save & Continue →"
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════
              STEP 3 — Done!
              ═══════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-trust-high/10 flex items-center justify-center mx-auto mb-5">
                <span className="text-4xl">🎉</span>
              </div>
              <h2 className="font-display font-bold text-2xl mb-2">
                You&apos;re all set!
              </h2>
              <p className="text-inventory-500 text-sm mb-2">
                Welcome to{" "}
                <strong>
                  {selectedBuilding?.name ?? "your building"}
                </strong>
                , <strong>{form.display_name.split(" ")[0]}</strong>!
              </p>
              <p className="text-inventory-400 text-xs mb-8">
                Unit {form.unit_number} · Trust score starts at 50
              </p>
              <button
                onClick={() => router.push("/dashboard")}
                className="w-full py-3.5 bg-accent text-white rounded-2xl font-display font-bold text-sm hover:bg-accent-dark transition-colors"
              >
                Explore Your Building →
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-inventory-400 mt-6">
          Proxe \u00B7 Your Building&apos;s Sharing Platform
        </p>
      </div>
    </main>
  );
}
