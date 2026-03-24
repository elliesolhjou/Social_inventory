"use client";

import { useState } from "react";
import Link from "next/link";

type Section = {
  id: string;
  title: string;
  icon: string;
  content: React.ReactNode;
};

function SectionCard({ section, isOpen, onToggle }: { section: Section; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="glass rounded-2xl border border-inventory-100 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full text-left p-5 flex items-center justify-between hover:bg-inventory-50/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{section.icon}</span>
          <h2 className="font-display font-bold text-sm">{section.title}</h2>
        </div>
        <svg
          className={`w-4 h-4 text-inventory-400 flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (
        <div className="px-5 pb-5 text-sm text-inventory-600 leading-relaxed space-y-3">
          {section.content}
        </div>
      )}
    </div>
  );
}

export default function PoliciesPage() {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const sections: Section[] = [
    {
      id: "prohibited",
      title: "Prohibited Items",
      icon: "🚫",
      content: (
        <>
          <p className="font-bold text-inventory-800">Absolutely Prohibited — cannot be listed under any circumstances:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>Weapons, firearms, ammunition, explosives</li>
            <li>Illegal drugs, controlled substances, drug paraphernalia</li>
            <li>Medical devices requiring prescription (CPAP, insulin pumps, oxygen equipment)</li>
            <li>Child car seats, booster seats, or child safety restraints</li>
            <li>Perishable food, open consumables, or FDA-regulated items</li>
            <li>Items with active product safety recalls</li>
            <li>Hazardous materials: combustible fuels, pressurized gas tanks, chemical solvents</li>
            <li>Counterfeit, stolen, or fraudulently obtained property</li>
            <li>Motorized vehicles requiring registration (cars, motorcycles, e-bikes over 750W)</li>
            <li>Fireworks or pyrotechnic devices</li>
            <li>Pornographic material or sexually explicit items</li>
          </ul>
          <p className="font-bold text-inventory-800 pt-2">Permitted With Responsibility:</p>
          <p>Power tools, sporting equipment, kitchen appliances, electronics, and fabric/bedding items are permitted but carry inherent usage risks. By listing or borrowing these items, users accept full responsibility.</p>
          <p className="text-xs text-inventory-400">Proxe reserves the right to remove any listing and suspend accounts for repeated violations.</p>
        </>
      ),
    },
    {
      id: "liability",
      title: "Platform Role & Liability",
      icon: "⚖️",
      content: (
        <>
          <p>Proxe Technologies LLC is a technology platform that facilitates peer-to-peer item sharing between residents of residential buildings. Proxe is <strong>not a party to any lending transaction</strong> and does not own, possess, inspect, certify, warrant, or control any item listed on the platform.</p>
          <p>Proxe provides: item listing and discovery, AI-assisted identification and search, deposit hold and release via Stripe, AI-assisted damage comparison (advisory only), trust scoring, dispute resolution recommendations, and the Miles AI concierge.</p>
          <p className="text-xs bg-amber-50 border border-amber-100 rounded-xl p-3">
            <strong>Important:</strong> Proxe&apos;s use of AI technology, deposit management, and dispute resolution tools does not make Proxe a party to any transaction. These tools assist users in managing their own transactions. The decision to lend, borrow, or transact rests solely with the users.
          </p>
          <p className="text-xs text-inventory-400">The limitations of liability apply to ordinary negligence and do not apply to acts of gross negligence or willful misconduct by Proxe Technologies LLC.</p>
        </>
      ),
    },
    {
      id: "lender",
      title: "Lender Responsibilities",
      icon: "📦",
      content: (
        <>
          <p>By listing an item on Proxe, you represent and agree that:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>You are the legal owner or have authority to lend the item</li>
            <li>The item is in safe, functional condition and free from known defects</li>
            <li>All original safety guards and protective mechanisms are intact</li>
            <li>The item is not subject to an active product safety recall</li>
            <li>The condition category selected accurately reflects the item&apos;s condition</li>
            <li>Photos provided accurately represent the item&apos;s current condition</li>
            <li>You will inspect the item upon return within the grace window (24–48 hours)</li>
            <li>You will not hold Proxe liable for any damage, loss, or theft</li>
          </ul>
          <p className="text-xs bg-red-50 border border-red-100 rounded-xl p-3">
            A lender who knowingly lends an item with undisclosed defects or missing safety guards bears sole liability for any resulting injury and agrees to indemnify Proxe against any claims.
          </p>
        </>
      ),
    },
    {
      id: "borrower",
      title: "Borrower Responsibilities",
      icon: "🤝",
      content: (
        <>
          <p>By borrowing an item on Proxe, you represent and agree that:</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>You will use the item safely and consistent with its intended purpose</li>
            <li>You have sufficient knowledge to operate the item safely</li>
            <li>You accept full responsibility for any injury or damage arising from use</li>
            <li>You will return the item in the same condition received, normal wear excepted</li>
            <li>You authorize Proxe to hold a deposit and capture part or all if damage is confirmed</li>
            <li>You will not hold Proxe liable for any injury, illness, or property damage</li>
            <li>You acknowledge Proxe does not inspect, test, or certify items</li>
            <li>Certain items (power tools, sporting equipment) carry inherent risk and you voluntarily assume that risk</li>
          </ul>
        </>
      ),
    },
    {
      id: "deposits",
      title: "Deposits & Payments",
      icon: "💳",
      content: (
        <>
          <p>When you borrow an item, a refundable deposit hold is placed on your card via Stripe. The money isn&apos;t charged — it&apos;s an authorization hold.</p>
          <p><strong>How it works:</strong></p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>Deposit is held (not charged) when you confirm a borrow</li>
            <li>When you return the item and the owner confirms it&apos;s in good condition, the hold is released</li>
            <li>If the owner doesn&apos;t respond within 48 hours, the hold is auto-released</li>
            <li>If damage is confirmed through the dispute process, part or all of the deposit may be captured</li>
          </ul>
          <p className="text-xs text-inventory-400">Items above $500 trigger a higher deposit hold. Proxe&apos;s deposit system protects lenders but does not guarantee full replacement value.</p>
        </>
      ),
    },
    {
      id: "disputes",
      title: "Dispute Resolution",
      icon: "🔍",
      content: (
        <>
          <p>Disputes are resolved through a three-tier process:</p>
          <div className="space-y-2">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
              <p className="font-bold text-xs text-blue-800">Tier 1 — AI-Assisted Resolution</p>
              <p className="text-xs text-blue-600 mt-0.5">Advisory damage assessment generated from photos. Both parties may accept (binding) or reject (proceeds to Tier 2).</p>
            </div>
            <div className="p-3 rounded-xl bg-purple-50 border border-purple-100">
              <p className="font-bold text-xs text-purple-800">Tier 2 — Mediated Resolution</p>
              <p className="text-xs text-purple-600 mt-0.5">Human mediator reviews evidence and issues a non-binding recommendation.</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
              <p className="font-bold text-xs text-amber-800">Tier 3 — Binding Arbitration</p>
              <p className="text-xs text-amber-600 mt-0.5">Submitted to binding arbitration per AAA rules in Santa Clara County, California.</p>
            </div>
          </div>
          <p className="text-xs bg-inventory-50 border border-inventory-100 rounded-xl p-3 mt-2">
            <strong>Class Action Waiver:</strong> All claims must be brought individually, not as a class member. By using the platform, you waive the right to participate in class action lawsuits or class-wide arbitration.
          </p>
        </>
      ),
    },
    {
      id: "ai",
      title: "AI Damage Verification",
      icon: "🤖",
      content: (
        <>
          <p>Proxe&apos;s AI damage verification system (VisionAgent) generates comparative assessments based on photos submitted by lender and borrower. These assessments are <strong>advisory recommendations only</strong> and do not constitute binding determinations.</p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>Both parties have the right to accept or reject any AI recommendation</li>
            <li>If both parties accept, the recommendation is final and binding for that transaction</li>
            <li>If either party rejects, the dispute proceeds to Tier 2 mediation</li>
            <li>Proxe is not liable for financial loss arising from a user&apos;s voluntary acceptance of an AI recommendation</li>
          </ul>
        </>
      ),
    },
    {
      id: "age",
      title: "Age Requirement",
      icon: "🔞",
      content: (
        <>
          <p><strong>The platform is for adults only.</strong> You must be at least 18 years of age to create an account, list items, or borrow items through Proxe.</p>
          <p>If Proxe discovers that a user is under 18, the account will be immediately terminated and any pending transactions cancelled. Liability waivers entered into by individuals under 18 are void and unenforceable.</p>
        </>
      ),
    },
    {
      id: "privacy",
      title: "Data & Privacy",
      icon: "🔒",
      content: (
        <>
          <p><strong>Data we collect:</strong> account information (name, email, building), transaction data, photographs (with EXIF metadata), payment info (via Stripe), usage data, trust scoring inputs, and device information.</p>
          <p><strong>Data use:</strong> facilitating transactions, AI item identification, trust scores, personalized recommendations, and legal compliance.</p>
          <p><strong>Data sharing:</strong> Proxe does not sell personal information. Data may be shared with Stripe (payments), Google/Gemini (AI processing), law enforcement (when required by law), and property managers (aggregate, anonymized data only).</p>
          <p><strong>Data retention:</strong> Transaction data retained for account duration plus 3 years after deletion for legal compliance.</p>
          <p className="text-xs bg-blue-50 border border-blue-100 rounded-xl p-3">
            <strong>California (CCPA) Rights:</strong> You have the right to know what data is collected, request deletion, and opt out of data sales (Proxe does not sell data). Contact support@proxe.co for data requests.
          </p>
        </>
      ),
    },
    {
      id: "warranty",
      title: "No Warranty & Limitations",
      icon: "📜",
      content: (
        <>
          <p className="text-xs bg-inventory-50 border border-inventory-100 rounded-xl p-3">
            The platform and all items listed are provided &ldquo;AS IS&rdquo; and &ldquo;AS AVAILABLE.&rdquo; Proxe makes no warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, safety, or non-infringement.
          </p>
          <p><strong>Limitation on Damages:</strong> Proxe&apos;s total liability shall not exceed the total fees paid by the user in the preceding 12 months, or $100, whichever is greater. Proxe shall not be liable for any indirect, incidental, special, consequential, or punitive damages.</p>
          <p><strong>Governing Law:</strong> This agreement is governed by the laws of the State of California.</p>
          <p><strong>Severability:</strong> If any provision is found unenforceable, it shall be limited to the minimum extent necessary so the remainder stays in full force.</p>
        </>
      ),
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-inventory-50/30 pt-6 pb-20 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Link href="/support" className="w-9 h-9 rounded-full bg-inventory-100 flex items-center justify-center hover:bg-inventory-200 transition-colors">
            <svg className="w-4 h-4 text-inventory-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="font-display font-bold text-xl">Policies</h1>
            <p className="text-xs text-inventory-400">Terms, liability, and privacy</p>
          </div>
        </div>

        {/* Version notice */}
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-50 border border-blue-100 mb-6">
          <span className="text-sm">📋</span>
          <p className="text-[11px] text-blue-700">
            <strong>Version 2.0</strong> — Item Policy, Liability Framework & Privacy. This is a summary — full legal document available upon request.
          </p>
        </div>

        {/* Company info */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-2">
            <span className="font-display font-black text-white text-lg">P</span>
          </div>
          <p className="font-display font-bold text-sm">Proxe Technologies LLC</p>
          <p className="text-xs text-inventory-400">Mountain View, CA</p>
        </div>

        {/* Sections */}
        <div className="space-y-2">
          {sections.map((section) => (
            <SectionCard
              key={section.id}
              section={section}
              isOpen={openSection === section.id}
              onToggle={() => setOpenSection(openSection === section.id ? null : section.id)}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center space-y-2">
          <p className="text-[10px] text-inventory-300">
            CONFIDENTIAL — DRAFT FOR ATTORNEY REVIEW — NOT LEGAL ADVICE
          </p>
          <p className="text-[10px] text-inventory-300">
            Last updated: March 2026
          </p>
          <Link href="/support" className="text-xs text-accent font-medium hover:underline">
            Questions? Contact Support →
          </Link>
        </div>
      </div>
    </main>
  );
}
