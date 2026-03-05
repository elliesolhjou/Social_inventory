import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center min-h-[80vh] px-6 text-center overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-20 -left-32 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-10 -right-32 w-80 h-80 bg-accent-light/15 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "3s" }}
        />

        <div className="relative z-10 max-w-3xl animate-slide-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent-muted border border-accent/20 text-accent-dark text-sm font-medium mb-8">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse-soft" />
            Now live at The Meridian
          </div>

          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight text-inventory-950 mb-6 text-balance">
            Share what you own.
            <br />
            <span className="text-accent">Borrow what you need.</span>
          </h1>

          <p className="text-lg md:text-xl text-inventory-500 max-w-xl mx-auto mb-10">
            Your building is full of amazing things collecting dust. The Social
            Inventory connects neighbors to share gear, build trust, and save
            money
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/dashboard"
              className="px-8 py-3.5 bg-inventory-950 text-white rounded-2xl font-display font-semibold text-lg hover:bg-inventory-800 transition-colors"
            >
              Enter your building →
            </Link>
            <Link
              href="#how-it-works"
              className="px-8 py-3.5 border-2 border-inventory-200 text-inventory-700 rounded-2xl font-display font-semibold text-lg hover:border-inventory-400 transition-colors"
            >
              How it works
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-24 max-w-5xl mx-auto">
        <h2 className="font-display text-3xl md:text-4xl font-bold text-center mb-16">
          Three steps. Zero awkwardness.
        </h2>

        <div className="grid md:grid-cols-3 gap-8 animate-stagger">
          {[
            {
              step: "01",
              title: "Magic Upload",
              desc: "Record a 5-second video. Our AI identifies the item, writes the description, and captures its condition — automatically.",
              icon: "📸",
            },
            {
              step: "02",
              title: "Trust Handshake",
              desc: "When you pick up an item, snap a photo. AI compares it against the original to protect both sides. No disputes, no drama.",
              icon: "🤝",
            },
            {
              step: "03",
              title: "AI Mediator",
              desc: "If something goes wrong, our AI analyzes the evidence, suggests a fair resolution, and handles the micro-payment. Done.",
              icon: "⚖️",
            },
          ].map((step) => (
            <div key={step.step} className="glass rounded-3xl p-8 card-hover">
              <span className="text-4xl mb-4 block">{step.icon}</span>
              <span className="font-mono text-xs text-accent font-bold tracking-widest">
                STEP {step.step}
              </span>
              <h3 className="font-display text-xl font-bold mt-2 mb-3">
                {step.title}
              </h3>
              <p className="text-inventory-500 text-sm leading-relaxed">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Building Intelligence teaser */}
      <section className="px-6 py-24 bg-inventory-950 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <span className="font-mono text-xs text-accent tracking-widest">
            BUILDING INTELLIGENCE
          </span>
          <h2 className="font-display text-3xl md:text-4xl font-bold mt-4 mb-6">
            Your building has a brain.
          </h2>
          <p className="text-inventory-400 text-lg max-w-2xl mx-auto mb-12">
            We analyze every transaction in your building to surface what&apos;s
            trending, what&apos;s missing, and who you can trust. The more you
            share, the smarter it gets.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: "Active Items", value: "50" },
              { label: "Residents", value: "20" },
              { label: "Transactions", value: "80" },
              { label: "Community Health", value: "82%" },
            ].map((stat) => (
              <div key={stat.label} className="glass-dark rounded-2xl p-6">
                <div className="font-display text-3xl font-bold text-accent">
                  {stat.value}
                </div>
                <div className="text-sm text-inventory-400 mt-1">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 text-center text-inventory-400 text-sm">
        <p>The Social Inventory — MVP v0.1.0</p>
        <p className="mt-1">Powered by Ellie Solhjou</p>
      </footer>
    </main>
  );
}
