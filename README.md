# Zadaci

Zadaci is a collaborative task management platform with real-time cross-tab sync, offline-first local storage, and team workspaces. Built with Nuxt 4, RxDB for local-first data, and Supabase Realtime for live multi-tab updates.

## 🌟 Features

- 🗂 **Projects & Tasks**: Full CRUD with subtasks, statuses, priorities, tags, and teams.
- 👥 **Teams**: Group members into teams for organizational structure.
- 🏷 **Tags**: Color-coded tags for projects and tasks.
- 🔄 **Offline-First**: RxDB stores everything locally in IndexedDB — works without internet.
- ⚡ **Live Cross-Tab Sync**: Supabase Realtime keeps every open tab in sync instantly.
- 🟢 **User Presence**: Status indicators (available, busy, away, DND, offline) with auto-expiry.
- 🗑 **Soft-Delete**: Items are soft-deleted and synced — nothing disappears without trace.
- 🔐 **Authentication**: Google OAuth + passkey (WebAuthn) support with 2FA.
- 📁 **File Uploads**: Powered by Cloudinary for media management.
- 📬 **Email Notifications**: Via Resend for task updates and team invites.
- 🌐 **Responsive Design**: Works across desktops and mobile devices.

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/thecodingmontana/zadaci.git
cd zadaci
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Setup Environment Variables

Create a `.env` file in the root directory and copy the following content:

```env
NUXT_PUBLIC_SITE_URL="http://localhost:3001"
NUXT_PUBLIC_SITE_NAME="Zadaci"
NITRO_PORT=3001

NUXT_SESSION_PASSWORD="your-secure-session-password"
ENCRYPTION_KEY="your-encryption-key"

# Google OAuth
NUXT_OAUTH_GOOGLE_CLIENT_ID="your-google-client-id"
NUXT_OAUTH_GOOGLE_CLIENT_SECRET="your-google-client-secret"
NUXT_OAUTH_GOOGLE_REDIRECT_URL="http://localhost:3001/api/auth/signin/google"

# Database
DATABASE_URL="your-postgres-url"

# Email (Resend)
NUXT_RESEND_API_KEY="your-resend-api-key"

# Cloudinary
NUXT_CLOUDINARY_CLOUD_NAME="your-cloud-name"
NUXT_CLOUDINARY_CLOUD_API_KEY="your-cloud-api-key"
NUXT_CLOUDINARY_CLOUD_API_SECRET="your-cloud-api-secret"
```

### 4. Run Database Migrations

```bash
pnpm run db:migrate
```

### 5. Enable Supabase Realtime

For cross-tab live sync, tables must be added to the `supabase_realtime` publication:

```bash
pnpm run db:realtime
```

**Always verify** after running — don't trust the Supabase dashboard toggle:

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
order by tablename;
```

> If a table you expect isn't in the output, the `alter publication` didn't take. Re-run `pnpm run db:realtime` and verify again. The tracked source of truth is `server/database/enable-realtime.sql` — update that file when adding new Tier 1 tables.

### 6. Run the Development Server

```bash
pnpm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to open Zadaci.

## 🛠 Tech Stack

- **Nuxt 4** — full-stack framework with auto-imports, file-based routing, server routes
- **RxDB v17** — offline-first local database (Dexie/IndexedDB storage)
- **Supabase Realtime** — live cross-tab sync via Postgres change streaming
- **Drizzle ORM + PostgreSQL** — type-safe database access with migrations
- **shadcn-nuxt / Reka UI** — accessible component primitives
- **Google OAuth + WebAuthn** — authentication with passkey and 2FA support
- **Tailwind CSS v4** — utility-first styling
- **Cloudinary** — media uploads and management
- **Resend** — email notifications
- **TanStack Query** — server-state management for non-RxDB data

## 🤝 Contributing

Feel free to fork the repo and submit pull requests. Feedback, suggestions, and improvements are welcome!

## 📄 License

This project is licensed under the MIT License.

---

Made with ❤️ by [@thecodingmontana](https://github.com/thecodingmontana)
