import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#fdf9f5]">
      {/* ── Top Navigation ─────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#fdf9f5]">
        <nav className="flex justify-between items-center w-full px-6 md:px-8 py-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-black text-[#ae3200] font-display">
              Proxe
            </Link>
            <div className="h-6 w-px bg-[#e4beb3]/30 hidden md:block" />
            <span className="hidden md:block text-[#5b4038] font-medium text-sm tracking-wide">
              Sustainable Community Living
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-[#5b4038] font-medium hover:text-[#ff5a1f] transition-colors duration-200">
              How it Works
            </a>
            <a href="#trust" className="text-[#5b4038] font-medium hover:text-[#ff5a1f] transition-colors duration-200">
              Safety
            </a>
            <a href="#community" className="text-[#5b4038] font-medium hover:text-[#ff5a1f] transition-colors duration-200">
              Community
            </a>
            <Link
              href="/auth"
              className="text-[#ae3200] font-semibold hover:underline underline-offset-4 transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth"
              className="bg-[#ff5a1f] text-white px-6 py-2.5 rounded-full font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-[#ff5a1f]/20"
            >
              Join Your Building
            </Link>
          </div>
          {/* Mobile menu */}
          <div className="flex md:hidden items-center gap-3">
            <Link
              href="/auth"
              className="bg-[#ff5a1f] text-white px-5 py-2 rounded-full font-bold text-sm"
            >
              Join
            </Link>
          </div>
        </nav>
        <div className="h-px w-full bg-[#f1edea]" />
      </header>

      {/* ── Hero Section ───────────────────────────────────────── */}
      <section className="pt-28 pb-16 md:pt-32 md:pb-24 max-w-7xl mx-auto px-6 md:px-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center min-h-[90vh]">
        <div className="lg:col-span-7 space-y-6 md:space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 bg-[#d2e6bc]/30 rounded-full border border-[#526442]/10">
            <span className="text-[#526442] font-bold text-xs tracking-widest uppercase">
              Sustainable Community Living
            </span>
          </div>

          {/* Headline */}
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.08] tracking-tight">
            <span className="text-[#ae3200]">Borrow from your neighbors.</span>
            <br />
            <span className="text-[#1c1b1a]">Share what you own.</span>
          </h1>

          {/* Subtext */}
          <p className="text-[#5b4038] text-lg md:text-xl lg:text-2xl max-w-2xl leading-relaxed">
            Unlock the &ldquo;dark inventory&rdquo; of your building. From high-end
            kitchenware to essential tools, activate the shared potential of your
            community.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 md:gap-6 pt-2 md:pt-4">
            <Link
              href="/auth"
              className="bg-[#ff5a1f] text-white px-8 md:px-10 py-4 md:py-5 rounded-full font-bold text-base md:text-lg shadow-lg shadow-[#ff5a1f]/20 hover:scale-[1.02] active:scale-95 transition-all w-full sm:w-auto text-center"
            >
              Join Your Building
            </Link>
            <Link
              href="/auth"
              className="text-[#ae3200] font-bold text-base md:text-lg hover:underline underline-offset-8"
            >
              Already a member? Sign In
            </Link>
          </div>

          {/* Social proof */}
          <div className="pt-6 md:pt-8 flex items-center gap-4 md:gap-6">
            <div className="flex -space-x-3">
              {["bg-[#ae3200]", "bg-[#526442]", "bg-[#4e4ccf]"].map((bg, i) => (
                <div
                  key={i}
                  className={`w-10 h-10 md:w-12 md:h-12 rounded-full border-4 border-[#fdf9f5] ${bg} flex items-center justify-center text-white font-bold text-xs`}
                >
                  {["E", "M", "S"][i]}
                </div>
              ))}
            </div>
            <div>
              <p className="font-bold text-[#1c1b1a] text-sm md:text-base">12,400+ neighbors</p>
              <p className="text-[#5b4038] text-xs md:text-sm">sharing items today</p>
            </div>
          </div>
        </div>

        {/* Hero image */}
        <div className="lg:col-span-5 relative mt-8 lg:mt-0">
          <div className="rounded-2xl md:rounded-3xl overflow-hidden aspect-[4/5] shadow-2xl relative bg-[#e6e2de]">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ae3200]/10 via-transparent to-[#526442]/10" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-8">
                <span className="text-8xl block mb-6">🏢</span>
                <p className="font-display font-bold text-2xl text-[#1c1b1a]/60">Your Building</p>
                <p className="text-[#5b4038]/60 text-sm mt-2">Add your building photo here</p>
              </div>
            </div>
            <div className="absolute inset-0 bg-gradient-to-t from-[#ae3200]/30 to-transparent mix-blend-multiply" />
          </div>

          {/* Miles AI teaser overlay */}
          <div className="absolute -bottom-6 md:-bottom-8 -left-4 md:-left-8 right-4 md:right-8 backdrop-blur-xl bg-[#f1edea]/80 p-5 md:p-8 rounded-2xl shadow-xl border border-white/30">
            <div className="flex items-start gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-[#526442] to-[#d2e6bc] rounded-full flex items-center justify-center text-white shrink-0">
                <span className="text-lg md:text-xl">✦</span>
              </div>
              <div className="space-y-1">
                <h4 className="font-display font-bold text-[#526442] text-sm md:text-lg">Miles AI Assistant</h4>
                <p className="text-[#5b4038] leading-snug italic text-xs md:text-base">
                  &ldquo;Need a drill for those shelves? Your neighbor Sarah in 4B has one to lend.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust Indicators ───────────────────────────────────── */}
      <section id="trust" className="mt-24 md:mt-40 bg-[#f7f3ef] py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center mb-10 md:mb-16 space-y-3 md:space-y-4">
            <h2 className="font-display font-extrabold text-3xl md:text-4xl text-[#1c1b1a]">
              Built on Community Trust
            </h2>
            <p className="text-[#5b4038] text-base md:text-lg max-w-xl mx-auto">
              We&apos;ve designed Proxe to feel as safe as lending to your best friend.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-12">
            {[
              {
                icon: "🛡️",
                title: "Vetted Neighbors",
                desc: "Every member is identity-verified and lives within your specific residential complex.",
              },
              {
                icon: "🔒",
                title: "Protection Deposits",
                desc: "Automated security deposits protect every transaction, ensuring your items return safely.",
              },
              {
                icon: "⭐",
                title: "Trust Scores",
                desc: "Transparency is key. View peer-reviewed trust scores before you agree to any exchange.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-white p-8 md:p-10 rounded-2xl md:rounded-3xl space-y-4 border border-[#e6e2de]/50 hover:shadow-lg transition-shadow duration-300"
              >
                <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-[#ae3200]/10 flex items-center justify-center text-2xl md:text-3xl mb-4 md:mb-6">
                  {item.icon}
                </div>
                <h3 className="font-display font-bold text-lg md:text-xl">{item.title}</h3>
                <p className="text-[#5b4038] leading-relaxed text-sm md:text-base">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-7xl mx-auto px-6 md:px-8 py-20 md:py-32">
        <div className="text-center mb-10 md:mb-16 space-y-3 md:space-y-4">
          <div className="inline-flex items-center px-4 py-2 bg-[#ae3200]/5 rounded-full">
            <span className="text-[#ae3200] font-bold text-xs tracking-widest uppercase">How It Works</span>
          </div>
          <h2 className="font-display font-extrabold text-3xl md:text-4xl text-[#1c1b1a]">
            Three steps. Zero awkwardness.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {[
            {
              step: "01",
              title: "Magic Upload",
              desc: "Take a photo. Miles AI identifies the item, writes the description, suggests pricing, and captures condition — automatically.",
              icon: "📸",
              accent: "bg-[#ff5a1f]",
            },
            {
              step: "02",
              title: "Trust Handshake",
              desc: "Deposits protect both sides. When you pick up an item, the system holds the deposit until safe return. No disputes, no drama.",
              icon: "🤝",
              accent: "bg-[#526442]",
            },
            {
              step: "03",
              title: "AI Concierge",
              desc: "Miles finds what you need, broadcasts requests to neighbors, detects damage on returns, and handles payouts. Your building's AI assistant.",
              icon: "✦",
              accent: "bg-[#4e4ccf]",
            },
          ].map((step) => (
            <div
              key={step.step}
              className="bg-white rounded-2xl md:rounded-3xl p-6 md:p-8 border border-[#e6e2de]/50 hover:shadow-lg transition-all duration-300 group"
            >
              <div className={`w-12 h-12 ${step.accent} rounded-2xl flex items-center justify-center text-white text-xl mb-5 group-hover:scale-110 transition-transform`}>
                {step.icon}
              </div>
              <span className="font-mono text-xs text-[#ae3200] font-bold tracking-widest">
                STEP {step.step}
              </span>
              <h3 className="font-display text-lg md:text-xl font-bold mt-2 mb-3">
                {step.title}
              </h3>
              <p className="text-[#5b4038] text-sm leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bento Lifestyle Grid ───────────────────────────────── */}
      <section id="community" className="max-w-7xl mx-auto px-6 md:px-8 pb-20 md:pb-32">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-8 md:h-[600px]">
          {/* Large card */}
          <div className="md:col-span-8 relative rounded-2xl md:rounded-3xl overflow-hidden group bg-[#e6e2de] min-h-[300px] md:min-h-0">
            <div className="absolute inset-0 bg-gradient-to-t from-[#1c1b1a]/80 via-[#1c1b1a]/20 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center opacity-30">
              <span className="text-[120px]">🍽️</span>
            </div>
            <div className="absolute bottom-6 md:bottom-10 left-6 md:left-10 right-6 md:right-10">
              <h3 className="font-display font-bold text-2xl md:text-3xl text-white mb-2">
                Dinner parties made easy.
              </h3>
              <p className="text-white/80 max-w-md text-sm md:text-base">
                Borrowed a pasta maker from 3C and a stand mixer from 5A for the
                perfect weekend feast.
              </p>
            </div>
          </div>

          {/* Right column */}
          <div className="md:col-span-4 grid grid-rows-2 gap-4 md:gap-8">
            {/* Sustainability card */}
            <div className="bg-[#d2e6bc] rounded-2xl md:rounded-3xl p-6 md:p-8 flex flex-col justify-between">
              <span className="text-4xl md:text-5xl">🌿</span>
              <div className="space-y-2 mt-4">
                <h4 className="font-display font-bold text-[#3b4c2c] text-xl md:text-2xl">Less Waste</h4>
                <p className="text-[#3b4c2c]/80 font-medium text-sm md:text-base">
                  Reduce your footprint by sharing resources instead of buying new.
                </p>
              </div>
            </div>

            {/* Stats card */}
            <div className="bg-[#ff5a1f] rounded-2xl md:rounded-3xl p-6 md:p-8 flex flex-col justify-end relative overflow-hidden">
              <div className="absolute top-4 right-4 md:top-6 md:right-6 text-white/20 text-6xl md:text-7xl font-display font-black">
                800+
              </div>
              <p className="text-white font-bold text-lg md:text-xl relative z-10">
                Active in 800+ complexes
              </p>
              <p className="text-white/70 text-xs md:text-sm mt-1 relative z-10">
                Growing every day
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Spectrum Pricing Teaser ────────────────────────────── */}
      <section className="bg-[#1c1b1a] py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center mb-10 md:mb-16 space-y-3 md:space-y-4">
            <span className="font-mono text-xs text-[#ff5a1f] tracking-widest">
              SPECTRUM PRICING
            </span>
            <h2 className="font-display font-extrabold text-3xl md:text-4xl text-white">
              Borrow. Rent. Buy. Your choice.
            </h2>
            <p className="text-[#a09a91] text-base md:text-lg max-w-2xl mx-auto">
              Every item on Proxe can have up to three pricing modes. AI suggests
              the right price based on market data and condition.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 max-w-3xl mx-auto">
            {[
              { mode: "Borrow", price: "Free", sub: "+ refundable deposit", color: "bg-emerald-500", border: "border-emerald-500/30" },
              { mode: "Rent", price: "$15/day", sub: "or $55/month", color: "bg-blue-500", border: "border-blue-500/30" },
              { mode: "Buy", price: "$200", sub: "yours to keep", color: "bg-[#ff5a1f]", border: "border-[#ff5a1f]/30" },
            ].map((item) => (
              <div key={item.mode} className={`rounded-2xl md:rounded-3xl border ${item.border} bg-white/5 p-6 md:p-8 text-center backdrop-blur-sm`}>
                <div className={`w-10 h-10 md:w-12 md:h-12 ${item.color} rounded-full mx-auto mb-4 flex items-center justify-center`}>
                  <span className="text-white text-lg md:text-xl font-bold">
                    {item.mode[0]}
                  </span>
                </div>
                <h3 className="font-display font-bold text-white text-lg md:text-xl">{item.mode}</h3>
                <p className="font-display font-extrabold text-2xl md:text-3xl text-white mt-2">{item.price}</p>
                <p className="text-[#a09a91] text-xs md:text-sm mt-1">{item.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Building Intelligence Stats ────────────────────────── */}
      <section className="py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="text-center mb-10 md:mb-16 space-y-3 md:space-y-4">
            <span className="font-mono text-xs text-[#526442] tracking-widest uppercase">
              Building Intelligence
            </span>
            <h2 className="font-display font-extrabold text-3xl md:text-4xl text-[#1c1b1a]">
              Your building has a brain.
            </h2>
            <p className="text-[#5b4038] text-base md:text-lg max-w-2xl mx-auto">
              Every transaction makes your community smarter. Miles learns what your
              building needs and surfaces it proactively.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { label: "Active Items", value: "80", icon: "📦" },
              { label: "Neighbors", value: "23", icon: "👥" },
              { label: "Transactions", value: "50+", icon: "🤝" },
              { label: "Waste Avoided", value: "142 kg", icon: "🌿" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-8 text-center border border-[#e6e2de]/50 hover:shadow-lg transition-shadow"
              >
                <span className="text-2xl md:text-3xl block mb-2 md:mb-3">{stat.icon}</span>
                <div className="font-display text-2xl md:text-4xl font-extrabold text-[#ae3200]">
                  {stat.value}
                </div>
                <div className="text-xs md:text-sm text-[#5b4038] mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 md:px-8 pb-20 md:pb-32">
        <div className="bg-gradient-to-br from-[#ae3200] to-[#ff5a1f] rounded-2xl md:rounded-3xl p-8 md:p-16 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative z-10">
            <h2 className="font-display font-extrabold text-2xl md:text-4xl text-white mb-3 md:mb-4">
              Ready to unlock your building&apos;s potential?
            </h2>
            <p className="text-white/80 text-base md:text-lg max-w-lg mx-auto mb-6 md:mb-8">
              Join thousands of neighbors who are already sharing, saving money, and
              building community.
            </p>
            <Link
              href="/auth"
              className="inline-block bg-white text-[#ae3200] px-8 md:px-10 py-3.5 md:py-4 rounded-full font-display font-bold text-base md:text-lg hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
            >
              Get Started — It&apos;s Free
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="bg-[#f7f3ef] py-10 md:py-16">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 md:gap-8">
            <div>
              <span className="text-2xl font-black text-[#ae3200] font-display">Proxe</span>
              <p className="text-[#5b4038] text-sm mt-1">Sustainable Community Living</p>
            </div>
            <div className="flex flex-wrap gap-4 md:gap-8">
              <Link href="/support" className="text-[#5b4038] text-sm hover:text-[#ae3200] transition-colors">Support</Link>
              <Link href="/policies" className="text-[#5b4038] text-sm hover:text-[#ae3200] transition-colors">Policies</Link>
              <Link href="/disputes" className="text-[#5b4038] text-sm hover:text-[#ae3200] transition-colors">Disputes</Link>
            </div>
          </div>
          <div className="h-px bg-[#e6e2de] my-6 md:my-8" />
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
            <p className="text-[#8f7067] text-xs">© 2026 Proxe Technologies LLC · Mountain View, CA</p>
            <p className="text-[#8f7067] text-xs">Built by Ellie Solhjou · USC Computer Science</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
