"use client";

import { useState, useRef, useEffect } from "react";

const CURRENT_VERSION = "1.0";

interface Props {
  onAccept: (version: string) => void;
}

export default function LendingAgreementModal({ onAccept }: Props) {
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const [checked, setChecked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom) setScrolledToBottom(true);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h2 className="font-display font-bold text-lg">Lending Agreement</h2>
                <p className="text-xs text-inventory-400">Please read and accept to continue</p>
              </div>
            </div>
          </div>

          {/* Scrollable agreement body */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="overflow-y-auto flex-1 px-6 py-5"
          >
            <div className="space-y-5 text-sm text-inventory-700 leading-relaxed">

              <div>
                <p className="font-bold text-inventory-900 mb-2">1. Platform Role</p>
                <p>
                  Proxe Technologies LLC ("Proxe") operates as a facilitator of peer-to-peer item
                  lending between residents. Proxe does not own, inspect, certify, or guarantee any
                  items listed on the platform. All transactions are between the item lender and borrower.
                </p>
              </div>

              <div>
                <p className="font-bold text-inventory-900 mb-2">2. Lender Responsibilities</p>
                <p>
                  As a lender, you are solely responsible for ensuring that items you list are safe,
                  accurately described, in the stated condition, and not prohibited. You agree that
                  Proxe bears no liability for any injury, damage, or loss arising from items you lend.
                </p>
              </div>

              <div>
                <p className="font-bold text-inventory-900 mb-2">3. Borrower Responsibilities</p>
                <p>
                  As a borrower, you agree to use borrowed items safely and responsibly, return items
                  on time and in the same condition received, and accept that Proxe is not responsible
                  for the condition or safety of items you borrow. You agree to pay deposit amounts
                  and any damage fees assessed through the platform's damage verification process.
                </p>
              </div>

              <div>
                <p className="font-bold text-inventory-900 mb-2">4. Prohibited Items</p>
                <p>
                  You agree not to list or request items that are prohibited under Proxe's Item Policy,
                  including but not limited to weapons, illegal substances, medical devices requiring
                  a prescription, child safety restraints, hazardous materials, and items with active
                  product safety recalls. The full prohibited items list is available at
                  /policies/prohibited-items.
                </p>
              </div>

              <div>
                <p className="font-bold text-inventory-900 mb-2">5. Deposit and Damage</p>
                <p>
                  Deposit holds are managed through Proxe's payment system. Deposits are released
                  upon confirmed return of items in acceptable condition. Damage fees may be assessed
                  through Proxe's AI-powered damage verification pipeline. Disputes follow a
                  three-tier escalation process: (1) AI-assisted resolution, (2) chat mediation,
                  (3) binding arbitration.
                </p>
              </div>

              <div>
                <p className="font-bold text-inventory-900 mb-2">6. Limitation of Liability</p>
                <p>
                  To the maximum extent permitted by law, Proxe's liability to you for any claim
                  arising from platform use shall not exceed the deposit amount of the transaction
                  in question. Proxe is not liable for indirect, incidental, or consequential damages.
                </p>
              </div>

              <div>
                <p className="font-bold text-inventory-900 mb-2">7. Dispute Resolution</p>
                <p>
                  Any disputes not resolved through the platform's built-in dispute process shall
                  be resolved through binding arbitration in Santa Clara County, California, under
                  the rules of the American Arbitration Association.
                </p>
              </div>

              <div>
                <p className="font-bold text-inventory-900 mb-2">8. Updates to This Agreement</p>
                <p>
                  Proxe may update this agreement from time to time. You will be notified and
                  required to re-accept any material changes before continuing to use the platform.
                </p>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-inventory-400">
                  Version {CURRENT_VERSION} — Effective March 2026
                </p>
                <a
                  href="/policies/lending-agreement"
                  target="_blank"
                  className="text-xs text-accent underline hover:no-underline"
                >
                  View full agreement at /policies/lending-agreement
                </a>
              </div>
            </div>
          </div>

          {/* Scroll nudge */}
          {!scrolledToBottom && (
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-inventory-400 flex-shrink-0 border-t border-inventory-100">
              <svg className="w-3 h-3 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              Scroll to read the full agreement
            </div>
          )}

          {/* Footer */}
          <div className="px-6 pb-6 pt-4 border-t border-gray-100 space-y-4 flex-shrink-0">
            <label className="flex items-start gap-3 cursor-pointer">
              <div
                onClick={() => scrolledToBottom && setChecked(!checked)}
                className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  checked
                    ? "bg-accent border-accent"
                    : scrolledToBottom
                    ? "border-inventory-300 hover:border-accent"
                    : "border-inventory-200 opacity-50 cursor-not-allowed"
                }`}
              >
                {checked && (
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <p className={`text-sm leading-relaxed ${scrolledToBottom ? "text-inventory-700" : "text-inventory-400"}`}>
                I have read and agree to the Proxe Lending Agreement, Prohibited Items Policy,
                and Terms of Service.
              </p>
            </label>

            <button
              onClick={() => checked && onAccept(CURRENT_VERSION)}
              disabled={!checked}
              className="w-full py-3.5 rounded-2xl font-display font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{
                background: checked ? "var(--color-accent)" : "var(--color-inventory-200)",
                color: checked ? "white" : "var(--color-inventory-500)",
              }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Accept and Continue
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export { CURRENT_VERSION };
