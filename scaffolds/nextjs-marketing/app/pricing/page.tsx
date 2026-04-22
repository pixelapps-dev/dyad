import Link from "next/link";

const TIERS = [
  {
    name: "Starter",
    price: "$0",
    cadence: "per month",
    description: "For tinkerers and first-time customers.",
    features: ["Up to 3 seats", "Community support", "Core features"],
    cta: "Start for free",
  },
  {
    name: "Team",
    price: "$49",
    cadence: "per seat / month",
    description: "For teams shipping their first $1M of revenue.",
    features: ["Unlimited seats", "Priority email support", "All features"],
    cta: "Book a demo",
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "",
    description: "For organisations with compliance needs.",
    features: ["SAML SSO", "Audit logs", "Dedicated CSM"],
    cta: "Talk to sales",
  },
];

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-24">
      <header className="max-w-2xl">
        <h1 className="text-4xl font-bold">Simple, predictable pricing</h1>
        <p className="mt-4 text-slate-600">
          Replace these tiers with your own. Don't forget to swap the CTAs
          once payment is wired in.
        </p>
      </header>
      <div className="mt-12 grid gap-6 md:grid-cols-3">
        {TIERS.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-2xl border p-6 ${
              tier.featured
                ? "border-brand-500 shadow-lg ring-1 ring-brand-500"
                : "border-slate-200"
            }`}
          >
            <h3 className="text-lg font-semibold">{tier.name}</h3>
            <p className="mt-1 text-slate-500">{tier.description}</p>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-4xl font-bold">{tier.price}</span>
              {tier.cadence && (
                <span className="text-slate-500">{tier.cadence}</span>
              )}
            </div>
            <ul className="mt-6 space-y-2 text-sm text-slate-600">
              {tier.features.map((f) => (
                <li key={f}>· {f}</li>
              ))}
            </ul>
            <Link
              href="/contact"
              className={`mt-8 block rounded-full px-5 py-2.5 text-center font-medium ${
                tier.featured
                  ? "bg-brand-600 text-white hover:bg-brand-700"
                  : "border border-slate-300 hover:bg-slate-100"
              }`}
            >
              {tier.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
