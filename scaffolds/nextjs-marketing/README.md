# Pagemate — Next.js marketing starter

A minimal Next.js 15 App Router + Tailwind marketing site, wired up
for Pagemate's B2B website-builder workflow.

## What's in the box

- `app/page.tsx` — hero + three-column feature grid + CTA
- `app/pricing/page.tsx` — three-tier pricing table with one highlighted plan
- `app/about/page.tsx` — placeholder about copy
- `app/contact/page.tsx` — lead-capture form posting to `/api/lead`
- `app/api/lead/route.ts` — echoes the form payload; replace with your CRM
- `app/not-found.tsx` — 404
- Tailwind + brand colour tokens (`brand.{500,600,700}`)

## Running locally

```sh
pnpm install
pnpm dev
```

## Replacing the starter copy

Every line of copy in this scaffold is placeholder text. The Pagemate
agent is the intended consumer: it reads this structure, then replaces
the strings with copy tailored to the prospect's industry and ICP.

## Deploying

`next.config.ts` is set to `output: "standalone"`, so the build
produces a self-contained `.next/standalone` bundle that runs on
Node without Next's runtime server. Vercel's default output works
too — nothing is Vercel-specific.

## Component tagger

`package.json` lists `@pagemate/nextjs-webpack-component-tagger` as a
devDependency. If you publish that package after forking, keep it —
it lets the in-app preview highlight and edit components by source
location.
