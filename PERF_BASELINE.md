# Performance Baseline

> Captured: 2026-06-30 on `perf/audit` branch (commit to be added after Phase 1)

## 1. Build Time

| Phase | Duration |
|-------|----------|
| Client (Vite) | **57.1s** (dev build: 57.1s) |
| Server SSR (Vite) | **13.6s** |
| Nitro preset (node-server) | ~**45–55s** (not measured precisely) |
| **Total** | **~2min** |

## 2. Bundle Size — Client (production)

### Largest chunks (>500 kB warning threshold)

| Chunk | Size | Gzip | Likely Source |
|-------|------|------|---------------|
| `elk.bundled.js` | **1,419.88 kB** | 432.99 kB | DnD Kit / ELK layout engine |
| `index14.js` | **1,251.60 kB** | 260.35 kB | Unknown aggregate |
| `entry.js` | **747.21 kB** | 223.25 kB | Nuxt entry |
| `TopoJSONMap.js` | **690.03 kB** | 213.09 kB | Map/topology library |
| `vue-chrts.js` | **265.59 kB** | 106.49 kB | nuxt-charts / @unovis/vue |
| `workspace.js` | **145.54 kB** | 35.29 kB | Workspace pages |
| `index11.js` | **117.55 kB** | 29.97 kB | Unknown |
| `index23.js` | **104.57 kB** | 33.51 kB | Unknown |

### CSS

| Chunk | Size | Gzip |
|-------|------|------|
| `entry.css` | **122.84 kB** | 21.96 kB |

### Total client JS: **~8.5 MB** total, ~**2.6 MB** gzip

## 3. Dev Server — Cold Start

- Not measured (requires interactive session)
- ~3,500 modules, 15 icon collections discovered at startup

## 4. Server Bundle (Nitro output)

### Largest server chunks

| Chunk | Size | Gzip |
|-------|------|------|
| `icons14.mjs` | **8.58 MB** | 1.42 MB |
| `icons8.mjs` | **7.26 MB** | 2.66 MB |
| `icons13.mjs` | **6.42 MB** | 1.05 MB |
| `icons3.mjs` | **4.63 MB** | 1.57 MB |
| `icons11.mjs` | **4.52 MB** | 943 kB |
| `icons6.mjs` | **4.12 MB** | 1.11 MB |
| `workspace.mjs` (build chunk) | **848 kB** | 71.6 kB |
| `nitro.mjs` | **431 kB** | 98.5 kB |

**Total server size:** 1.9 GB (471 MB gzip)

### Key observation
Server icon chunks are **extremely large** (15 icon collections, most unused in SSR). The `shamefully-hoist` config is generating unknown npm config warning.

## 5. Warnings

- **618×** `@tailwindcss/vite:generate:build` sourcemap warnings (client + server)
- **1×** `nuxt:module-preload-polyfill` sourcemap warning
- **1×** `lottie-web` uses `eval()` (17 kB chunk for animations)
- **1×** `punycode` deprecation warning (Node.js built-in)
- **1×** `nuxt-site-config` localhost URL warning
- **1×** npm "shamefully-hoist" will stop working in next major version

## 6. Modules Transformed

- Client: **6,097 modules**
- Server SSR: **1,232 modules**

## 7. Icon Collections (Nuxt Icon — 15 collections)

akar-icons, ant-design, devicon, heroicons, hugeicons, ic, iconamoon, logos, lucide, mdi, ph, radix-icons, solar, twemoji, uis
