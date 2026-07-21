# Architecture rules — DO NOT FORGET

## Two data tiers

### TIER 1 — RxDB sync (offline-capable, local-first)

Anything a user actively edits and needs offline: project, task, subtask (parent_task_id), channel,
message, message_reference, direct_message, direct_message_receipt, conversation, comment, note,
team, tag, project_tags, task_tags.

- Writes go through RxDB (`.insert()`, `.patch()`, `.remove()`) NOT `$fetch`/POST
- Reads are reactive RxDB subscriptions (`.$.subscribe()`) NOT `useQuery`/TanStack Query
- Each collection has a `*-sync.ts` composable using `replicateRxCollection`

### TIER 2 — TanStack Query + Supabase Realtime invalidation (NOT RxDB)

Online-only or auth-adjacent data: workspace, workspace_members, workspace_invite_request,
user_status, project_members, team_members.

- Writes use `$fetch` to API endpoint, then `queryClient.invalidateQueries(...)`
- Reads use `useQuery()` from `@tanstack/vue-query`
- Live updates via `*-realtime.ts` composables (Supabase channel → invalidateQueries)

### Cross-tier (Tier 1 tables referencing workspace_members.id)

task_assignees (member_id), tasks_activity (changed_by), channel_members (member_id),
message (author_id), message_reference: store only the workspace_members.id reference,
NEVER embed user profile data (username, email, avatar) into the RxDB document.
Resolve display info at the UI layer via the TanStack Query member list.

## Audit findings (2026-07-18)

### CORRECT — Tier 1 (RxDB sync, live)

| Table                   | Sync composable                       | RxDB collection          | Notes                              |
| ----------------------- | ------------------------------------- | ------------------------ | ---------------------------------- |
| project                 | `use-project-sync.ts`                 | `projects`               | ✅                                 |
| tasks                   | `use-task-sync.ts`                    | `tasks`                  | ✅                                 |
| channel                 | `use-channel-sync.ts`                 | `channels`               | ✅ public/private only, no DM      |
| channel_members         | `use-channel-member-sync.ts`          | `channel_members`        | ✅ member_id only, no user data ✅ |
| team                    | `use-team-sync.ts`                    | `teams`                  | ✅                                 |
| tag                     | `use-tag-sync.ts`                     | `tags`                   | ✅                                 |
| project_tags            | `use-project-tag-sync.ts`             | `project_tags`           | ✅                                 |
| task_tags               | `use-task-tag-sync.ts`                | `task_tags`              | ✅                                 |
| task_assignees          | `use-task-assignee-sync.ts`           | `task_assignees`         | ✅ member_id only, no user data    |
| tasks_activity          | `use-task-activity-sync.ts`           | `tasks_activity`         | ✅ changed_by only, no user data   |
| conversation            | `use-conversation-sync.ts`            | `conversations`          | NEW — isolated DM pairs            |
| direct_message          | `use-direct-message-sync.ts`          | `direct_messages`        | NEW — DM message body, no threads  |
| direct_message_receipt  | `use-direct-message-receipt-sync.ts`  | `direct_message_receipts`| NEW — per-DM delivery/read status  |
| comment                 | `use-comment-sync.ts`                 | `comments`               | NEW — polymorphic (task/project/note/subtask) |
| note                    | `use-note-sync.ts`                    | `notes`                  | NEW — standalone notes             |

### CORRECT — Tier 2 (TanStack Query + Realtime, no RxDB)

| Table                    | Query composable           | Realtime composable                 | Notes           |
| ------------------------ | -------------------------- | ----------------------------------- | --------------- |
| workspace                | `use-workspaces.ts`        | `use-workspaces-realtime.ts`        | ✅              |
| workspace_invite_request | `use-workspace-invites.ts` | `use-workspace-invites-realtime.ts` | ✅              |
| project_members          | `use-project-members.ts`   | `use-project-members-realtime.ts`   | ✅ No RxDB sync |
| team_members             | `use-team-members.ts`      | `use-team-members-realtime.ts`      | ✅ No RxDB sync |

## Toast convention — ALWAYS use `toast.promise` for async operations

Every user-triggered async operation (API call, sign-in, invite send, etc.) MUST use
`toast.promise()` so the user sees a loading state. The pattern:

```ts
function doSomething() {
  isBusy.value = true;
  const promise = $fetch("/api/...", { method: "POST", body: {} });
  toast.promise(promise, {
    loading: "Doing something...",
    success: (data) => data.message,
    error: (err: any) => err?.response?._data?.statusMessage ?? err?.message ?? "Fallback message",
    desc: "Optional success description",
    errorDesc: "Optional error description",
  });
  promise
    .then(() => {
      /* invalidate queries, navigate, etc. */
    })
    .catch(() => {}) // error toast already handled by toast.promise
    .finally(() => {
      isBusy.value = false;
    });
}
```

**Never** use `toast.success` / `toast.error` for async operations — only for sync
validation (e.g. "Email is required!") or reactive error watchers. Using both
`toast.promise` AND a separate `toast.success`/`toast.error` creates duplicate toasts.

The `error` field accepts a function `(err: unknown) => string` for extracting
dynamic error messages. `errorDesc` provides the error-state description (falls
back to `desc` if omitted).

### ❌ BUGS found and fixed (2026-07-21 — schema refactor + access control)

