"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  unit_number: string;
  trust_score: number;
  reputation_tags: string[];
  bio: string | null;
  created_at: string;
};

export default function MyProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    display_name: "",
    username: "",
    unit_number: "",
    bio: "",
  });
  const supabase = createClient();

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    setUploadingAvatar(true);

    try {
      const ext = file.name.split(".").pop();
      const path = `avatars/${profile.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(path);

      await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);
      setAvatarUrl(publicUrl);
      setProfile({ ...profile, avatar_url: publicUrl });
    } catch (err) {
      console.error("Avatar upload error:", err);
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (data) {
        setProfile(data);
        setAvatarUrl(data.avatar_url);
        setForm({
          display_name: data.display_name ?? "",
          username: data.username ?? "",
          unit_number: data.unit_number ?? "",
          bio: data.bio ?? "",
        });
      }
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq("id", profile.id);

    if (!error) {
      setSaved(true);
      setProfile({ ...profile, ...form });
      setTimeout(() => setSaved(false), 2500);
    }
    setSaving(false);
  };

  if (loading)
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
      </main>
    );

  if (!profile) return null;

  const trustLevel =
    profile.trust_score >= 85
      ? "high"
      : profile.trust_score >= 60
        ? "medium"
        : "low";
  const trustColors = {
    high: "text-trust-high bg-trust-high/10",
    medium: "text-trust-medium bg-trust-medium/10",
    low: "text-inventory-500 bg-inventory-100",
  };
  const trustLabels = {
    high: "Highly Trusted",
    medium: "Good Standing",
    low: "New Member",
  };

  return (
    <main className="min-h-screen pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-inventory-200/50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-inventory-500 hover:text-inventory-900 transition-colors"
          >
            <svg
              className="w-5 h-5"
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
          </Link>
          <h1 className="font-display font-bold text-base flex-1">
            My Profile
          </h1>
          <Link
            href={`/profile/${profile.id}`}
            className="text-sm text-inventory-400 hover:text-accent transition-colors font-medium"
          >
            View public →
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-8 space-y-6">
        {/* Avatar + trust */}
        <div className="glass rounded-3xl p-6 flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-accent/10 flex items-center justify-center overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={form.display_name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="font-display font-black text-3xl text-accent">
                  {form.display_name?.[0] ?? "?"}
                </span>
              )}
            </div>
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center shadow-md hover:bg-accent-dark transition-colors disabled:opacity-50"
            >
              {uploadingAvatar ? (
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              )}
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
          </div>
          <div>
            <p className="font-display font-bold text-lg">
              {form.display_name || "Your Name"}
            </p>
            <p className="text-inventory-400 text-sm">
              @{form.username} · Unit {form.unit_number}
            </p>
            <span
              className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-bold ${trustColors[trustLevel]}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {trustLabels[trustLevel]} · {profile.trust_score.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Edit form */}
        <div className="glass rounded-3xl p-6 space-y-5">
          <h2 className="font-display text-xs font-bold text-inventory-400 uppercase tracking-widest">
            Profile Info
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                Display Name
              </label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) =>
                  setForm({ ...form, display_name: e.target.value })
                }
                className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm transition-colors"
                placeholder="Your full name"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                Username
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
                      username: e.target.value.toLowerCase().replace(/\s/g, ""),
                    })
                  }
                  className="w-full pl-8 pr-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm transition-colors"
                  placeholder="username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                Unit Number
              </label>
              <input
                type="text"
                value={form.unit_number}
                onChange={(e) =>
                  setForm({ ...form, unit_number: e.target.value })
                }
                className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm transition-colors"
                placeholder="e.g. 4B"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                Bio
              </label>
              <textarea
                value={form.bio}
                onChange={(e) => setForm({ ...form, bio: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm resize-none transition-colors"
                placeholder="Tell your neighbors a bit about yourself..."
              />
              <p className="text-xs text-inventory-400 mt-1">
                {form.bio.length}/200 characters
              </p>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3.5 rounded-2xl font-display font-bold text-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              background: saved
                ? "var(--color-trust-high)"
                : "var(--color-accent)",
              color: "white",
            }}
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving...
              </>
            ) : saved ? (
              <>✓ Profile saved!</>
            ) : (
              <>Save Changes</>
            )}
          </button>
        </div>

        {/* Reputation tags (read-only) */}
        {profile.reputation_tags?.length > 0 && (
          <div className="glass rounded-3xl p-6">
            <h2 className="font-display text-xs font-bold text-inventory-400 uppercase tracking-widest mb-4">
              Reputation Tags
            </h2>
            <p className="text-xs text-inventory-400 mb-3">
              Earned from your lending activity
            </p>
            <div className="flex flex-wrap gap-2">
              {profile.reputation_tags.map((tag) => (
                <span
                  key={tag}
                  className="text-sm px-3 py-1.5 rounded-full bg-inventory-100 text-inventory-600 font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Trust score info */}
        <div className="glass rounded-3xl p-6">
          <h2 className="font-display text-xs font-bold text-inventory-400 uppercase tracking-widest mb-4">
            Trust Score
          </h2>
          <div className="flex items-center gap-4 mb-4">
            <div className="text-4xl font-display font-black text-accent">
              {profile.trust_score.toFixed(0)}
            </div>
            <div>
              <p className="font-display font-bold text-sm">
                {trustLabels[trustLevel]}
              </p>
              <p className="text-xs text-inventory-400 mt-0.5">
                Based on your lending history
              </p>
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-inventory-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${profile.trust_score}%` }}
            />
          </div>
          <p className="text-xs text-inventory-400 mt-3">
            Complete more transactions to increase your score.
          </p>
        </div>
      </div>
    </main>
  );
}
