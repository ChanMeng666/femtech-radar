# Design System & Branding

This document is the **authoritative, current** description of the FemTech Radar visual identity.
It supersedes the CSS shown in the point-in-time implementation plan
[`docs/superpowers/plans/2026-06-30-femtech-radar-astro-site.md`](superpowers/plans/2026-06-30-femtech-radar-astro-site.md)
(which describes the original rose/pink design that has since been rebranded).

## Intent

FemTech Radar (Unit ③) is a product **under the FemTech Weekend organization**. As of 2026-07-01 its
visual identity was deliberately rebranded to match the parent site
[`femtech-weekend-website`](https://femtech-weekend.com) — a warm-brown, "McKinsey editorial" brand —
so the Radar reads as part of the same org. The parent brand mark now appears in the site header and
footer.

**When the parent brand changes, this is the doc to reconcile against.** The source of truth for the
parent palette/typography is `femtech-weekend-website/src/css/custom.css` and
`tailwind.config.js`.

## Where it lives (the whole design system is small and centralized)

| Concern | File |
|---|---|
| **All design tokens + component styles** | `site/src/styles/global.css` (single vanilla-CSS file, `:root` variables) |
| Header logo + wordmark, footer brand mark, font wiring | `site/src/layouts/BaseLayout.astro` |
| Section eyebrow label + numbered heading | `site/src/components/SectionBlock.astro` |
| Card markup (styled entirely from `global.css`) | `site/src/components/RadarCard.astro` |
| Browser-tab favicon (brand-brown radar mark) | `site/public/favicon.svg` |
| FemTech Weekend logo mark (header + footer) | `site/public/brand/femtech-weekend-logo.svg` |

There is **no Tailwind, no CSS framework, and no dark mode** — light mode only, plain CSS custom
properties. To restyle the site you almost always edit only `global.css`.

## Design tokens (from `site/src/styles/global.css` `:root`)

### Color

| Token | Value | Use |
|---|---|---|
| `--bg` / `--surface` | `#ffffff` | page + card background |
| `--ink` | `#2a2320` | primary text (warm near-black) |
| `--muted` | `#595959` | secondary text, nav, meta (brand secondary gray) |
| `--brand` | `#aa7c52` | primary brand brown — links, logo wordmark, hovers |
| `--brand-dark` | `#996f49` | chips/badges text, footer links |
| `--brand-soft` | `rgba(170,124,82,.10)` | editor-note bg, score/tag chip bg |
| `--accent` | `#cb997e` | section-title underline, editor-note left border |
| `--border` | `#e8ded4` | warm hairline borders |
| `--footer-bg` | `#f5eee8` | cream footer background |

### Section accents (4 curated sections — on-brand but distinguishable)

| Section | Token | Value |
|---|---|---|
| Industry | `--industry` | `#c17a3f` (warm copper) |
| Research | `--research` | `#8b6542` (deep brown) |
| Opportunities | `--opportunities` | `#6b9e78` (brand success green) |
| Discussions | `--discussions` | `#7ba7c2` (brand info blue) |

These map to the parent brand's support palette (`success`/`warning`/`info` families) rather than the
original bright rainbow, keeping every section warm and on-brand while remaining scannable.

### Typography

- **Headings** (`--font-serif`): `Georgia, 'Times New Roman', serif`, weight **400**,
  `letter-spacing: -.02em`, `line-height: 1.15` — the editorial "display" voice.
- **Body** (`--font-sans`): `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, …` — system stack,
  `line-height: 1.6`.
- **Eyebrow labels** (`.label` / `.section-label`): system sans, weight 500, **uppercase**,
  `letter-spacing: .15em`, `.72rem`.
- **Meta / chips**: `ui-monospace` stack.

> The old design used the self-hosted `@fontsource/fraunces` + `@fontsource/inter` webfonts. The
> rebrand dropped those imports (Georgia + system stack need no download). The `@fontsource/*` packages
> remain listed in `site/package.json` **only** to avoid a `--frozen-lockfile` CI mismatch; they are no
> longer imported and are not bundled. Remove them only together with a lockfile update.

### Shape & depth

- `--radius: 0` — **sharp / zero border-radius everywhere** (the brand's signature editorial look).
  This includes cards, chips, the editor note, and the section marker square.
- `--shadow: 0 1.5px 3px 0 rgb(0 0 0 / 15%)`; `--shadow-hover: 0 3px 6px 0 rgb(0 0 0 / 20%)`.
- Cards lift on hover (`translateY(-2px)` + border → `--brand` + `--shadow-hover`).

## Key component patterns

- **Header** — brand logo mark (`/brand/femtech-weekend-logo.svg`, 26px) + Georgia "FemTech Radar"
  wordmark on the left; uppercase, letter-spaced nav (Latest / Archive / Sources / RSS) on the right.
- **Section** — a numbered uppercase eyebrow (`01 · INDUSTRY`) with a small square color marker, above
  a Georgia section title underlined in `currentColor` at 55% opacity.
- **Editor note** — warm `--brand-soft` callout with a 3px `--accent` left border.
- **Cards** — sharp white cards, warm border, brand shadow, brand-brown serif title, square meta chips.
- **Footer** — cream (`--footer-bg`) band with the FemTech Weekend mark + wordmark and an explicit
  "FemTech Radar is part of FemTech Weekend" attribution linking to https://femtech-weekend.com.

## Brand assets

- `site/public/brand/femtech-weekend-logo.svg` — the FemTech Weekend logo **mark** (two-color: gray
  `#595959` + warm brown `#D6AB93`). Copied from
  `femtech-weekend-website/static/img/logo/femtech_weekend_logo_new.svg`. Shown in the site header and
  footer.
- `site/public/favicon.svg` — the product's radar-sweep mark, recolored to brand brown `#aa7c52`.
- `.github/brand/femtech-weekend-logo.svg` — the full brand **lockup** (mark + wordmark), used as the
  README hero. Copied from `…/femtech_weekend_logo_new_with_brand.svg`.

To refresh any of these, re-copy from `femtech-weekend-website/static/img/logo/` and keep the filenames
above so the references in `BaseLayout.astro` / `README.md` keep resolving.

## Keeping it in sync

1. Treat `femtech-weekend-website` as the upstream brand source. If its primary brown, accent, or logo
   changes, update the tokens in `site/src/styles/global.css` and this doc together.
2. Every internal asset link must go through `withBase()` (Pages base path is `/femtech-radar`) — the
   logo/favicon references in `BaseLayout.astro` already do.
3. After any visual change, verify with `pnpm --filter femtech-radar-site build` +
   `… exec astro check`, then a local `preview` screenshot of `/`, `/archive`, and `/week/[week]`.
