"use client";

import { useEffect } from "react";

export default function ProhibitedItemsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
            <h2 className="font-display font-bold text-lg">Item Policy</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            >
              <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable body */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

            {/* Absolutely Prohibited */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">⛔</span>
                <h3 className="font-display font-bold text-red-700 text-sm uppercase tracking-widest">
                  Absolutely Prohibited
                </h3>
              </div>
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 space-y-2">
                {[
                  "Weapons, firearms, ammunition, explosives",
                  "Illegal drugs, controlled substances, drug paraphernalia",
                  "Medical devices requiring prescription or professional supervision",
                  "Child car seats or child safety restraints",
                  "Perishable food or FDA-regulated items",
                  "Items with active product safety recalls",
                  "Hazardous materials: fuels, gas tanks, solvents, pesticides",
                  "Counterfeit or stolen property",
                  "Biological materials or biohazard items",
                  "Items requiring federal/state licensing to operate",
                  "Motorized vehicles requiring registration (cars, motorcycles, e-bikes over 750W)",
                  "Fireworks or pyrotechnic devices",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="text-red-400 mt-0.5 flex-shrink-0 text-sm">✕</span>
                    <p className="text-sm text-red-800">{item}</p>
                  </div>
                ))}
                <a
                  href="https://www.recalls.gov"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-red-600 underline mt-2"
                >
                  Check product recalls at recalls.gov
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Allowed With Responsibility */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">✅</span>
                <h3 className="font-display font-bold text-blue-700 text-sm uppercase tracking-widest">
                  Allowed With Responsibility
                </h3>
              </div>
              <p className="text-xs text-gray-500 mb-3 leading-relaxed">
                These items are allowed but carry inherent usage risks. By listing or borrowing,
                you accept full responsibility for safe usage.
              </p>
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 space-y-2">
                {[
                  "Power tools: drills, circular saws, sanders, jigsaws, chainsaws, pressure washers",
                  "Sporting equipment: bicycles, skis, snowboards, surfboards, camping stoves",
                  "Kitchen appliances: pressure cookers, deep fryers, stand mixers, espresso machines",
                  "Electronics and high-value items: laptops, cameras, gaming consoles, projectors",
                ].map((item) => (
                  <div key={item} className="flex items-start gap-2">
                    <span className="text-blue-400 mt-0.5 flex-shrink-0 text-sm">✓</span>
                    <p className="text-sm text-blue-800">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Full policy link */}
            <div className="pt-2 border-t border-gray-100">
              <a
                href="/policies/prohibited-items"
                className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
              >
                View full prohibited items policy →
              </a>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 pt-4 border-t border-gray-100 flex-shrink-0">
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-gray-900 text-white font-display font-bold text-sm hover:bg-gray-700 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
