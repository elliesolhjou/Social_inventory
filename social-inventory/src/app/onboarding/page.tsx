"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STEPS = ["Welcome", "Your Info", "You're in!"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState({
    display_name: "",
    username: "",
    unit_number: "",
    bio: "",
  });
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      setUserId(user.id);

      // Pre-fill from existing profile if any
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, username, unit_number, bio")
        .eq("id", user.id)
        .single();

      if (profile) {
        setForm({
          display_name: profile.display_name ?? "",
          username: profile.username ?? "",
          unit_number: profile.unit_number ?? "",
          bio: profile.bio ?? "",
        });
        // If already complete, skip to dashboard
        if (profile.display_name && profile.unit_number) {
          router.push("/dashboard");
        }
      }
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!userId || !form.display_name || !form.unit_number) return;
    setSaving(true);

    // Auto-generate username if empty
    const username = form.username ||
      form.display_name.toLowerCase().replace(/\s+/g, ".") + Math.floor(Math.random() * 99);

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        display_name: form.display_name,
        username,
        unit_number: form.unit_number,
        bio: form.bio,
        onboarded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    setSaving(false);
    if (!error) setStep(2);
  };

  const isFormValid = form.display_name.trim() && form.unit_number.trim();

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-white via-inventory-50 to-orange-50/30">
      <div className="w-full max-w-sm">

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                i < step ? "bg-trust-high text-white" :
                i === step ? "bg-accent text-white" :
                "bg-inventory-200 text-inventory-400"
              }`}>
                {i < step ? "✓" : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 rounded-full transition-all ${i < step ? "bg-trust-high" : "bg-inventory-200"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="glass rounded-3xl p-7 shadow-xl border border-inventory-100">

          {/* Step 0 — Welcome */}
          {step === 0 && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-5">
                <span className="font-display font-black text-white text-2xl">A</span>
              </div>
              <h1 className="font-display font-bold text-2xl mb-3">Welcome to Anbo 👋</h1>
              <p className="text-inventory-500 text-sm leading-relaxed mb-8">
                You're joining <strong>The Meridian</strong>'s sharing community. Borrow what you need, lend what you have.
              </p>
              <div className="space-y-3 text-left mb-8">
                {[
                  ["🔒", "Deposits protect lenders"],
                  ["⭐", "Trust scores build over time"],
                  ["🤝", "Your neighbors are vetted"],
                ].map(([icon, text]) => (
                  <div key={text} className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-inventory-50">
                    <span className="text-lg">{icon}</span>
                    <p className="text-sm text-inventory-600 font-medium">{text}</p>
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

          {/* Step 1 — Profile Info */}
          {step === 1 && (
            <div>
              <h2 className="font-display font-bold text-xl mb-1">Set up your profile</h2>
              <p className="text-inventory-400 text-sm mb-6">Your neighbors will see this info</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                    Full Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    placeholder="Jane Smith"
                    className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm transition-colors"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                    Unit Number <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.unit_number}
                    onChange={(e) => setForm({ ...form, unit_number: e.target.value })}
                    placeholder="e.g. 4B"
                    className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                    Username <span className="text-inventory-300">(optional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-inventory-400 text-sm">@</span>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/\s/g, "") })}
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
                    onChange={(e) => setForm({ ...form, bio: e.target.value })}
                    rows={2}
                    placeholder="Hey neighbors! I'm on the 4th floor..."
                    className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm resize-none transition-colors"
                  />
                </div>

                <button
                  onClick={handleSave}
                  disabled={saving || !isFormValid}
                  className="w-full py-3.5 bg-accent text-white rounded-2xl font-display font-bold text-sm hover:bg-accent-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {saving
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
                    : "Save & Continue →"
                  }
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Done */}
          {step === 2 && (
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-trust-high/10 flex items-center justify-center mx-auto mb-5">
                <span className="text-4xl">🎉</span>
              </div>
              <h2 className="font-display font-bold text-2xl mb-2">You're all set!</h2>
              <p className="text-inventory-500 text-sm mb-2">
                Welcome to The Meridian, <strong>{form.display_name.split(" ")[0]}</strong>!
              </p>
              <p className="text-inventory-400 text-xs mb-8">
                Unit {form.unit_number} · Trust score starts at 70
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
      </div>
    </main>
  );
}
