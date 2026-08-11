export type ChangelogCategory = "New Features" | "Improvements" | "Bug Fixes";

export interface ChangelogSection {
  category: ChangelogCategory;
  items: string[];
}

export interface ChangelogRelease {
  version: string;
  date: string;
  sections: ChangelogSection[];
}

/**
 * Source of truth for the in-app "What's New" panel.
 *
 * RULES:
 * - The FIRST release in this array (index 0) is the current "New updates"
 *   release; every earlier release renders under "Previous updates".
 * - `package.json` version MUST equal `releases[0].version`.
 * - Every user-facing change MUST get a bullet here AND a version bump — they
 *   move together. See AGENTS.md "Changelog discipline".
 */
export const changelogReleases: ChangelogRelease[] = [
  {
    version: "2.5.2",
    date: "2026-08-11",
    sections: [
      {
        category: "Improvements",
        items: ["Added a human-readable CHANGELOG.md, kept in sync with the in-app changelog"],
      },
    ],
  },
  {
    version: "2.5.1",
    date: "2026-08-11",
    sections: [
      {
        category: "Bug Fixes",
        items: ["Dashboard content now scrollable — long pages no longer get clipped"],
      },
    ],
  },
  {
    version: "2.5.0",
    date: "2026-08-11",
    sections: [
      {
        category: "New Features",
        items: [
          "Dashboard greeting with live clock and date",
          "All Tasks Stats donut chart with weekly completion comparison",
          "Project Stats donut chart with weekly completion comparison",
        ],
      },
      {
        category: "Improvements",
        items: ["Removed table view from the all-tasks page"],
      },
    ],
  },
  {
    version: "2.4.0",
    date: "2026-08-11",
    sections: [
      {
        category: "New Features",
        items: [
          "Tasks page rebuilt with status overview, breakdown tiles and week calendar",
          "Table / Kanban / Timeline view switcher on the tasks page",
        ],
      },
    ],
  },
  {
    version: "2.3.0",
    date: "2026-08-11",
    sections: [
      {
        category: "New Features",
        items: [
          "Productivity Overview bar chart with month picker",
          "Project Overview card with progress and work timeline",
          "Recent Tasks table with search and date-range filter",
        ],
      },
    ],
  },
  {
    version: "2.2.0",
    date: "2026-08-11",
    sections: [
      {
        category: "New Features",
        items: ["Contribution grid on workspace dashboard", "Donate link to Ko-fi"],
      },
    ],
  },
  {
    version: "2.1.3",
    date: "2026-08-09",
    sections: [
      {
        category: "Bug Fixes",
        items: ["Group whats-new releases by date in panel"],
      },
    ],
  },
  {
    version: "2.1.2",
    date: "2026-08-09",
    sections: [
      {
        category: "Bug Fixes",
        items: ["Scrollable whats-new modal with icons, no emojis"],
      },
    ],
  },
  {
    version: "2.1.1",
    date: "2026-08-09",
    sections: [
      {
        category: "Bug Fixes",
        items: ["Scrollable whats-new modal + useQuery import"],
      },
    ],
  },
  {
    version: "2.1.0",
    date: "2026-08-09",
    sections: [
      {
        category: "New Features",
        items: ["What's new panel, feedback modal, changelog automation"],
      },
    ],
  },
  {
    version: "2.0.0",
    date: "2026-08-09",
    sections: [
      {
        category: "New Features",
        items: [
          "Assign teammates to tasks right from the task detail view with a clickable avatar group",
          "Kanban board with drag-and-drop for tasks across statuses",
          "Project timeline view for scheduling and deadlines",
          "Subtask views inside the task detail page",
          "Full trash system with soft-delete, restore, and permanent delete",
          "Channel create/edit/delete with role-based access control",
          "Rich-text message composer with code highlighting and typing indicators",
          "New task modal with project dropdown, assignees, and comments",
          "Editable tags on the project detail page",
        ],
      },
      {
        category: "Improvements",
        items: [
          "Inline editing for project title, status, description, and due date",
          "Task detail page mirrors the project page layout with consistent meta rows",
          "Reusable comment section shared across tasks and projects",
        ],
      },
      {
        category: "Bug Fixes",
        items: [
          "Task assignees now sync correctly to offline storage (pull filter fix)",
          "Kanban drag no longer resets a task's status after moving between columns",
          "Channel members are deduplicated and enforce a unique constraint",
        ],
      },
    ],
  },
];

export function getLatestChangelogRelease(): ChangelogRelease {
  return changelogReleases[0];
}
