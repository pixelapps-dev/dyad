import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-md px-6 py-24 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
        404
      </p>
      <h1 className="mt-4 text-4xl font-bold">Page not found</h1>
      <p className="mt-4 text-slate-600">
        That link didn't lead anywhere. Try one of these:
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link href="/" className="text-brand-600 hover:underline">
          Home
        </Link>
        <Link href="/pricing" className="text-brand-600 hover:underline">
          Pricing
        </Link>
        <Link href="/contact" className="text-brand-600 hover:underline">
          Contact
        </Link>
      </div>
    </section>
  );
}
