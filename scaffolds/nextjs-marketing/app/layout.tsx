import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Your B2B product",
  description: "Replace with a one-line pitch the prospect can grok in 3 seconds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased text-slate-900 bg-white">
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="text-lg font-semibold">
              Your product
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/pricing" className="hover:text-brand-600">
                Pricing
              </Link>
              <Link href="/about" className="hover:text-brand-600">
                About
              </Link>
              <Link href="/contact" className="hover:text-brand-600">
                Contact
              </Link>
              <Link
                href="/contact"
                className="rounded-full bg-brand-600 px-4 py-1.5 font-medium text-white hover:bg-brand-700"
              >
                Book a demo
              </Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-24 border-t border-slate-200 py-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 text-sm text-slate-500">
            <span>© {new Date().getFullYear()} Your Company, Inc.</span>
            <div className="flex gap-4">
              <Link href="/privacy" className="hover:text-slate-900">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-slate-900">
                Terms
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
