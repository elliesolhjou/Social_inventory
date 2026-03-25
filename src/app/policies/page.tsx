"use client";

import Link from "next/link";
import { useState } from "react";

const ChevronLeft = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ChevronDown = ({ open }: { open: boolean }) => (
  <svg
    className={`w-5 h-5 text-[#8f7067] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

const SearchIcon = () => (
  <svg className="w-5 h-5 text-[#8f7067]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const ArrowRight = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
  </svg>
);

/* Section icons as small SVG components */
const BlockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
  </svg>
);
const BuildingIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M6 21V9l6-4 6 4v12M9 21v-6h6v6M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
  </svg>
);
const HeartHandIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
  </svg>
);
const ShoppingBagIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
  </svg>
);
const CpuIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 3v2m6-2v2M9 19v2m6-2v2M3 9h2m-2 6h2m14-6h2m-2 6h2M7 7h10v10H7V7z" />
  </svg>
);
const ScaleIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
  </svg>
);
const LockIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);
const CheckCircleIcon = () => (
  <svg className="w-4 h-4 text-[#526442] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

interface PolicySection {
  id: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  content: React.ReactNode;
  link?: { href: string; label: string };
}

const sections: PolicySection[] = [
  {
    id: "prohibited",
    title: "Prohibited Items",
    icon: <BlockIcon />,
    content: (
      <div>
        <p className="text-[#5b4038] font-['Be_Vietnam_Pro'] leading-relaxed mb-4">
          The Proxe community thrives on trust and safety. To maintain this
          environment, certain items are strictly forbidden from being listed or
          borrowed on the platform.
        </p>
        <ul className="space-y-3">
          {[
            "Hazardous materials or chemicals",
            "Regulated weapons or ammunition",
            "Illegal substances or paraphernalia",
            "Medical devices requiring prescription",
            "Child car seats or safety restraints",
            "Items with active product safety recalls",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3">
              <CheckCircleIcon />
              <span className="text-[#1c1b1a] font-medium font-['Be_Vietnam_Pro'] text-sm">{item}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
    link: { href: "/policies/prohibited-items", label: "View full list" },
  },
  {
    id: "platform-role",
    title: "Platform Role & Liability",
    icon: <BuildingIcon />,
    content: (
      <p className="text-[#5b4038] font-['Be_Vietnam_Pro'] leading-relaxed text-sm">
        Proxe Technologies LLC operates as a facilitator of peer-to-peer item
        lending between residents within residential buildings. Proxe does not
        own, inspect, certify, or guarantee any items listed on the platform.
        All lending transactions are solely between the item owner and the
        borrower. Proxe&apos;s role is limited to providing the technology
        infrastructure, trust scoring, and payment processing.
      </p>
    ),
    link: { href: "/policies/lending-agreement", label: "Read full agreement" },
  },
  {
    id: "lender",
    title: "Lender Responsibilities",
    icon: <HeartHandIcon />,
    content: (
      <p className="text-[#5b4038] font-['Be_Vietnam_Pro'] leading-relaxed text-sm">
        As a lender, you represent that you have the legal right to lend the
        listed item, it is accurately described including its condition, it is
        safe for a neighbor to use without special training, and it does not
        appear on Proxe&apos;s prohibited items list. You are solely responsible for
        any injury, damage, or loss arising from defects in or unsafe conditions
        of items you lend.
      </p>
    ),
  },
  {
    id: "borrower",
    title: "Borrower Responsibilities",
    icon: <ShoppingBagIcon />,
    content: (
      <p className="text-[#5b4038] font-['Be_Vietnam_Pro'] leading-relaxed text-sm">
        As a borrower, you agree to use borrowed items only for their intended
        purpose and in a safe manner, return items on time and in the same
        condition as received (accounting for normal wear), not transfer borrowed
        items to any third party, and pay the required deposit and any assessed
        damage fees. You acknowledge that you borrow items at your own risk.
      </p>
    ),
  },
  {
    id: "ai-verification",
    title: "AI Damage Verification",
    subtitle: "System Protocol",
    icon: <CpuIcon />,
    content: (
      <div className="bg-[#f7f3ef] p-5 rounded-xl border border-[#e6e2de]/50">
        <p className="text-[#5b4038] font-['Be_Vietnam_Pro'] leading-relaxed text-sm italic">
          Proxe uses Proxie AI to compare high-resolution photos taken before and
          after a transaction. This process identifies new wear or damage,
          facilitating transparent dispute resolution between neighbors.
        </p>
        <Link
          href="/support"
          className="inline-flex items-center gap-2 mt-4 text-[#1c1b1a] font-bold font-['Plus_Jakarta_Sans'] text-sm hover:text-[#ae3200] transition-colors"
        >
          Learn about AI Verification
          <ArrowRight />
        </Link>
      </div>
    ),
  },
  {
    id: "disputes",
    title: "Dispute Resolution",
    icon: <ScaleIcon />,
    content: (
      <p className="text-[#5b4038] font-['Be_Vietnam_Pro'] leading-relaxed text-sm">
        Disputes are resolved through a tiered process: first through
        AI-assisted review where the damage report is proposed and both parties
        can accept, then through chat-based mediation with a Proxe
        representative, and finally through binding arbitration in Santa Clara
        County, California if needed. All parties agree to attempt resolution
        through earlier tiers before proceeding to arbitration.
      </p>
    ),
  },
  {
    id: "privacy",
    title: "Data & Privacy",
    icon: <LockIcon />,
    content: (
      <p className="text-[#5b4038] font-['Be_Vietnam_Pro'] leading-relaxed text-sm">
        Proxe collects only the data necessary to facilitate secure transactions
        between neighbors. Your personal information is never sold to third
        parties. Transaction photos are used solely for damage verification and
        dispute resolution. All payment data is processed securely through Stripe
        and never stored on Proxe servers. You may request deletion of your data
        at any time.
      </p>
    ),
  },
];

export default function PoliciesPage() {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(["prohibited"]));
  const [search, setSearch] = useState("");

  const toggle = (id: string) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filtered = sections.filter(
    (s) =>
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-[#fdf9f5] pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#f7f3ef]/90 backdrop-blur-md border-b border-[#e6e2de]/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-[#8f7067] hover:text-[#1c1b1a] transition-colors"
          >
            <ChevronLeft />
          </Link>
          <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#1c1b1a]">
            Policies
          </h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Hero */}
        <section className="pt-10 pb-8">
          <span className="text-[#8f7067] font-['Plus_Jakarta_Sans'] font-bold tracking-widest text-[11px] uppercase mb-3 block">
            Legals & Community
          </span>
          <h2 className="text-4xl sm:text-5xl font-['Plus_Jakarta_Sans'] font-bold text-[#1c1b1a] leading-tight tracking-tight mb-3">
            Policies
          </h2>
          <p className="text-lg text-[#5b4038] font-['Be_Vietnam_Pro'] font-medium">
            Terms, liability, and privacy at Proxe.
          </p>
        </section>

        {/* Search */}
        <div className="relative mb-10">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#f7f3ef] border border-[#e6e2de] rounded-xl py-4 pl-14 pr-6 
                       focus:outline-none focus:ring-1 focus:ring-[#ae3200] focus:border-[#ae3200]
                       placeholder:text-[#8f7067]/60 text-[#1c1b1a] font-['Be_Vietnam_Pro'] font-medium transition-all"
            placeholder="Search for specific policy terms..."
          />
        </div>

        {/* Accordion */}
        <div className="space-y-3">
          {filtered.map((section) => {
            const isOpen = openSections.has(section.id);
            return (
              <div
                key={section.id}
                className="bg-white border border-[#e6e2de]/50 rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.02)]"
              >
                <button
                  onClick={() => toggle(section.id)}
                  className="w-full px-6 sm:px-8 py-5 flex items-center justify-between text-left group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-full bg-[#f7f3ef] flex items-center justify-center text-[#5b4038] group-hover:bg-[#1c1b1a] group-hover:text-white transition-colors">
                      {section.icon}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-lg font-bold font-['Plus_Jakarta_Sans'] text-[#1c1b1a]">
                        {section.title}
                      </span>
                      {section.subtitle && (
                        <span className="text-[10px] text-[#8f7067] font-['Plus_Jakarta_Sans'] font-bold uppercase tracking-widest">
                          {section.subtitle}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronDown open={isOpen} />
                </button>

                {isOpen && (
                  <div className="px-6 sm:px-8 pb-6 pt-0">
                    {section.content}
                    {section.link && (
                      <Link
                        href={section.link.href}
                        className="inline-flex items-center gap-2 mt-4 text-[#ae3200] font-bold font-['Plus_Jakarta_Sans'] text-sm hover:text-[#ff5a1f] transition-colors"
                      >
                        {section.link.label}
                        <ArrowRight />
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer CTA */}
        <div className="mt-16 p-10 sm:p-12 bg-[#f7f3ef] border border-[#e6e2de]/50 rounded-2xl text-center">
          <h3 className="text-2xl font-['Plus_Jakarta_Sans'] font-bold text-[#1c1b1a] mb-3">
            Have specific questions?
          </h3>
          <p className="text-[#5b4038] font-['Be_Vietnam_Pro'] mb-8 max-w-lg mx-auto text-sm">
            Our support team and Proxie AI are available 24/7 to help you
            navigate the Proxe ecosystem safely.
          </p>
          <Link
            href="/support"
            className="inline-block bg-gradient-to-b from-[#ae3200] to-[#ff5a1f] text-white font-['Plus_Jakarta_Sans'] font-bold px-10 py-4 rounded-full hover:shadow-lg hover:shadow-[#ae3200]/20 active:scale-95 transition-all"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </main>
  );
}
