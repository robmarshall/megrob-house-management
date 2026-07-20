# MCP Server Plan

**Status:** Planned — not started
**Last updated:** 2026-07-20
**Goal:** Expose recipes, meal plans, and shopping lists to Claude via a remote MCP server, so a logged-in user can say "add the stir-fry ingredients to my list" from claude.ai.

---

## 1. Decisions made

| Decision | Choice | Why |
|---|---|---|
| Auth | OAuth 2.1 via Better Auth's `mcp` plugin | MCP-spec standard; per-user revocable tokens; works with claude.ai custom connectors |
| Target client | claude.ai web/mobile (custom connector) | Primary use case; also works from Claude Code/Desktop for free |
| Transport | Streamable HTTP | Required by claude.ai; SSE transport is deprecated |
| Server location | Mounted on the existing Hono backend at `/api/mcp` | No second deployment; same DB pool; same origin as auth |
| Tool → logic path | Tools call extracted service functions directly | No internal HTTP round-trips; routes and tools share one implementation |

### Why not cookies directly

MCP clients are not the browser and never see the session cookie. Instead, the OAuth
authorize step happens *in* the browser, where the Better Auth session cookie already
lives — so a logged-in user just approves the connection without re-entering a password.
The MCP client then holds its own per-user tokens.

### Auth flow (end to end)

1. User adds `https://api.megrob.uk/api/mcp` as a custom connector in claude.ai.
2. claude.ai fetches `/.well-known/oauth-protected-resource` and
   `/.well-known/oauth-authorization-server` from `api.megrob.uk`.
3. claude.ai registers itself via Dynamic Client Registration
   (`${BETTER_AUTH_URL}/mcp/register`).
4. Browser opens the authorize endpoint → existing session cookie authenticates the
   user (or they land on the frontend login page and bounce back) → consent → tokens
   issued (authorization code + PKCE, refresh token supported).
5. MCP requests carry a bearer token; `withMcpAuth` resolves it to a session, giving
   the same `userId` that `authMiddleware` provides today. All existing access checks
   (`verifyShoppingListAccess`, household scoping) apply unchanged.

---

## 2. Verified facts (checked against the `better-auth@1.4.18` tarball, 2026-07-20)

- The `mcp` plugin ships in **the `better-auth/plugins` barrel** — there is no
  `better-auth/plugins/mcp` subpath export in 1.4.18.
- It supports **DCR** (`registration_endpoint: ${baseURL}/mcp/register`), the
  **refresh_token grant**, `withMcpAuth`, `oAuthDiscoveryMetadata`, and
  `oAuthProtectedResourceMetadata` (the newer discovery doc claude.ai checks).
- The plugin reuses the **OIDC-provider schema** (OAuth application / access token /
  consent tables) → requires a new Drizzle migration.
- Docs note the mcp plugin is "soon to be deprecated in favor of the OAuth Provider
  plugin." Irrelevant while pinned to 1.4.18; **revisit on any better-auth upgrade.**
- `megrob.uk` (frontend) and `api.megrob.uk` (backend) are same-site → the session
  cookie rides along on top-level navigation to the authorize endpoint. No
  cross-site cookie work needed.

---

## 3. Architecture

```
claude.ai ──HTTPS──▶ api.megrob.uk (Hono)
                       ├─ /.well-known/oauth-*           (new, public, root-mounted)
                       ├─ /api/auth/*                    (Better Auth + mcp plugin)
                       │    └─ /api/auth/mcp/register|authorize|token
                       ├─ /api/mcp                       (new: @hono/mcp Streamable HTTP)
                       │    └─ withMcpAuth → userId → service functions → Drizzle
                       └─ /api/... (existing REST routes, unchanged)
```

**New dependencies** (pin exact versions — Coolify builds `backend/` in isolation
without the root lockfile, so caret ranges re-resolve on every build):
- `@modelcontextprotocol/sdk`
- `@hono/mcp`

**Service extraction:** most business logic currently lives inline in route handlers.
Extract a service function per endpoint the MCP surface needs (pattern already exists:
`services/shoppingListItemService.ts`). Routes and MCP tools both call the service.
Extract incrementally — only what each phase needs, no big-bang refactor.

**Input validation:** reuse the Zod schemas in `backend/src/lib/validation.ts` as MCP
tool input schemas (the MCP SDK accepts Zod natively). Single source of truth.

---

## 4. Tool surface

Kept small and task-shaped. **Deliberately no whole-list or whole-recipe deletes** —
low upside, highest regret if the model misfires.

### Shopping lists (Phase 2)
| Tool | Notes |
|---|---|
| `list_shopping_lists` | Names, ids, item counts — no full item dumps |
| `get_shopping_list` | Items for one list; paginated, trimmed fields |
| `add_shopping_list_items` | **Batch**; routes through `addOrMergeItem` so "milk" twice merges instead of duplicating |
| `update_shopping_list_item` | Covers check-off, quantity, notes |
| `remove_shopping_list_item` | Single item only |

### Recipes (Phase 3)
| Tool | Notes |
|---|---|
| `search_recipes` | Summary shape only (id, name, categories) |
| `get_recipe` | The only "full detail" call |
| `create_recipe` | Full ingredient/category nesting via existing schemas |
| `update_recipe` | |

### Meal plans + composite (Phase 4)
| Tool | Notes |
|---|---|
| `get_meal_plan` | Week view |
| `set_meal_plan_entry` | |
| `remove_meal_plan_entry` | |
| `add_recipe_to_shopping_list` | The high-value composite: plan dinner → ingredients on the list in one call |

