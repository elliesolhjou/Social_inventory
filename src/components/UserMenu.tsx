"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const FOUNDER_ID = "e7eb677b-a7a3-401c-a682-9775f1303a52";

export default function UserMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState("?");
  const [profileId, setProfileId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setProfileId(user.id);
      const { data } = await supabase.from("profiles").select("display_name").eq("id", user.id).single();
      if (data?.display_name) setInitial(data.display_name[0].toUpperCase());
    };
    load();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/auth");
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-8 h-8 rounded-full bg-[#ae3200]/20 flex items-center justify-center hover:bg-[#ae3200]/30 transition-colors"
      >
        <span className="text-[#ae3200] text-xs font-bold">{initial}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-48 bg-white rounded-2xl shadow-xl border border-[#e6e2de]/50 overflow-hidden z-50">
          <Link href="/profile/me" onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-3 text-sm text-[#1c1b1a] hover:bg-[#fdf9f5] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            My Profile
          </Link>

          <Link href="/notifications" onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-3 text-sm text-[#1c1b1a] hover:bg-[#fdf9f5] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Notifications
          </Link>

          <Link href="/inbox" onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-3 text-sm text-[#1c1b1a] hover:bg-[#fdf9f5] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            Inbox
          </Link>

          <Link href="/disputes" onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-3 text-sm text-[#1c1b1a] hover:bg-[#fdf9f5] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l3 9a5.002 5.002 0 01-6.001 0M18 7l-3 9m-5.938-1H13" />
            </svg>
            Disputes
          </Link>

          <Link href="/support" onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-3 text-sm text-[#1c1b1a] hover:bg-[#fdf9f5] transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Support
          </Link>

          {/* Admin section — founder only */}
          {profileId === FOUNDER_ID && (
            <>
              <div className="h-px bg-[#e6e2de]" />
              <Link href="/admin/disputes" onClick={() => setOpen(false)}
                className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-[#ae3200] hover:bg-[#fdf0ea] transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.75c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.249-8.25-3.286Zm0 13.036h.008v.008H12v-.008Z" />
                </svg>
                Admin: Disputes
              </Link>
            </>
          )}

          <div className="h-px bg-[#e6e2de]" />
          <button onClick={signOut}
            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-500 hover:bg-red-50 transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
