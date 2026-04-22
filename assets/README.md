# Assets

## Required follow-up: replace branded binary icons

- `assets/icon/logo.png`, `assets/icon/logo.ico`, `assets/icon/logo.icns` are
  still the upstream Dyad binary icons. **They must not ship in any released
  Pagemate build** — Dyad Tech, Inc. retains trademark on the original logo
  per `NOTICE`, even though the code is Apache-2.0.
- `assets/logo.svg` has been replaced with a neutral "Pm" placeholder
  wordmark. A real logo and icon set need to land before a public release.

## Regeneration notes

When the new icons are ready:

- **Windows** needs a multi-resolution `.ico` (16, 32, 48, 64, 128, 256 px).
- **macOS** needs an `.icns` built from a 1024×1024 PNG via
  `iconutil -c icns <asset>.iconset`.
- **Linux** needs a 512×512 `.png` for the installer + menu entry.

See `forge.config.ts` for the exact paths each target reads from.

## Third-party AI provider logos

`assets/ai-logos/` contains the logos for the AI providers Pagemate surfaces
in the model picker (OpenAI, Anthropic, Google, etc.). Those are third-party
trademarks displayed under fair-use for a multi-provider UI — no rebrand is
needed there.
