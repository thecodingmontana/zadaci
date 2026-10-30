# Zadaci

Zadaci is a collaborative project and task manager for teams. Plan projects in the view that suits the work, keep docs and meeting notes next to them, and share exactly what each person should see.

Live at [zadaci.vercel.app](https://zadaci.vercel.app).

## Features

- **Workspaces** with roles (Owner, Admin, Member, Guest), email invites, invite links and teams. Setting one up takes a few short steps (pick as many use cases as fit), and leaving halfway picks up where you stopped.
- **Projects** with board, list, table, calendar, timeline, files and activity views, saved views, statuses, leads and private or workspace-wide sharing.
- **Tasks** with subtasks, assignees, priorities, labels, due and start dates, estimates, dependencies, repeating tasks, comments with @mentions and reactions, attachments, favorites and bulk edits.
- **My Tasks, Inbox and Notifications**, plus a workspace activity feed and a command menu (`Ctrl/⌘ K`).
- **Assistant** (`Ctrl/⌘ J` or the sparkle in the top bar): a side drawer with one saved chat per workspace that you can clear. Ask it what's due, or tell it to create, update, assign, move, tag, comment, plan projects, edit notes or save bookmarks. It works only through your own permissions, shows each step it takes ("Thinking… Worked for 7s") with the items it found, lists the tasks, projects and notes it touched so you can open them, and asks before deleting, archiving or changing more than 3 tasks. Type `@` to point it at a project, task or note. It sticks to work in the workspace and politely declines anything else. Runs on shared free OpenRouter models (2 messages a day per person), rotating between them when one is busy. In **Settings → AI assistant** people connect their own Claude, ChatGPT, Gemini or OpenRouter key, pick a model, and use it as much as they like; keys are checked with the provider, encrypted and tied to their account, and never shown again.
- **AI agents (MCP):** connect Claude Code, Cursor, Codex, VS Code or any MCP client to Zadaci and it works as you: `claude mcp add --transport http zadaci https://zadaci.vercel.app/api/mcp`. The first time, your browser opens, you sign in and approve it ("Claude Code wants to use Zadaci as you"). The agent then uses Zad's tools (find, list, create, update, assign, move, comment, plan projects, notes, bookmarks, time tracking) with exactly your role in each workspace, and what it does is yours, shown live to your team. It learns what Zadaci is when it connects. Tokens last 10 minutes and only work for `/api/mcp`; disconnect an agent in **Settings → Sessions → Connected apps** and it stops at once.
- **Chat:** Slack-style team chat on its own page, with a slide-out list on phones.
  - **Conversations:** open and private channels, a #general everyone joins, one channel per team, direct messages (and notes to yourself), and a chat for any project or task, opened in a side panel from the project or the task. A project's and its tasks' chats include exactly whoever can see the project: people added to it are in at once, people taken off it are out (their messages stay).
  - **Messages:** threads, reactions, edits, @mentions (they land in the Inbox with "Open in chat"), one pinned message per conversation shown under the header, files and images (uploaded only when you press send), voice notes, and live cards for shared tasks, projects, notes and bookmarks, each shown only as far as the reader can see it.
  - **Sidebar:** Pinned, Favourites, Channels, Teams and Direct messages, each foldable, with unread counts and a ⋯ menu to pin, favourite, mark read, copy a link or delete.
  - **Live:** messages and the typing line arrive without reloading, and green dots and "N online" show who's around. Messages you send while offline wait in order and go out when you're back, with Retry and Discard if one fails.
- **Live updates:** when anyone changes something (you in another tab, a teammate, or Zad), everyone with that workspace open sees it right away, without reloading. The server sends a tiny "this workspace changed" ping through Supabase Realtime (no data), and each browser refreshes what's on screen through the normal signed-in API. Browsers connect to Supabase directly, so it works on Vercel's serverless functions.
- **Reminders and digests:** due-soon and overdue reminders, a morning email digest at the hour you choose in your own time zone, and web push notifications on desktop and phone.
- **Time tracking** on tasks, **public read-only share links** for projects and notes, and **import and export** of workspace data.
- **Your data** (Settings → Your data): download everything that's yours as one JSON file, or delete your account. Deleting removes your name, email, photo, sign-ins, private notes and bookmarks, and AI keys and chats; work you shared stays with your team as "Deleted user". Workspaces where you're the only member go with you; one you own with other people has to be handed over first.
- **Notes**, Notion-style:
  - **Pages:** nest pages inside pages to group them, drag to reorder, star them, and make them private.
  - **Editor:** a Tiptap editor with a `/` block menu and a block handle (`+` and drag).
  - **Blocks:** headings, lists, to-dos, quotes, callouts, toggles, tables, images, YouTube and embeds (Vimeo, Loom, Figma, CodePen, Spotify, Google Maps), and code blocks highlighted by Shiki.
  - **Covers:** from a colour gallery, an upload, a link or Unsplash.
  - **Saving:** autosave that never overwrites someone else's newer edit.
- **Bookmarks:** paste a link and its title, description and image fill in. File it in collections (shared with the workspace, private, or linked to a project), tag it, star or archive it, and filter by type (article, document, video), tag or search in a grid or list.
- **Sign-in** with Google, an emailed sign-in link (single use, expires in 10 minutes) or a passkey. Optional two-step verification with an authenticator app, which every sign-in method respects.
- **Settings** for appearance (light, dark, accent, density, motion), language, date and time, notifications, profile, sessions and security.
- **Pictures** for your profile and workspace: upload one (the server squares and compresses it to WebP with sharp before it goes to Cloudinary), or **Choose avatar** from generated avatars or Unsplash photos. Attachments: images up to 5 MB, videos 20 MB, other files 25 MB.
- Light and dark themes, responsive layout with a mobile bottom nav.

## Tech stack

| Area | Tools |
|---|---|
| App | [TanStack Start](https://tanstack.com/start) (React 19, TanStack Router), Vite, Nitro |
| API | GraphQL Yoga, Apollo Client 4, request limits with graphql-armor |
| Data | PostgreSQL (Supabase), Drizzle ORM and drizzle-kit migrations |
| Auth | Better Auth (Google, email sign-in links, passkeys, TOTP two-step) |
| Editor | Tiptap 3, Shiki, Novel-style global drag handle |
| UI | Tailwind CSS 4, Radix UI, Motion, Iconify icons (Solar, Hugeicons, Logos) |
| Files and email | Cloudinary (signed uploads), Resend with React Email, Web Push |
| AI | TanStack AI with OpenRouter free models, or people's own Claude, OpenAI, Gemini or OpenRouter keys; AI persistence in Postgres |
| Quality | Biome, TypeScript, Node's built-in test runner |

## Getting started

You need Node 22 or newer, pnpm and a Postgres database.

```bash
pnpm install
cp .env.example .env.local   # then fill it in
pnpm db:migrate              # create the tables
pnpm dev                     # http://localhost:3000
```

### Environment variables

| Name | Required | What it is |
|---|---|---|
| `DATABASE_URL` | yes | Postgres connection string. On Supabase, use the pooler (port 6543). |
| `BETTER_AUTH_URL` | yes | Address the app runs at, e.g. `http://localhost:3000`. |
| `BETTER_AUTH_SECRET` | yes | A long random string for signing sessions. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | yes | Google OAuth app for sign-in. |
| `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` | yes | For attachments, logos, covers and note images. |
| `RESEND_API_KEY` | no | Sends invite, notification and sign-in-link emails. Leave empty to skip sending; in development the sign-in link is printed in the terminal instead. |
| `VITE_SITE_URL` | no | Public address for canonical links, the sitemap and emails. Defaults to `https://zadaci.vercel.app`. |
| `UNSPLASH_ACCESS_KEY` | no | Turns on the Unsplash tab in image pickers. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | no | Web push notifications. Generate with `npx web-push generate-vapid-keys`. |
| `CRON_SECRET` | no | Protects `/api/cron/daily` (hourly reminders and digests) and `/api/ai/models`. Any long random string. |
| `OPENROUTER_API_KEY` | no | Turns on the assistant. Server only; get one at [openrouter.ai/keys](https://openrouter.ai/keys). Without it the rest of the app works and the assistant says it isn't set up. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | no | Live updates, live chat and who's online, through Supabase Realtime (Project Settings → API). Without them, pages still refresh when you open them. |
| `REALTIME_PRIVATE`, `SUPABASE_SECRET_KEY` | no | `REALTIME_PRIVATE=1` makes Realtime channels private, so only people with access can listen. Turn it on once Supabase trusts Zadaci's sign-in tokens (Authentication → Third-Party Auth → Custom OIDC, issuer = `BETTER_AUTH_URL`) and Realtime's "Allow public access" is off. The secret key stays on the server. |
| `AUTH_JWT_ISSUER` | no | Local only, with `REALTIME_PRIVATE` on: the deployed site's address, so live chat and who's online work from localhost. Leave empty in production. |
| `AI_MODEL` | no | Pin one model id and turn rotation off. |
| `AI_MODEL_PREFERRED` | no | Comma-separated model name fragments to try first, e.g. `nemotron,gemma`. |
| `AI_ROTATION_PROBE` | no | `true` sends a tiny test request to the top models when the ranking refreshes (uses free quota). |
| `AI_DAILY_LIMIT` | no | Free messages a day for people without their own AI key (default 2). |
| `AI_KEYS_SECRET` | with the assistant | Encrypts people's own AI keys (AES-256-GCM). Keep it out of the database and don't change it once keys are saved. Make one with `openssl rand -base64 48`. |
| `APP_URL` | no | Address sent to OpenRouter as the referrer. Defaults to the site address. |

## Scripts

| Command | What it does |
|---|---|
| `pnpm dev` | Run the app on port 3000 |
| `pnpm build` / `pnpm preview` | Build for production and preview the build |
| `pnpm check` / `pnpm lint` / `pnpm format` | Biome checks, lint and formatting |
| `pnpm test` | Run the test suite (see below) |
| `pnpm db:generate` | Create a migration from schema changes in `src/db` |
| `pnpm db:migrate` | Apply migrations to `DATABASE_URL` |
| `pnpm db:studio` | Browse the database with Drizzle Studio |
| `pnpm email` | Preview the email templates on port 3001 |
| `pnpm generate-routes` | Regenerate `src/routeTree.gen.ts` |

## Tests

The tests call the GraphQL API against a real database, so point them at a separate one:

```bash
DATABASE_URL=postgres://…/zadaci_test pnpm db:migrate
DATABASE_URL=postgres://…/zadaci_test pnpm test
```

They cover permissions and sharing, tasks, projects, members and invites, notes, bookmarks and safe link previews, the note document sanitizer, embeds and covers, reminders and digests, push, time tracking, share links, import, team chat (access, mentions, shares, pins, project and task chats), workspace setup, AI agent sign-in and the MCP server (roles, forged and revoked tokens), the assistant's tools, chat storage, limits and model rotation, and a check that every query the app sends fits the API's request limits.

`tests/ai-eval.manual.ts` sends real prompts to the free models and prints which model answered and which tools it picked. It's not part of `pnpm test` because each prompt uses the account's free daily requests:

```bash
DATABASE_URL=postgres://…/zadaci_test node --env-file=.env.local --import tsx tests/ai-eval.manual.ts
```

## Project structure

```text
src/
  routes/        pages and API routes (file-based, TanStack Router)
    _authed/     everything behind sign-in: workspaces, projects, tasks, notes, settings
    api/         /api/graphql, /api/auth, /api/chat (assistant), /api/mcp (AI agents), /api/cron (reminders, digests)
  graphql/       schema and resolvers (*.server.ts) and the client operations
  components/    UI by area: tasks, projects, notes, chat, shell, settings, auth, …
  db/            Drizzle schema and migrations
  lib/           shared logic: permissions, auth, note sanitizer, embeds, time, toasts
    ai/          the assistant: tools, prompt, model rotation, limits, chat storage (the MCP server reuses its tools)
  emails/        React Email templates
tests/           API tests
```

## Deployment

The app deploys to Vercel. Push to `main` and Vercel builds it. Set the environment variables above in the Vercel project, and run `pnpm db:migrate` against the production database when a change adds a migration. Keep the Vercel functions and the Supabase database in the same region (`fra1` and `eu-central-1`): the build stops if they don't match (`src/lib/deploy-region.ts`). A GitHub Actions workflow calls `/api/cron/daily` every hour with the `CRON_SECRET` for reminders and digests.

## Support and credits

- Questions or problems: [thecodingmontana@gmail.com](mailto:thecodingmontana@gmail.com)
- Designed and built by [@codewithmontana](https://x.com/codewithmontana)

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) to get set up, and follow the [Code of Conduct](CODE_OF_CONDUCT.md). Report security problems privately as described in [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
