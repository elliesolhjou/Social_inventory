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

const XIcon = () => (
  <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-4 h-4 text-[#526442] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
  </svg>
);

const ShieldIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

export default function ProhibitedItemsPage() {
  const prohibitedItems = [
    { item: "Weapons, firearms, ammunition, explosives", detail: "Any item designed to cause harm" },
    { item: "Illegal drugs, controlled substances, drug paraphernalia", detail: "Regardless of jurisdiction" },
    { item: "Medical devices requiring prescription or professional supervision", detail: "Including insulin pens, CPAP machines, oxygen tanks" },
    { item: "Child car seats or child safety restraints", detail: "Federal safety standards apply — defective seats cause fatalities" },
    { item: "Perishable food or FDA-regulated items", detail: "Food, beverages, supplements" },
    { item: "Items with active product safety recalls", detail: null },
    { item: "Hazardous materials", detail: "Fuels, gas tanks, solvents, pesticides, paint" },
    { item: "Counterfeit or stolen property", detail: "Including pirated software and knockoff goods" },
    { item: "Biological materials or biohazard items", detail: null },
    { item: "Items requiring federal or state licensing to operate", detail: "Commercial-grade equipment, licensed instruments" },
    { item: "Motorized vehicles requiring registration", detail: "Cars, motorcycles, e-bikes over 750W" },
    { item: "Fireworks or pyrotechnic devices", detail: null },
  ];

  const allowedItems = [
    { item: "Power tools", detail: "Drills, circular saws, sanders, jigsaws, chainsaws, pressure washers" },
    { item: "Sporting equipment", detail: "Bicycles, skis, snowboards, surfboards, camping stoves" },
    { item: "Kitchen appliances", detail: "Pressure cookers, deep fryers, stand mixers, espresso machines" },
    { item: "Electronics and high-value items", detail: "Laptops, cameras, gaming consoles, projectors" },
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
            Prohibited Items Policy
          </h1>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* Intro */}
        <div className="bg-white border border-[#e6e2de]/50 rounded-2xl p-6 shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
          <p className="text-sm text-[#5b4038] font-['Be_Vietnam_Pro'] leading-relaxed">
            Proxe connects neighbors to share items they own. To keep our
            community safe, some items cannot be listed on the platform. Our
            policy is risk-based:{" "}
            <strong className="text-[#1c1b1a]">
              any item a neighbor could not pick up and use safely without
              special training is not permitted.
            </strong>
          </p>
          <p className="text-xs text-[#8f7067] font-['Be_Vietnam_Pro'] mt-3">
            Last updated: March 2026 &middot; Version 1.0
          </p>
        </div>

        {/* Absolutely Prohibited */}
        <div className="bg-white border border-[#e6e2de]/50 rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
          <div className="bg-red-600 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                </svg>
              </div>
              <div>
                <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-white text-lg">
                  Absolutely Prohibited
                </h2>
                <p className="text-red-100 text-xs font-['Be_Vietnam_Pro'] mt-0.5">
                  These items may never be listed under any circumstances.
                </p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-0">
            {prohibitedItems.map(({ item, detail }) => (
              <div
                key={item}
                className="flex items-start gap-3 py-3 border-b border-[#e6e2de]/50 last:border-0"
              >
                <XIcon />
                <div>
                  <p className="text-sm font-medium text-[#1c1b1a] font-['Be_Vietnam_Pro']">
                    {item}
                  </p>
                  {detail && (
                    <p className="text-xs text-[#8f7067] font-['Be_Vietnam_Pro'] mt-0.5">
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
              className="inline-flex items-center gap-1.5 text-xs text-red-600 font-['Plus_Jakarta_Sans'] font-bold hover:underline mt-4"
            >
              Check product safety recalls at recalls.gov
              <ExternalLinkIcon />
            </a>
          </div>
        </div>

        {/* Allowed With Responsibility */}
        <div className="bg-white border border-[#e6e2de]/50 rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
          <div className="bg-[#526442] px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <ShieldIcon />
              </div>
              <div>
                <h2 className="font-['Plus_Jakarta_Sans'] font-bold text-white text-lg">
                  Allowed With Responsibility
                </h2>
                <p className="text-green-100 text-xs font-['Be_Vietnam_Pro'] mt-0.5">
                  These items are permitted but carry inherent risks. By listing
                  or borrowing, you accept full responsibility for safe usage.
                </p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-0">
            {allowedItems.map(({ item, detail }) => (
              <div
                key={item}
                className="flex items-start gap-3 py-3 border-b border-[#e6e2de]/50 last:border-0"
              >
                <CheckIcon />
                <div>
                  <p className="text-sm font-medium text-[#1c1b1a] font-['Be_Vietnam_Pro']">
                    {item}
                  </p>
                  <p className="text-xs text-[#8f7067] font-['Be_Vietnam_Pro'] mt-0.5">
                    {detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* The Rule */}
        <div className="bg-white border border-[#e6e2de]/50 rounded-2xl p-6 border-l-4 border-l-[#ae3200] shadow-[0_10px_30px_rgba(0,0,0,0.02)]">
          <p className="font-['Plus_Jakarta_Sans'] font-bold text-[#1c1b1a] text-sm mb-2">
            The Rule
          </p>
          <p className="text-sm text-[#5b4038] font-['Be_Vietnam_Pro'] leading-relaxed italic">
            &quot;Only list items a neighbor could pick up and use safely without
            any special training.&quot;
          </p>
        </div>

        {/* Links */}
        <div className="flex flex-col gap-3 pt-2 pb-4">
          <Link
            href="/policies/lending-agreement"
            className="text-sm text-[#ae3200] font-['Plus_Jakarta_Sans'] font-bold hover:text-[#ff5a1f] transition-colors"
          >
            View Lending Agreement
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
