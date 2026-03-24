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
    <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden bg-[#fdf9f5]">
      {/* Header */}
      <header className="flex items-center justify-between p-5 sm:p-6">
        <Link
          href="/"
          className="flex items-center justify-center w-11 h-11 rounded-full hover:bg-[#ebe7e4] transition-colors text-[#1c1b1a]"
          aria-label="Go back"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#ae3200] flex items-center justify-center">
            <svg className="w-[18px] h-[18px] text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </div>
          <span className="font-['Plus_Jakarta_Sans'] font-bold text-xl tracking-tight text-[#ae3200]">
            Proxe
          </span>
        </Link>
        <div className="w-11 h-11" /> {/* Spacer for centering */}
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-8 pb-6">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-3xl shadow-[0_20px_40px_rgba(174,50,0,0.06)] p-6 sm:p-10 relative overflow-hidden">
            {/* Decorative blur orb */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-[#ae3200]/10 rounded-full blur-3xl pointer-events-none" />

            {magicSent ? (
              /* Magic Link Sent State */
              <div className="text-center py-6 relative">
                <div className="w-16 h-16 rounded-full bg-[#526442]/10 flex items-center justify-center mx-auto mb-5">
                  <span className="text-3xl">✉️</span>
                </div>
                <h2 className="font-['Plus_Jakarta_Sans'] font-extrabold text-2xl text-[#1c1b1a] mb-2">
                  Check your email
                </h2>
                <p className="text-[#5b4038] text-base font-['Be_Vietnam_Pro'] leading-relaxed">
                  We sent a magic link to <strong className="text-[#1c1b1a]">{email}</strong>.
                  Click it to sign in.
                </p>
                <button
                  onClick={() => {
                    setMagicSent(false);
                    setMode("signin");
                  }}
                  className="mt-8 text-sm text-[#ae3200] font-['Plus_Jakarta_Sans'] font-bold hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            ) : (
              <div className="relative">
                {/* Headline */}
                <div className="text-center mb-8">
                  <h1 className="font-['Plus_Jakarta_Sans'] text-3xl sm:text-[2.1rem] font-extrabold leading-tight tracking-[-0.033em] text-[#1c1b1a] mb-2">
                    {mode === "signup"
                      ? "Join your neighborhood."
                      : mode === "magic"
                        ? "Sign in without a password."
                        : "Welcome back to your neighborhood."}
                  </h1>
                  <p className="text-[#5b4038] text-base font-['Be_Vietnam_Pro']">
                    {mode === "signup"
                      ? "Create your account to start sharing."
                      : mode === "magic"
                        ? "We'll send you a link to sign in."
                        : "Sign in to continue sharing."}
                  </p>
                </div>

                {/* Tabs — underline style matching Stitch */}
                <div className="flex mb-8 relative border-b border-[#ebe7e4]">
                  {(["signin", "signup"] as Mode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setMode(m);
                        setError(null);
                      }}
                      className={`flex-1 pb-4 text-center font-['Plus_Jakarta_Sans'] text-base transition-colors ${
                        mode === m || (mode === "magic" && m === "signin")
                          ? "font-bold text-[#ae3200] border-b-2 border-[#ae3200]"
                          : "font-medium text-[#5b4038] hover:text-[#1c1b1a]"
                      }`}
                    >
                      {m === "signin" ? "Sign In" : "Create Account"}
                    </button>
                  ))}
                </div>

                {/* Google Auth */}
                <button
                  onClick={() => handleSocialLogin("google")}
                  disabled={!!socialLoading}
                  className="w-full flex items-center justify-center h-14 rounded-full bg-[#ebe7e4] text-[#1c1b1a] hover:bg-[#ddd9d6] transition-colors mb-6 font-['Plus_Jakarta_Sans'] font-bold text-base gap-3 disabled:opacity-50"
                >
                  {socialLoading === "google" ? (
                    <div className="w-5 h-5 border-2 border-[#8f7067] border-t-[#1c1b1a] rounded-full animate-spin" />
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

                {/* Divider */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="flex-1 h-px bg-[#ebe7e4]" />
                  <span className="text-sm font-medium text-[#5b4038] uppercase tracking-wider font-['Be_Vietnam_Pro']">
                    OR
                  </span>
                  <div className="flex-1 h-px bg-[#ebe7e4]" />
                </div>

                <div className="space-y-5">
                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-[#5b4038] mb-2 font-['Plus_Jakarta_Sans']">
                      Email address
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="neighbor@example.com"
                      className="w-full h-14 bg-[#f7f3ef] border-none rounded-2xl px-4 text-[#1c1b1a] placeholder:text-[#8f7067] focus:ring-2 focus:ring-[#ae3200] focus:outline-none transition-shadow text-base font-['Be_Vietnam_Pro']"
                      autoComplete="email"
                    />
                  </div>

                  {/* Password — only for signin/signup */}
                  {mode !== "magic" && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-[#5b4038] font-['Plus_Jakarta_Sans']">
                          Password
                        </label>
                        {mode === "signin" && (
                          <button
                            type="button"
                            onClick={() => {
                              setMode("magic");
                              setError(null);
                            }}
                            className="text-sm font-medium text-[#ae3200] hover:underline font-['Be_Vietnam_Pro']"
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                          mode === "signup"
                            ? "Create a password (min 6 chars)"
                            : "••••••••"
                        }
                        className="w-full h-14 bg-[#f7f3ef] border-none rounded-2xl px-4 text-[#1c1b1a] placeholder:text-[#8f7067] focus:ring-2 focus:ring-[#ae3200] focus:outline-none transition-shadow text-base font-['Be_Vietnam_Pro']"
                        autoComplete={
                          mode === "signup" ? "new-password" : "current-password"
                        }
                      />
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div className="flex items-start gap-2.5 px-4 py-3.5 rounded-2xl bg-red-50 border border-red-100">
                      <span className="text-red-500 text-sm mt-0.5">⚠</span>
                      <p className="text-red-700 text-sm leading-relaxed font-['Be_Vietnam_Pro']">
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
                    className="w-full h-14 mt-2 rounded-full bg-gradient-to-b from-[#ae3200] to-[#ff5a1f] text-white font-['Plus_Jakarta_Sans'] font-bold text-lg hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                  >
                    {loading ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>Loading...</span>
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
                    className="w-full py-2.5 text-[#526442] font-['Be_Vietnam_Pro'] font-medium text-sm hover:text-[#3b4c2c] transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>✨</span>
                    {mode === "magic"
                      ? "Use password instead"
                      : "Send me a magic link instead"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-[#5b4038] mt-6 font-['Be_Vietnam_Pro']">
            By signing in, you agree to our{" "}
            <Link href="/policies" className="text-[#ae3200] hover:underline">
              Terms of Service
            </Link>
            {" and "}
            <Link href="/policies" className="text-[#ae3200] hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
