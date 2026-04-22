# Pagemate

Pagemate is a local, open-source B2B website builder built on top of a
clean-room AI agent stack. It's a fork of [Dyad](https://github.com/dyad-sh/dyad)'s
Apache-2.0 core with the Functional-Source-Licensed "Pro" carve-out removed and
rewritten natively against the Vercel AI SDK's tool-calling protocol.

## Features

- **Local-first**: runs as an Electron desktop app — no sign-up, no phone-home.
- **Bring your own keys**: plug in OpenAI / Anthropic / Google / OpenRouter /
  xAI / Bedrock / Azure, plus optional Tavily / Firecrawl / Exa for web search
  and OpenAI / Stability for image generation.
- **Integrations**: GitHub, Vercel, Supabase, Neon — all first-class.
- **Apache-2.0** throughout. No competing-use restrictions.

## Download

No sign-up required. The fork does not yet publish signed binaries; build from
source via `pnpm install && pnpm start` (or run the `make` / `publish` scripts
from a signed CI pipeline — see `forge.config.ts`).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Apache 2.0 — see [LICENSE](./LICENSE) and [NOTICE](./NOTICE).

## Fork notes

See [FORK.md](./FORK.md) for the relationship to upstream Dyad, what was
removed with the FSL carve-out, and the replacement-subsystem tree at
`src/agent/`.
