"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

// Founder's profile ID — messages go to you
const FOUNDER_ID = "e7eb677b-a7a3-401c-a682-9775f1303a52";

type FaqItem = {
  q: string;
  a: string;
};

const FAQ: FaqItem[] = [
  {
    q: "How do deposits work?",
    a: "When you borrow an item, a refundable deposit hold is placed on your card. The money isn't charged — it's just a hold. When you return the item and the owner confirms it's in good condition, the hold is released automatically. You're never charged unless there's confirmed damage.",
  },
  {
    q: "What happens if an item is damaged?",
    a: "The owner has 48 hours after the item is returned to inspect it. If they report damage, the Proxe team reviews both the listing photos and the return photos. If damage is confirmed, part or all of the deposit may be captured. If the evidence is unclear, the deposit is released to the borrower.",
  },
  {
    q: "How is my trust score calculated?",
    a: "Your trust score starts at 50 and goes up with completed transactions. Lending items earns more than borrowing. Confirmed damages lower your score. The score is visible on your profile and helps neighbors feel confident sharing with you.",
  },
  {
    q: "Can I rent or buy items instead of borrowing?",
    a: "Yes! Items on Proxe can have up to three pricing modes: Borrow (free + deposit), Rent (daily/monthly rate + deposit), and Buy (purchase outright). The owner sets which modes are available when they list the item.",
  },
  {
    q: "How do I file a dispute?",
    a: "If you're an item owner and believe your item was returned damaged, you can file a dispute within 48 hours of the return. Go to the transaction in your messages, tap 'Report Damage,' and provide a description. The Proxe team will review the evidence and make a decision.",
  },
  {
    q: "What items can't be shared on Proxe?",
    a: "Items that require professional licensing (e.g., certain power tools), car seats, medical devices, and anything illegal. Proxe uses a risk-based framework — if an item could cause harm if used incorrectly, it may not be eligible for sharing.",
  },
  {
    q: "How does Proxe make money?",
    a: "Proxe does not charge transaction fees. We're focused on growing the community first. Future revenue comes from affiliate partnerships and optional premium features.",
  },
  {
    q: "What is Miles?",
    a: "Miles is Proxe's AI concierge. Ask Miles to find items in your building, search nearby buildings, or broadcast a request to your neighbors. Miles can also help you list items with Magic Upload — just take a photo and Miles does the rest.",
  },
];

export default function SupportPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("general");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setUserId(user.id);
    };
    load();
  }, []);

  const handleSend = async () => {
    if (!userId || !message.trim()) return;
    setSending(true);

    await supabase.from("messages").insert({
      sender_id: userId,
      recipient_id: FOUNDER_ID,
      message_type: "support_request",
      content: `[Support — ${category}] ${message.trim()}`,
      topic: "support",
      payload: {
        category,
        support_request: true,
      },
    });

    setSending(false);
    setSent(true);
    setMessage("");
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-inventory-50/30 pt-6 pb-20 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/dashboard" className="w-9 h-9 rounded-full bg-inventory-100 flex items-center justify-center hover:bg-inventory-200 transition-colors">
            <svg className="w-4 h-4 text-inventory-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="font-display font-bold text-xl">Support</h1>
            <p className="text-xs text-inventory-400">FAQ & contact</p>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          <Link
            href="/disputes"
            className="p-4 rounded-2xl bg-amber-50 border border-amber-100 hover:border-amber-200 transition-colors"
          >
            <span className="text-2xl block mb-2">⚖️</span>
            <p className="font-display font-bold text-sm text-amber-800">Dispute Center</p>
            <p className="text-[10px] text-amber-600 mt-0.5">View your disputes</p>
          </Link>
          <Link
            href="/policies"
            className="p-4 rounded-2xl bg-blue-50 border border-blue-100 hover:border-blue-200 transition-colors"
          >
            <span className="text-2xl block mb-2">📜</span>
            <p className="font-display font-bold text-sm text-blue-800">Policies</p>
            <p className="text-[10px] text-blue-600 mt-0.5">Terms & guidelines</p>
          </Link>
        </div>

        {/* FAQ */}
        <div className="mb-8">
          <h2 className="font-display font-bold text-sm text-inventory-400 uppercase tracking-widest mb-4">
            Frequently Asked Questions
          </h2>
          <div className="space-y-2">
            {FAQ.map((item, i) => (
              <div key={i} className="glass rounded-2xl border border-inventory-100 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full text-left p-4 flex items-center justify-between"
                >
                  <p className="font-display font-semibold text-sm pr-4">{item.q}</p>
                  <svg
                    className={`w-4 h-4 text-inventory-400 flex-shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-4 pb-4">
                    <p className="text-sm text-inventory-500 leading-relaxed">{item.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Contact form */}
        <div className="glass rounded-3xl p-6 border border-inventory-100">
          <h2 className="font-display font-bold text-sm text-inventory-400 uppercase tracking-widest mb-4">
            Contact Us
          </h2>

          {sent ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full bg-trust-high/10 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">✉️</span>
              </div>
              <h3 className="font-display font-bold text-lg mb-1">Message sent!</h3>
              <p className="text-sm text-inventory-400 mb-4">
                We'll get back to you as soon as possible.
              </p>
              <button
                onClick={() => setSent(false)}
                className="text-accent text-sm font-medium hover:underline"
              >
                Send another message
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Category */}
              <div>
                <label className="block text-xs font-bold text-inventory-500 mb-1.5">Topic</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm transition-colors bg-white"
                >
                  <option value="general">General Question</option>
                  <option value="dispute">Dispute Help</option>
                  <option value="billing">Billing / Deposits</option>
                  <option value="bug">Bug Report</option>
                  <option value="feature">Feature Request</option>
                  <option value="safety">Safety Concern</option>
                </select>
              </div>

              {/* Message */}
              <div>
                <label className="block text-xs font-bold text-inventory-500 mb-1.5">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Describe your issue or question..."
                  className="w-full px-4 py-3 rounded-2xl border-2 border-inventory-200 focus:border-accent outline-none text-sm resize-none transition-colors"
                />
              </div>

              {/* Send */}
              <button
                onClick={handleSend}
                disabled={sending || !message.trim()}
                className="w-full py-3.5 bg-accent text-white rounded-2xl font-display font-bold text-sm hover:bg-accent-dark transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {sending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Message"
                )}
              </button>

              <p className="text-[10px] text-inventory-300 text-center">
                Messages go directly to the Proxe team. We typically respond within 24 hours.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