| Bug                                                                                           | File(s)                                                       | Fix                                                                                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| workspace_members has BOTH RxDB sync AND TanStack Query + Realtime                            | `use-workspace-member-sync.ts`                                | **Deleted file.** RxDB collection left registered (empty, harmless) for now. Tier 2 only. Also: `WorkspaceMemberDocType` stored `username` + `profile_picture_url` (denormalized user data) — removed with the sync.                                                   |
| user_status has BOTH RxDB sync AND TanStack Query + Realtime                                  | `use-user-status-sync.ts`                                     | **Deleted file.** RxDB collection left registered (empty, harmless) for now. Tier 2 only.                                                                                                                                                                              |
| Invite form uses `refreshNuxtData("workspace_team_invites")` which is a Nuxt key nobody reads | `invite-member-form.vue`                                      | **Fixed:** replaced with `queryClient.invalidateQueries({ queryKey: workspaceInvitesKey(workspaceId) })`                                                                                                                                                               |
| `useSidebarProjects` TanStack Query exists but is never consumed                              | `use-sidebar-projects.ts`, `use-sidebar-projects-realtime.ts` | Left in place (harmless). The `useSidebarProjectsRealtime` still runs and invalidates a key nobody reads — minor waste, not a bug. The actual sidebar reads projects from RxDB reactively via `workspace-nav-menu.vue` subscription, which is correct Tier 1 behavior. |
| Missing `toast` imports in new components                                                     | `invite-member-form.vue`, `invite-email-tags.vue`             | Fixed.                                                                                                                                                                                                                                                                 |
| Unsafe `!` assertion                                                                          | `add-member.vue`                                              | Fixed `workspace?.id!` → `workspace?.id ?? ''`.                                                                                                                                                                                                                        |
| All async toasts use `toast.success`/`toast.error` with no loading state                      | 21 .vue files across auth, workspace, onboarding, tables      | **Fixed:** replaced with `toast.promise()` so every user-triggered API call shows pending→success/error flow. Updated `toast.promise` to support `error` as function + `errorDesc`. Removed retry actions from error toasts.                                           |
| Message push 403 (wrong channel_id) — push handler sends all cached docs without filtering    | `use-message-sync.ts`                                         | Added `channel_id` filter to push handler rows                                                                                                                                                                                                                         |
| Reply thread duplicate in DMs — `onReply` called `generateId()` twice (different IDs)         | `conversations/[memberId]/index.vue`                          | Generate ID once, reuse in both RxDB insert and `$fetch` push                                                                                                                                                                                                          |
| Channel layout reply missing direct push safety net                                           | `workspace-channel.vue`                                       | Added `$fetch` push with shared ID (same pattern as DM page `onSend`)                                                                                                                                                                                                  |
| **DM privacy: all endpoints checked workspace membership only, never channel membership**     | `messages/pull.get.ts`, `messages/push.post.ts`, `messages/history.get.ts`, `channels/pull.get.ts`, `channel-members/pull.get.ts` | Added channel membership + author_id checks, scoped channel_members pull to current user, filtered DM channels out of channels pull |
| **DM isolation: DMs were stored as channels with `type='dm'` — shared `message` table**       | New: `conversation`, `direct_message`, `direct_message_receipt` tables + `conversations/dm.get.ts` | Moved DMs to dedicated tables with `@@unique(member_one_id, member_two_id)`. Updated DM page to use `direct_messages` RxDB collection and `useDirectMessageSync`. Old `channels/dm.get.ts` deleted.     |
| **Comments: `task_comment` and `project_comment` were separate tables with duplicate schema** | New: `app_comment` table with `entity_type` + `entity_id`    | Replaced with polymorphic `comment` table. Supports task, subtask, project, note entities. `parent_id` for nested replies. Old tables dropped in migration.                                             |
| **Missing notes support**                                                                     | New: `app_note` table + sync composable + API endpoints       | Added `note` entity with own table, RxDB collection, and polymorphic comment support.                                                                                                                   |

### ✅ Fixed (2026-07-18 — email resilience)

All 9 email action functions (`send-invite.ts`, `send-project-assignment.ts`, `send-task-assignment.ts`,
`completed-project.ts`, `completed-task.ts`, `workspace-welcome.ts`, `workspace-decline.ts`,
`unique-code-request.ts`, `join-waitlist.ts`) now log success/failure instead of throwing.
Email send failures no longer crash the API request — the DB write succeeds regardless.

### ⚠️ Open items (not yet fixed)

1. **RxDB collections for workspace_members and user_status still registered** in `rxdb.client.ts`. They stay empty (no sync composable runs). Safe, but should be removed in a future cleanup with an IndexedDB schema migration.
2. **No `useMutation` anywhere.** All Tier 2 writes (invite send, member remove, role change) use raw `$fetch`. Works correctly, but inconsistent with the TanStack Query pattern used for reads.
3. **Replication API endpoints** for workspace-members and user-status (`server/api/replication/workspace-members/`, `server/api/replication/user-status/`) still exist as dead code. Not imported by anything since the sync composables were deleted. Safe to remove later.
4. **Sidebar-projects realtime** (`use-sidebar-projects-realtime.ts`) subscribes to `app_project` changes and invalidates a key nobody reads. Not harmful, but wastes a Supabase channel connection.
5. **Old DM channel data in `app_channel`** — existing rows with `type='dm'` are orphaned. Migration drops no data. Cleanup can be done separately after confirming no active DMs use the old schema.
6. **No DM conversation list in sidebar** — sidebar lists all workspace members as DM targets. Existing conversations aren't shown as a separate list with unread badges. Future enhancement.

## Always enforce

- **Every change** must align with the two-tier architecture above.
- Tier 2 data: NEVER create an RxDB sync for it. Always use TanStack Query + Realtime invalidation.
- Tier 1 data: NEVER fetch it via `useQuery`/`$fetch` for reads — use reactive RxDB subscriptions.
- Writes: Tier 1 → RxDB methods; Tier 2 → `$fetch` to API + `invalidateQueries`.
- Denormalized user data in RxDB is forbidden. Only store `workspace_members.id` references.
