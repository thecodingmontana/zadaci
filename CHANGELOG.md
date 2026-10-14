# Changelog

All notable changes to this project are documented here. Versions follow
[Semantic Versioning](https://semver.org/) and entries are generated from
`changelog/entries.ts` (the source of truth for the in-app "What's New" panel).

## Changelog

## [v3.0.1] - 2026-10-14

### Bug Fixes

- Workspace actions now check that you are a member, and only owners and moderators can send invites or empty the trash
- Sync can no longer change another workspace's data, edit other people's messages, comments or notes, or join private channels uninvited
- Comments only sync within their own workspace, and removed task assignees now disappear for everyone

- Invite links are now single-use, expire on time and can't add you twice (older invites need a resend)
## [v3.0.0] - 2026-08-11

### New Features

- Dashboard rebuilt to match the classic layout — overall stats, weekly productivity chart, and project/task donut stats
- Weekly Tasks Productivity chart with This week / Last week toggle

### Improvements

- Removed the contribution grid and its backend logic

## [v2.6.0] - 2026-08-11

### New Features

- Loading skeleton on the dashboard while data syncs

## [v2.5.2] - 2026-08-11

### Improvements

- Added a human-readable CHANGELOG.md, kept in sync with the in-app changelog

## [v2.5.1] - 2026-08-11

### Bug Fixes

- Dashboard content now scrollable — long pages no longer get clipped

## [v2.5.0] - 2026-08-11

### New Features

- Dashboard greeting with live clock and date
- All Tasks Stats donut chart with weekly completion comparison
- Project Stats donut chart with weekly completion comparison

### Improvements

- Removed table view from the all-tasks page

## [v2.4.0] - 2026-08-11

### New Features

- Tasks page rebuilt with status overview, breakdown tiles and week calendar
- Table / Kanban / Timeline view switcher on the tasks page

## [v2.3.0] - 2026-08-11

### New Features

- Productivity Overview bar chart with month picker
- Project Overview card with progress and work timeline
- Recent Tasks table with search and date-range filter

## [v2.2.0] - 2026-08-11

### New Features

- Contribution grid on workspace dashboard
- Donate link to Ko-fi

## [v2.1.3] - 2026-08-09

### Bug Fixes

- Group whats-new releases by date in panel

## [v2.1.2] - 2026-08-09

### Bug Fixes

- Scrollable whats-new modal with icons, no emojis

## [v2.1.1] - 2026-08-09

### Bug Fixes

- Scrollable whats-new modal + useQuery import

## [v2.1.0] - 2026-08-09

### New Features

- What's new panel, feedback modal, changelog automation

## [v2.0.0] - 2026-08-09

### New Features

- Assign teammates to tasks right from the task detail view with a clickable avatar group
- Kanban board with drag-and-drop for tasks across statuses
- Project timeline view for scheduling and deadlines
- Subtask views inside the task detail page
- Full trash system with soft-delete, restore, and permanent delete
- Channel create/edit/delete with role-based access control
- Rich-text message composer with code highlighting and typing indicators
- New task modal with project dropdown, assignees, and comments
- Editable tags on the project detail page

### Improvements

- Inline editing for project title, status, description, and due date
- Task detail page mirrors the project page layout with consistent meta rows
- Reusable comment section shared across tasks and projects

### Bug Fixes

- Task assignees now sync correctly to offline storage (pull filter fix)
- Kanban drag no longer resets a task's status after moving between columns
- Channel members are deduplicated and enforce a unique constraint