**Response size rule:** every list-returning tool caps and paginates. Full detail only
on single-entity `get_*` calls. Big responses bloat Claude's context and degrade the
assistant, not just the wire.

---

## 5. Phases

### Phase 0 — OAuth schema migration (own PR, deployed first)
- [x] Add the OIDC-provider tables to `db/auth-schema.ts` (shapes dumped directly
      from the mcp plugin's schema declaration in the installed better-auth@1.4.18;
      export names match the plugin's model names for adapter lookup)
- [x] `npm run db:generate` → migration `0011_lovely_mimic.sql` (new tables only,
      no drift on existing tables; full chain 0000–0011 verified against a clean
      postgres:17-alpine container; 341 backend tests pass)
- [x] Ship through the GitHub Actions migrate workflow (`deploy-migrations.yml`)
      — PR #1 merged 2026-07-20, workflow run #16 green
- [x] Verify tables exist in prod via Coolify DB terminal — all three tables
      present, journal row 12 recorded
- ⚠️ Prod migration journal is baselined at 0010 after the db:push incident — no
  ad-hoc migration paths, CI only.

### Phase 1 — Spike the pipe (smallest possible surface)
- [x] Add `better-auth` mcp plugin (`loginPage` → `${FRONTEND_URL}/login`)
- [x] Mount `/.well-known/oauth-authorization-server` and
      `/.well-known/oauth-protected-resource` at the Hono root, including
      RFC 9728 path-suffixed variants (`.../api/mcp`)
- [x] Mount `/api/mcp` via `@hono/mcp` + MCP SDK, stateless mode, one read-only tool:
      `list_shopping_lists` (service extracted to `services/shoppingListService.ts`)
- [x] Frontend: LoginForm resumes the OAuth flow — top-level navigation back to
      the authorize endpoint when OAuth params are in the login URL, with a
      session re-check on error (the plugin's after-hook can hijack the sign-in
      XHR into a cross-origin redirect)
- [x] Local smoke: discovery docs, 401 challenge with `WWW-Authenticate`,
      authorize→login redirect (curl against dev server), plus a DB-backed
      integration suite (`routes/mcp.test.ts`) covering token auth and the tool
      call end-to-end through the transport
- [x] Deploy and connect from claude.ai for real — connector "Megrob House"
      added 2026-07-20; DCR + authorize auto-approved via live session, no login
      page needed; `list_shopping_lists` verified returning real prod data.
      Coolify proxies `/.well-known/*` fine; no `trustedOrigins` change needed.
- [x] **Spike answers (from reading the 1.4.18 source):**
  - Consent: auto-approved when no `consentPage` is configured (even
    `prompt=consent` falls through) → no consent UI needed. Adding the
    connector in claude.ai is the consent act.
  - `trustedOrigins`: redirect URIs are validated against the DCR-registered
    client, not `trustedOrigins`; no change needed locally. Confirm on the
    first real claude.ai connect.
  - Coolify `/.well-known/*` passthrough: still to confirm at deploy.
  - **Found + mitigated:** `getMcpSession` in 1.4.18 never checks
    `accessTokenExpiresAt` — expired tokens would still authenticate. Our
    `/api/mcp` route enforces expiry itself (covered by a test).

### Phase 2 — Shopping list tools
- [x] Extract services for get-items / update-item / remove-item
      (`shoppingListItemService.ts`; routes refactored to share them)
- [x] Implement the 5 shopping-list tools (get_shopping_list,
      add_shopping_list_items w/ merge, update_shopping_list_item,
      remove_shopping_list_item + existing list_shopping_lists)
- [x] Per-user rate limiting on `/api/mcp` (`createKeyedRateLimiter`, 60/min
      per userId — not per-IP)
- [x] Every MCP tool call logged with `via: "mcp"` + userId + tool name

### Phase 3 — Recipe tools
- [x] Extract recipe services (`recipeService.ts`: verifyRecipeAccess,
      searchRecipes, getRecipeDetail, createRecipe, updateRecipe; routes
      refactored to share them); implement search_recipes, get_recipe,
      create_recipe, update_recipe

### Phase 4 — Meal plans + composite
- [ ] The 3 meal-plan tools + `add_recipe_to_shopping_list`

---

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Prod migration journal is fragile (baselined at 0010) | Phase 0 is its own PR through CI migrate; verify in prod before any MCP code |
| Consent-screen scope unknown | Answered empirically in Phase 1 spike before committing frontend scope |
| Anthropic egress uses shared IPs → per-IP rate limiting throttles the whole client | Rate-limit `/api/mcp` per authenticated user, not per IP; existing limiter is in-memory/per-IP so this needs a variant |
| Coolify isolated backend build re-resolves caret ranges | Pin exact versions for all new deps (established convention) |
| mcp plugin deprecated in future better-auth versions | Pinned at 1.4.18; migration to OAuth Provider plugin is a contained swap (tool layer unaffected); note in upgrade checklist |
| Agent loops hammering the API | Rate limits + batch-shaped tools (`add_shopping_list_items`) reduce call counts |
| Token bloat from big tool responses | Trimmed shapes + pagination caps (Section 4 rule) |
| claude.ai can't reach localhost | Tunnel for dev E2E; MCP Inspector for tool-level testing without OAuth |

## 7. Out of scope (for now)

- Whole-list / whole-recipe delete tools
- Recipe **import** via MCP — imports queue through pg-boss, and the worker process
  is not wired up as a Coolify resource in prod; revisit if/when the worker is deployed
- API-key auth path (rejected in favor of OAuth; tool layer wouldn't change if revisited)
- MCP resources/prompts (tools only, initially)
