import Link from "next/link";

export default function ProhibitedItemsPage() {
  return (
    <main className="min-h-screen bg-inventory-50 pb-20">
      <header className="sticky top-0 z-40 glass border-b border-inventory-200/50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
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
          <h1 className="font-display font-bold text-lg">
            Prohibited Items Policy
          </h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pt-8 space-y-8">
        {/* Intro */}
        <div className="glass rounded-3xl p-6">
          <p className="text-sm text-inventory-600 leading-relaxed">
            Proxe connects neighbors to share items they own. To keep our
            community safe, some items cannot be listed on the platform. Our
            policy is risk-based:{" "}
            <strong>
              any item a neighbor could not pick up and use safely without
              special training is not permitted.
            </strong>
          </p>
          <p className="text-xs text-inventory-400 mt-3">
            Last updated: March 2026 · Version 1.0
          </p>
        </div>

        {/* Absolutely Prohibited */}
        <div className="glass rounded-3xl overflow-hidden">
          <div className="bg-red-600 px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="text-white text-lg">⛔</span>
              <h2 className="font-display font-bold text-white">
                Absolutely Prohibited
              </h2>
            </div>
            <p className="text-red-100 text-xs mt-1">
              These items may never be listed under any circumstances.
            </p>
          </div>
          <div className="p-6 space-y-3">
            {[
              {
                item: "Weapons, firearms, ammunition, explosives",
                detail: "Any item designed to cause harm",
              },
              {
                item: "Illegal drugs, controlled substances, drug paraphernalia",
                detail: "Regardless of jurisdiction",
              },
              {
                item: "Medical devices requiring prescription or professional supervision",
                detail: "Including insulin pens, CPAP machines, oxygen tanks",
              },
              {
                item: "Child car seats or child safety restraints",
                detail:
                  "Federal safety standards apply — defective seats cause fatalities",
              },
              {
                item: "Perishable food or FDA-regulated items",
                detail: "Food, beverages, supplements",
              },
              {
                item: "Items with active product safety recalls",
                detail: null,
              },
              {
                item: "Hazardous materials",
                detail: "Fuels, gas tanks, solvents, pesticides, paint",
              },
              {
                item: "Counterfeit or stolen property",
                detail: "Including pirated software and knockoff goods",
              },
              { item: "Biological materials or biohazard items", detail: null },
              {
                item: "Items requiring federal or state licensing to operate",
                detail: "Commercial-grade equipment, licensed instruments",
              },
              {
                item: "Motorized vehicles requiring registration",
                detail: "Cars, motorcycles, e-bikes over 750W",
              },
              { item: "Fireworks or pyrotechnic devices", detail: null },
            ].map(({ item, detail }) => (
              <div
                key={item}
                className="flex items-start gap-3 py-3 border-b border-inventory-100 last:border-0"
              >
                <span className="text-red-400 flex-shrink-0 mt-0.5">✕</span>
                <div>
                  <p className="text-sm font-medium text-inventory-900">
                    {item}
                  </p>
                  {detail && (
                    <p className="text-xs text-inventory-400 mt-0.5">
                      {detail}
                    </p>
                  )}
                </div>
              </div>
            ))}
            <a
              href="https://www.recalls.gov"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-red-600 font-medium hover:underline mt-2"
            >
              Check product safety recalls at recalls.gov
              <svg
                className="w-3 h-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          </div>
        </div>

        {/* Allowed With Responsibility */}
        <div className="glass rounded-3xl overflow-hidden">
          <div className="bg-blue-600 px-6 py-4">
            <div className="flex items-center gap-2">
              <span className="text-white text-lg">✅</span>
              <h2 className="font-display font-bold text-white">
                Allowed With Responsibility
              </h2>
            </div>
            <p className="text-blue-100 text-xs mt-1">
              These items are permitted but carry inherent risks. By listing or
              borrowing, you accept full responsibility for safe usage.
            </p>
          </div>
          <div className="p-6 space-y-3">
            {[
              {
                item: "Power tools",
                detail:
                  "Drills, circular saws, sanders, jigsaws, chainsaws, pressure washers",
              },
              {
                item: "Sporting equipment",
                detail:
                  "Bicycles, skis, snowboards, surfboards, camping stoves",
              },
              {
                item: "Kitchen appliances",
                detail:
                  "Pressure cookers, deep fryers, stand mixers, espresso machines",
              },
              {
                item: "Electronics and high-value items",
                detail: "Laptops, cameras, gaming consoles, projectors",
              },
            ].map(({ item, detail }) => (
              <div
                key={item}
                className="flex items-start gap-3 py-3 border-b border-inventory-100 last:border-0"
              >
                <span className="text-blue-400 flex-shrink-0 mt-0.5">✓</span>
                <div>
                  <p className="text-sm font-medium text-inventory-900">
                    {item}
                  </p>
                  <p className="text-xs text-inventory-400 mt-0.5">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The rule */}
        <div className="glass rounded-3xl p-6 border-l-4 border-accent">
          <p className="font-bold text-inventory-900 text-sm mb-2">The Rule</p>
          <p className="text-sm text-inventory-600 leading-relaxed italic">
            "Only list items a neighbor could pick up and use safely without any
            special training."
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-col gap-2 pb-4">
          <Link
            href="/policies/lending-agreement"
            className="text-sm text-accent hover:underline"
          >
            View Lending Agreement →
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-inventory-400 hover:text-inventory-600"
          >
            Back to Proxe
          </Link>
        </div>
      </div>
    </main>
  );
}
