import { Chapter } from "./chapter";
import { BookmarksDemo, InboxDemo } from "./lazy";

export function BookmarksChapter() {
	return (
		<Chapter
			id="bookmarks"
			title={["Never lose", "a link again"]}
			body="Paste a link and its title, description and picture fill themselves in. File it in a collection for the team, keep it private, or pin it to a project."
			features={[
				{
					name: "Paste a link",
					desc: "Its title, description and image fill in on their own.",
				},
				{
					name: "Collections",
					desc: "Shared with the workspace, kept private, or linked to a project.",
				},
				{
					name: "Tags, stars and archive",
					desc: "Tag a link, star the ones you reach for, archive the rest.",
				},
				{
					name: "Filter and search",
					desc: "By type (article, document or video), by tag or by words, in a grid or a list.",
				},
			]}
		>
			<BookmarksDemo />
		</Chapter>
	);
}

export function InboxChapter() {
	return (
		<Chapter
			id="inbox"
			title={["Stay on top", "without the noise"]}
			body="Your own tasks in one list, an inbox for what needs you, and a morning digest at the hour you pick. Everything else updates on screen as it happens."
			features={[
				{
					name: "My Tasks",
					desc: "Everything assigned to you, from every project, in one place.",
				},
				{
					name: "Inbox and notifications",
					desc: "Mentions, assignments and comments, unread until you've seen them.",
				},
				{
					name: "Reminders",
					desc: "Due-soon and overdue reminders, so nothing slips past its date.",
				},
				{
					name: "Morning digest",
					desc: "One email each morning, at the hour you choose, in your own time zone.",
				},
				{ name: "Web push", desc: "Notifications on your desktop and phone." },
				{
					name: "Live updates",
					desc: "When a teammate or Zad changes something, you see it at once, no reload.",
				},
			]}
		>
			<InboxDemo />
		</Chapter>
	);
}
