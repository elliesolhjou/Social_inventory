import Link from "next/link";

const ChevronLeft = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
  </svg>
);

const ArrowRight = () => (
  <svg className="w-4 h-4 inline-block ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
  </svg>
);

const WarningIcon = () => (
  <svg className="w-5 h-5 text-[#ae3200] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.072 16.5c-.77.833.192 2.5 1.732 2.5z" />
  </svg>
);

export default function LendingAgreementPage() {
  const sections = [
    {
      num: "1",
      title: "Platform Role",
      body: `Proxe Technologies LLC ("Proxe") operates as a facilitator of peer-to-peer item lending between residents within residential buildings. Proxe does not own, inspect, certify, or guarantee any items listed on the platform. All lending transactions are solely between the item lender and item borrower. Proxe's role is limited to providing the technology infrastructure, trust scoring, and payment processing through which these transactions occur.`,
    },
    {
      num: "2",
      title: "Lender Responsibilities",
      body: `As a lender, you represent and warrant that: (a) you have the legal right to lend the listed item; (b) the item is accurately described including its condition; (c) the item is safe for a neighbor to use without special training; (d) the item does not appear on Proxe's prohibited items list; and (e) the item is not subject to any active product safety recall. You are solely responsible for any injury, damage, or loss arising from defects in or unsafe conditions of items you lend, regardless of whether such defects were known to you.`,
    },
    {
      num: "3",
      title: "Borrower Responsibilities",
      body: `As a borrower, you agree to: (a) use borrowed items only for their intended purpose and in a safe manner; (b) return items on time and in the same condition as received, accounting for normal wear; (c) not lend, sublet, or transfer borrowed items to any third party; (d) pay the required deposit and any damage fees assessed through the platform's damage verification process; and (e) follow all lender-specified rules associated with the item. You acknowledge that you borrow items at your own risk.`,
    },
    {
      num: "4",
      title: "Deposit and Payment",
      body: `A deposit hold is collected from the borrower at the time of each transaction. Deposits are held by Proxe's payment processor and released to the borrower upon confirmed return of the item in acceptable condition. If damage is confirmed through Proxe's damage verification pipeline, a damage fee may be deducted from the deposit and transferred to the lender. If the lender fails to submit post-return inspection photos within the 24–48 hour grace window, the deposit is automatically released to the borrower in full.`,
    },
    {
      num: "5",
      title: "Damage Verification",
      body: `Proxe uses an AI-powered damage verification pipeline that compares pre-lending and post-return photographs. Damage assessments are presented to both parties as recommendations, not automatic verdicts. Both parties may accept or dispute the assessment. Damage thresholds are calibrated by item category and lender-selected condition rating. Normal wear consistent with the item's stated condition is not considered damage.`,
    },
    {
      num: "6",
      title: "Dispute Resolution",
      body: `Disputes are resolved through a three-tier process: Tier 1 — AI-assisted auto-resolution where the damage report is proposed and both parties accept; Tier 2 — chat-based mediation with a Proxe representative; Tier 3 — binding arbitration in Santa Clara County, California, under the rules of the American Arbitration Association. You agree to attempt resolution through Tiers 1 and 2 before proceeding to arbitration.`,
    },
    {
      num: "7",
      title: "Limitation of Liability",
      body: `To the maximum extent permitted by applicable law, Proxe's aggregate liability to you for any claims arising from or related to your use of the platform shall not exceed the deposit amount of the specific transaction giving rise to the claim. Proxe is not liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, data, or goodwill, arising from your use of the platform.`,
    },
    {
      num: "8",
      title: "Prohibited Items",
      body: `You agree not to list, request, or facilitate the borrowing of any item on Proxe's prohibited items list. Violation of this policy may result in immediate account suspension and may expose you to civil or criminal liability. The current prohibited items list is available at /policies/prohibited-items and is incorporated by reference into this agreement.`,
    },
    {
      num: "9",
      title: "Agreement Updates",
      body: `Proxe may modify this agreement at any time. We will notify you of material changes and require your re-acceptance before you may continue using the platform. Your continued use of Proxe after accepting an updated agreement constitutes your acceptance of the new terms. Agreement versions are tracked and time-stamped at the user account level.`,
    },
    {
      num: "10",
      title: "Governing Law",
      body: `This agreement is governed by the laws of the State of California without regard to its conflict of law provisions. You consent to exclusive jurisdiction and venue in the courts of Santa Clara County, California for any disputes not subject to arbitration under Section 6.`,
    },
  ];

  return (
    <main className="min-h-screen bg-[#fdf9f5] pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#f7f3ef]/90 backdrop-blur-md border-b border-[#e6e2de]/30">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link
            href="/policies"
            className="text-[#8f7067] hover:text-[#1c1b1a] transition-colors"
          >
            <ChevronLeft />
          </Link>
          <h1 className="font-['Plus_Jakarta_Sans'] font-bold text-lg text-[#1c1b1a]">
            Lending Agreement
          </h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 space-y-4">
        {/* Header card */}
        <div className="bg-white border border-[#e6e2de]/50 rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
          <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#1c1b1a] text-base mb-1">
            Proxe Lending Liability Agreement
          </p>
          <p className="text-xs text-[#8f7067] font-['Be_Vietnam_Pro']">
            Version 1.0 &middot; Effective March 2026
          </p>
          <p className="text-sm text-[#5b4038] font-['Be_Vietnam_Pro'] leading-relaxed mt-3">
            By using Proxe, you agree to the following terms governing item
            lending, borrowing, deposits, and dispute resolution.
          </p>
        </div>

        {/* Sections */}
        {sections.map(({ num, title, body }) => (
          <div
            key={num}
            className="bg-white border border-[#e6e2de]/50 rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.02)]"
          >
            <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#1c1b1a] text-sm mb-2">
              {num}. {title}
            </p>
            <p className="text-sm text-[#5b4038] font-['Be_Vietnam_Pro'] leading-relaxed">
              {body}
            </p>
          </div>
        ))}

        {/* Footer */}
        <div className="flex flex-col gap-3 pt-4 pb-4">
          <div className="flex items-start gap-2 bg-[#f7f3ef] border border-[#e6e2de]/50 rounded-xl p-4">
            <WarningIcon />
            <p className="text-xs text-[#5b4038] font-['Be_Vietnam_Pro']">
              This agreement has not yet been reviewed by a licensed attorney.
              Proxe is in the process of obtaining marketplace-specialized legal
              review. Do not deploy to production users until attorney review is
              complete.
            </p>
          </div>
          <Link
            href="/policies/prohibited-items"
            className="text-sm text-[#ae3200] font-['Plus_Jakarta_Sans'] font-bold hover:text-[#ff5a1f] transition-colors"
          >
            View Prohibited Items Policy
            <ArrowRight />
          </Link>
          <Link
            href="/policies"
            className="text-sm text-[#8f7067] font-['Be_Vietnam_Pro'] hover:text-[#1c1b1a] transition-colors"
          >
            Back to Policies
          </Link>
        </div>
      </div>
    </main>
  );
}
