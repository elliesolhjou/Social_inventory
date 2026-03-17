"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup" | "magic";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);
  const supabase = createClient();

  const handleSocialLogin = async (provider: "google") => {
    setError(null);
    setSocialLoading(provider);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message ?? `Failed to sign in with ${provider}.`);
      setSocialLoading(null);
    }
  };

  const handleSubmit = async () => {
    setError(null);
    setLoading(true);

    try {
      if (mode === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        setMagicSent(true);
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });
        if (error) throw error;
        // After signup → go to onboarding
        router.push("/onboarding");
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        // Check if profile is complete
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("display_name, unit_number")
            .eq("id", user.id)
            .single();
          if (!profile?.display_name || !profile?.unit_number) {
            router.push("/onboarding");
          } else {
            router.push("/dashboard");
          }
        }
      }
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-br from-white via-inventory-50 to-orange-50/30">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-accent flex items-center justify-center">
              <span className="font-display font-black text-white text-lg">
                P
              </span>
            </div>
            <span className="font-display font-bold text-xl tracking-tight">
              Proxe
            </span>
          </Link>
          <p className="text-inventory-400 text-sm mt-2">
            {mode === "signup"
              ? "Create your account"
              : mode === "magic"
                ? "Sign in without a password"
                : "Welcome back"}
          </p>
        </div>

        {/* Card */}
        <div className="glass rounded-3xl p-7 shadow-xl border border-inventory-100">
          {magicSent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-trust-high/10 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl">✉️</span>
              </div>
              <h2 className="font-display font-bold text-lg mb-2">
                Check your email
              </h2>
              <p className="text-inventory-500 text-sm leading-relaxed">
                We sent a magic link to <strong>{email}</strong>. Click it to
                sign in.
              </p>
              <button
                onClick={() => {
                  setMagicSent(false);
                  setMode("signin");
                }}
                className="mt-6 text-sm text-accent font-medium hover:underline"
              >
                Back to sign in
              </button>
            </div>
          ) : (
            <>
              {/* Mode tabs */}
              <div className="flex rounded-2xl bg-inventory-100 p-1 mb-6">
                {(["signin", "signup"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      setMode(m);
                      setError(null);
                    }}
                    className={`flex-1 py-2 rounded-xl text-sm font-display font-semibold transition-all ${
                      mode === m
                        ? "bg-white shadow-sm text-inventory-900"
                        : "text-inventory-500 hover:text-inventory-700"
                    }`}
                  >
                    {m === "signin" ? "Sign In" : "Sign Up"}
                  </button>
                ))}
              </div>

              {/* Social login buttons */}
              <div className="space-y-3 mb-5">
                <button
                  onClick={() => handleSocialLogin("google")}
                  disabled={!!socialLoading}
                  className="w-full py-3 rounded-2xl border-2 border-inventory-200 text-inventory-700 font-display font-semibold text-sm hover:border-inventory-300 hover:bg-inventory-50 transition-colors flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {socialLoading === "google" ? (
                    <div className="w-4 h-4 border-2 border-inventory-300 border-t-inventory-600 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      />
                    </svg>
                  )}
                  Continue with Google
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-5">
                <div className="flex-1 h-px bg-inventory-200" />
                <span className="text-xs text-inventory-400">
                  or continue with email
                </span>
                <div className="flex-1 h-px bg-inventory-200" />
              </div>

              <div className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm transition-colors"
                    autoComplete="email"
                  />
                </div>

                {/* Password — only for signin/signup */}
                {mode !== "magic" && (
                  <div>
                    <label className="block text-xs font-bold text-inventory-500 mb-1.5">
                      Password
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder={
                        mode === "signup"
                          ? "Create a password (min 6 chars)"
                          : "Your password"
                      }
                      className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm transition-colors"
                      autoComplete={
                        mode === "signup" ? "new-password" : "current-password"
                      }
                    />
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="flex items-start gap-2 px-4 py-3 rounded-2xl bg-red-50 border border-red-100">
                    <span className="text-red-500 text-xs mt-0.5">⚠</span>
                    <p className="text-red-600 text-xs leading-relaxed">
                      {error}
                    </p>
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={
                    loading || !email || (mode !== "magic" && !password)
                  }
                  className="w-full py-3.5 bg-accent text-white rounded-2xl font-display font-bold text-sm hover:bg-accent-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Loading...
                    </>
                  ) : mode === "signin" ? (
                    "Sign In"
                  ) : mode === "signup" ? (
                    "Create Account"
                  ) : (
                    "Send Magic Link"
                  )}
                </button>

                {/* Magic link toggle */}
                <button
                  onClick={() => {
                    setMode(mode === "magic" ? "signin" : "magic");
                    setError(null);
                  }}
                  className="w-full py-2.5 text-inventory-500 font-display font-semibold text-xs hover:text-accent transition-colors flex items-center justify-center gap-1.5"
                >
                  <span>✨</span>
                  {mode === "magic"
                    ? "Use password instead"
                    : "Sign in with magic link"}
                </button>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-inventory-400 mt-6">
          By continuing you agree to our{" "}
          <span className="text-accent cursor-pointer hover:underline">
            Terms
          </span>
          {" & "}
          <span className="text-accent cursor-pointer hover:underline">
            Privacy Policy
          </span>
        </p>
      </div>
    </main>
  );
}
