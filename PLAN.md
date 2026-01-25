# Frontend Migration Plan: TanStack Start → Next.js

## Overview

Migrate the reference frontend (TanStack Start + Tauri) to a Next.js App Router frontend that:

- Loads network presets from the Hono backend
- Displays flow networks with ReactFlow
- Generates forms for branch block properties based on schemas
- Runs evaluation operations (costing) via the backend

**NOT in scope**: File watching, TOML export, local filesystem operations (these were Tauri-specific)

---

## Current State

### Backend (Ready)

- Hono server on port 3001
- Routes:
  - `GET /api/network?network=preset1` - Load full network
  - `GET /api/network/list` - List available presets
  - `GET /api/network/nodes` - Get nodes
  - `GET /api/network/edges` - Get edges
  - `GET /api/network/assets/*` - Serve static assets
  - `GET /api/schema` - Get all schema sets
  - `GET /api/schema/:version` - Get schema for version
  - `GET /api/schema/network/validate` - Validate network blocks
  - `GET /api/schema/properties` - Get schema properties for blocks
  - `POST /api/operations/costing` - Run costing operation

### Frontend Files Copied to `src/`

```
src/
├── components/
│   ├── flow/
│   │   ├── flow-network.tsx       ✓ Has "use client"
│   │   └── nodes/
│   │       ├── branch.tsx         ✓ Needs form integration
│   │       ├── geographic-anchor.tsx
│   │       ├── geographic-window.tsx
│   │       ├── image.tsx
│   │       └── labeled-group.tsx
│   ├── operations/
│   │   ├── costing-operation-dialog.tsx
│   │   ├── operation-status-indicator.tsx
│   │   └── operations-list.tsx
│   ├── quantities/
│   │   ├── quantity-input.tsx     ✓ Key component for forms
│   │   ├── quantity-display.tsx
│   │   └── unit-select.tsx
│   ├── ui/                        ✓ shadcn components
│   ├── Header.tsx
│   └── command-dialog.tsx
├── contexts/
│   ├── dialog-provider.tsx
│   ├── dim-context.tsx            ✓ Unit conversion (WASM)
│   ├── keybind-provider.tsx
│   └── network-context.tsx
├── lib/
│   ├── api-client.ts              ⚠️ Uses @backend/index import
│   ├── api-proxy.ts               ⚠️ Uses VITE_API_URL
│   ├── api-types.ts               ⚠️ Uses @backend/index import
│   ├── collections/
│   │   ├── flow.ts                ✓ Has "use client", uses TanStack DB
│   │   ├── flow-nodes.ts
│   │   └── selected-nodes.ts
│   └── dim/                       ✓ Unit conversion utilities
│       ├── dim.ts
│       ├── use-dim.ts
│       └── use-dim-ready.ts
```

### What's Missing

- `src/lib/utils.ts` (cn function)
- Next.js App Router pages
- Provider setup in layout
- Path alias for `@backend`
- Environment variable update (VITE → NEXT_PUBLIC)
- Styles (ReactFlow CSS, brand colors)

---

## Migration Tasks

### Phase 1: Configuration & Setup

1. **Update tsconfig.json paths**
   - Add `@backend/*` path alias pointing to `../backend/src/*`
   - Current `@/*` points to `./*` (root) - may need to adjust to `./src/*`

2. **Update api-proxy.ts**
   - Change `VITE_API_URL` → `NEXT_PUBLIC_API_URL`
   - Remove `import.meta.env` references, use `process.env`

3. **Add missing utilities**
   - Create `src/lib/utils.ts` with `cn()` function

### Phase 2: App Router Structure

5. **Update `app/layout.tsx`**
   - Add providers: QueryClientProvider, DimProvider
   - Import global styles
   - Remove TanStack Router specific code from comments

6. **Create home page `app/page.tsx`**
   - List available presets from `/api/network/list`
   - Link to `/network/[networkId]`

7. **Create network page `app/network/[networkId]/page.tsx`**
   - Load network data (server component or client with useQuery)
   - Render FlowNetwork with sidebar
   - Wrap in NetworkProvider

### Phase 3: Component Fixes

8. **Fix api-client.ts imports**
   - The `@backend/index` import for Hono RPC types
   - May need to create local type definitions or adjust import path

9. **Fix dim context/hooks**
   - Ensure WASM loading works in Next.js
   - The dim.ts imports a WASM file - verify bundling works

10. **Adapt operations components**
    - Remove Tauri/file-watching dependencies
    - Update to work with API-only operations

### Phase 4: Form Generation

11. **Create schema-based form generator**
    - Fetch schema properties for a block type: `GET /api/schema/properties`
    - Generate form fields with QuantityInput for unit-based fields
    - Handle validation feedback

12. **Integrate forms into branch nodes**
    - Expand branch.tsx to show property forms
    - Use collapsible sections for each block
    - Connect to TanStack DB for state management

### Phase 5: Operations

13. **Connect costing operation**
    - Costing dialog sends network data to `/api/operations/costing`
    - Display results in sidebar

---

## File Changes Summary

| File                                   | Action                         |
| -------------------------------------- | ------------------------------ |
| `tsconfig.json`                        | Add `@backend/*` path          |
| `app/layout.tsx`                       | Add providers, update metadata |
| `app/page.tsx`                         | Replace with preset list       |
| `app/network/[networkId]/page.tsx`     | Create - network view          |
| `app/globals.css`                      | Add ReactFlow & brand styles   |
| `src/lib/utils.ts`                     | Create - cn() utility          |
| `src/lib/api-proxy.ts`                 | Update env var names           |
| `src/lib/api-client.ts`                | Fix backend import path        |
| `src/lib/api-types.ts`                 | Fix backend import path        |
| `src/components/flow/nodes/branch.tsx` | Add form integration           |

---

## Dependencies Check

Current `package.json` has:

- `@xyflow/react` ✓
- `@tanstack/react-query` ✓
- `@tanstack/react-db` ✓
- `hono` (dev) ✓ - needed for RPC types
- Radix UI components ✓
- `lucide-react` ✓

May need to add:

- Nothing major - dependencies look complete

---

## Questions / Decisions

1. **Path alias**: Should `@/*` point to `./src/*` or stay as `./*`?
   - Currently `@/*` → `./*` means `@/lib/...` works from root
   - The copied files use `@/` prefix consistently

2. **Server vs Client Components**:
   - Network page could fetch data server-side then hydrate
   - Or use client-side only with TanStack Query
   - Recommendation: Client-side with Query for consistency with existing code

3. **Form state management**:
   - TanStack DB collections already handle node state
   - Forms update block properties in the collection
   - Changes are local until explicitly synced (no file writing in this version)

---

## Execution Order

1. Configuration (tsconfig, env vars, utils)
2. Layout (providers)
3. Home page (preset list)
4. Network page (basic flow view)
5. Fix any import/runtime errors
6. Form generation
7. Operations integration
