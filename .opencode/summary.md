# Session Summary

## Goal
- Nuxt 4 migration completed and merged; performance audit in progress.

## Constraints & Preferences
- Work on `perf/audit` branch; commit after each phase with before/after measurements.
- Measure first, change second. Do not optimize things that aren't actually slow.
- Use `npx nuxi analyze`, Lighthouse, `time` commands for baseline numbers.
- No speculative changes; every change must have a measured impact.
- Do not break SSR, features, or meaningfully increase complexity for marginal gains.

## Progress
### Done
- **Nuxt 4 migration** completed — Nuxt `4.4.8`, Nitro `2.13.4`, Vite `7.3.6`, Vue `3.5.39`.
- **Directory restructure:** `assets/`, `components/`, `layouts/`, `middleware/`, `pages/`, `plugins/`, `stores/`, `composables/`, `modals/`, `providers/`, `lib/`, `data/` → `app/`. `types/` split into `shared/types/` (server-safe) + `app/types/` (Vue re-exports).
- **White-screen bug:** Fixed all 10 workspace pages — `workspaceStore.activeWorkspace?.id` in `useAsyncData` URLs replaced with `route.params.workspaceId` + `watch`.
- **Polar SDK removed entirely** (`@polar-sh/nuxt`, `@polar-sh/sdk`, API routes, DB table, migration to drop `polar_customers`).
- **Sidebar/MobileSidebar:** guarded navigateTo against undefined workspace IDs.
- **Missing component imports:** `Plus` icon in dashboard, `OnboardingProvider` in onboarding layout.
- **`defineOgImageComponent` → `defineOgImage`** across all 16 pages.
- **SSR auth fix:** `WeeklyTasksProductivity` uses `useRequestFetch` instead of raw `$fetch` for 401 fix.
- **All fixes squashed** into single commit `d6444b6` on `main`.
- **Charts fix:** `to-px` was missing from pnpm hoisted `node_modules` (required by `@unovis/ts` → `nuxt-charts`). Added as explicit dep.

### In Progress
- Performance audit (Phases 1–7)

### Blocked
- `vue-tsc` cannot be installed via pnpm (network timeout); `pnpm typecheck` unavailable.

## Key Decisions
- `to-px@1.1.0` added to `package.json` as explicit dependency to resolve `nuxt-charts` rendering with pnpm.

## Next Steps
1. Create `perf/audit` branch from `main`.
2. Phase 1: Capture baseline measurements (build time, dev cold start, bundle analyze, Lighthouse on 3 pages) into `PERF_BASELINE.md`.
3. Phases 2–7: Execute sequentially.
4. Final: Deploy Vercel preview, deliver report.
