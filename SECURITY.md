# Security Policy

## Reporting a vulnerability

Please **don't** open a public issue for security problems.

Email **thecodingmontana@gmail.com** with:

- what the problem is and where it is (file, route or GraphQL field)
- steps to reproduce it, or a small proof of concept
- what an attacker could do with it

You'll get a reply within a few days. Once the problem is confirmed, we'll work on a fix and agree with you on when to disclose it. We're happy to credit you unless you'd rather stay anonymous.

## Supported versions

Only the latest version on the `main` branch, deployed at [zadaci.vercel.app](https://zadaci.vercel.app), gets security fixes.

## Good to know

- Workspace data is scoped on the server: every GraphQL resolver checks the signed-in user's workspace role and project access (`src/lib/permissions.ts`).
- Note content is checked against an allow-list of blocks and safe link, image and embed addresses before it's stored (`src/lib/note-doc.ts`, `src/lib/note-embeds.ts`).
- Each API request is capped in size and cost (`src/graphql/yoga.server.ts`).
- Never commit secrets: keep them in `.env.local` (git-ignored) or your host's environment settings.
