# Performance Baseline & Audit Report

> Baseline captured: 2026-06-30 | Optimizations applied: same day
> Branch: `perf/audit`

## Build Time Comparison

| Metric | Before (Phase 1) | After (Phase 7) | Change |
|--------|:-:|:-:|:-:|
| Client (Vite) | **57.1s** | **52.6s** | **-8%** |
| Server SSR (Vite) | **13.6s** | **15.1s** | +11% (variance) |
| Nitro | ~45–55s | ~45–55s | Unchanged |
| **Total** | **~2min** | **~2min** | Marginal |

## Bundle Size — Client (unchanged large chunks)

> Largest chunks come from `@unovis/ts` (charts lib `nuxt-charts` depends on).
> These are already code-split from the entry chunk.

| Chunk | Size | Gzip | Source |
|-------|------|------|--------|
| `elk.bundled.js` | **1,419.88 kB** | 432.99 kB | ELK layout engine (charting) |
| `index14.js` | **1,251.60 kB** | 260.35 kB | Unknown aggregate |
| `entry.js` | **747.21 kB** → **349 kB** | 223 kB → 125 kB | Nuxt entry (reduced by removing lottie) |
| `TopoJSONMap.js` | **690.03 kB** | 213.09 kB | TopoJSON map (charting) |
| `vue-chrts.js` | **265.59 kB** | 106.49 kB | nuxt-charts / @unovis/vue |
| `workspace.js` | **145.54 kB** | 35.29 kB | Workspace pages |
| `entry.css` | **122.84 kB** | 21.96 kB | Tailwind CSS v4 |

## Optimizations Applied

### Phase 2 — Build/Dev Speed
- Removed `shamefully-hoist=true` from `.npmrc` (deprecated, causes npm warnings)

### Phase 3 — Bundle Size
- Removed `vue3-lottie` + `lottie-web` (unused dep, 17 kB, eval warning)
- Deleted 6 unused lottie animation components + their plugin
- Build time improved from 57.1s → 52.6s (~8%)

### Phase 4 — Assets
- Removed 6 orphaned lottie JSON animation files (564 KB)
- Removed unused Regarn font (woff file + CSS variable + nuxt config)

### Phase 5 — Data Fetching
- **Aligned cache keys** between Sidebar, MobileSidebar, SearchCommand:
  - `'mobile_workspaces'` → `'workspaces'`
  - `'mobile_sidebar_projects_{id}'` → `'sidebar_projects_{id}'`
  - `'search_bar_sidebar_projects_{id}'` → `'sidebar_projects_{id}'`
- Prevents duplicate API calls when multiple components fetch the same data

### Phase 6 — DB Queries
- **Added indexes** on all foreign key columns across 12 tables (high impact)
- **Optimized overall stats**: 3 separate COUNT queries → single GROUP BY
- **Parallelized email sends**: `await` in loops → `Promise.all()` in 3 endpoints

## Remaining Warnings

- `@tailwindcss/vite:generate:build` sourcemap warnings (cosmetic, no performance impact)
- `punycode` deprecation (Node.js built-in, benign)
- `nuxt-site-config` localhost URL (expected in dev)
- Peer dependency warnings (Nuxt 4 with pre-release ecosystem, non-blocking)

## Recommendations Not Implemented

1. **Nuxt Icon SSR bundle** — 15 icon collections = 44 MB server chunks. Switch to `mode: 'svg'` to serve icons individually on demand. Medium impact on cold starts.
2. **N+1 query fix in invite accept/cancel** — Loops over invites with per-row DB queries. Requires logic refactor.
3. **Add pagination** to task/project list endpoints (`limit`/`offset`). Could break UI if not tested.
4. **Chart library LCP optimization** — 2 MB of charting deps (elkjs + topojson) load on dashboard pages. Consider lazy-loading chart components.
5. **Switch to `@vercel/analytics`** for RUM-based performance monitoring beyond Lighthouse.
