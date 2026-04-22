import Link from "next/link";

const FEATURES = [
  {
    title: "Ship in minutes",
    body: "Prebuilt marketing primitives — hero, pricing, testimonials, FAQ — so your first page is live before the coffee cools.",
  },
  {
    title: "Built for B2B",
    body: "Lead capture, gated demos, and pricing copy tuned for enterprise buyers, not consumers.",
  },
  {
    title: "Stay in control",
    body: "No vendor lock-in. Pure Next.js + Tailwind + TypeScript — host on Vercel, Cloudflare, or your own box.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
            For B2B teams
          </p>
          <h1 className="mt-4 text-5xl font-bold tracking-tight sm:text-6xl">
            Win revenue with a website that actually sells.
          </h1>
          <p className="mt-6 text-lg text-slate-600">
            A Next.js marketing starter for product teams who need to ship a
            landing page, pricing, and a demo form without stitching ten
            plugins together.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/contact"
              className="rounded-full bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
            >
              Book a demo
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-slate-300 px-5 py-2.5 font-medium hover:bg-slate-100"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6 grid gap-8 md:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-slate-600">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h2 className="text-3xl font-bold">
          Ready to turn traffic into pipeline?
        </h2>
        <p className="mt-4 text-slate-600">
          Replace this call-to-action with your own. The rest of the page is
          yours to design.
        </p>
        <Link
          href="/contact"
          className="mt-8 inline-block rounded-full bg-brand-600 px-6 py-3 font-medium text-white hover:bg-brand-700"
        >
          Book a demo
        </Link>
      </section>
    </>
  );
}
