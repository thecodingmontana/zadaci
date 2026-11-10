import { BoardDemo } from "./board-demo";
import { Chapter, Panel } from "./chapter";
import { GithubDemo } from "./github-demo";
import { NoteDemo } from "./note-demo";
import { Shot } from "./reveal";
import { ZadDemo } from "./zad-demo";

export function Chapters() {
	return (
		<>
			<Chapter
				id="plan"
				title={["Plan it", "your way"]}
				body="Every project opens as a board, list, table, calendar or timeline, whichever suits the work. Statuses, milestones, leads and saved views keep a busy roadmap readable."
				features={[
					{
						name: "Board, list and table",
						desc: "Every project opens in the view you pick: drag cards between status columns, or edit fields right in the table.",
					},
					{
						name: "Calendar and timeline",
						desc: "Tasks with dates land on a month calendar and on a timeline you can read by weeks or months.",
					},
					{
						name: "Milestones and leads",
						desc: "Give a project a lead and milestones, so everyone knows who owns it and what comes next.",
					},
					{
						name: "Saved views",
						desc: "Keep a filter, sort and layout as a named view on the project, one click away.",
					},
					{
						name: "Dependencies",
						desc: "Mark a task as blocked by another, so the order of the work is clear before anyone starts.",
					},
					{
						name: "Repeating tasks",
						desc: "Set a task to repeat, and the next one is ready when this one is done.",
					},
				]}
			>
				<BoardDemo />
			</Chapter>

			<Chapter
				id="together"
				title={["Work on it", "together"]}
				body="Tasks carry their subtasks, assignees, comments and time spent. Write the plan in a Notion-style note, talk it through in team chat, and get a morning digest of what changed."
				features={[
					{
						name: "Subtasks and assignees",
						desc: "Break a task into subtasks and assign it to one person or several.",
					},
					{
						name: "Comments and mentions",
						desc: "Talk it through on the task itself; @mention someone and they get notified, with reactions for quick replies.",
					},
					{
						name: "Notes with blocks",
						desc: "Notion-style pages with headings, lists, tables, embeds and covers, linked to a project if you like.",
					},
					{
						name: "Channels and DMs",
						desc: "Team chat with channels, direct messages, threads, and a chat for any project or task.",
					},
					{
						name: "Time tracking",
						desc: "Start a timer on a task to see how long the work really took.",
					},
					{
						name: "Digest and web push",
						desc: "A morning email at the hour you choose, plus push notifications on desktop and phone.",
					},
				]}
			>
				<div className="grid gap-3 md:grid-cols-2">
					<NoteDemo />
					<Panel className="hidden md:block">
						<Shot
							name="chat"
							className="absolute inset-0 h-full! object-cover object-[78%_70%]"
							alt="The #mobile channel in Zadaci chat, with the team discussing the beta"
						/>
					</Panel>
				</div>
			</Chapter>

			<Chapter
				id="ai"
				title={["Zad and your", "own agents"]}
				body="Ask Zad what's due, what's blocked or to plan your week, and it acts on your tasks for you. Connect Claude, Cursor or Codex over MCP and they work in Zadaci as you, with exactly your access."
				features={[
					{
						name: "Zad assistant",
						desc: "Ask what is due or blocked, or tell it to create, update, assign or move tasks for you.",
					},
					{
						name: "MCP server",
						desc: "Connect Claude, Claude Code, Cursor, Codex, VS Code or any MCP client, and it works in Zadaci as you.",
					},
					{
						name: "Approvals before changes",
						desc: "Zad asks first before deleting, archiving or changing more than three tasks at once.",
					},
					{
						name: "Bring your own key",
						desc: "Add your own Claude, ChatGPT, Gemini or OpenRouter key to use Zad as much as you like; keys are encrypted.",
					},
					{
						name: "Setup for each agent",
						desc: "Settings has a tab for Claude, Claude Code, Codex, Cursor, VS Code and Gemini CLI, each with a copy button.",
					},
					{
						name: "Same permissions as you",
						desc: "Agents act with exactly your role in each workspace, and their changes show up live for your team.",
					},
				]}
			>
				<div className="grid gap-3 md:grid-cols-2">
					<ZadDemo />
					<Panel className="hidden md:block">
						<Shot
							name="zad"
							className="absolute inset-0 h-full! object-cover object-[100%_0%]"
							alt="Zad, the Zadaci assistant, open beside a project timeline"
						/>
					</Panel>
				</div>
			</Chapter>

			<Chapter
				id="github"
				title={["Linked to", "GitHub"]}
				body="Link a project to a repository and its tasks and issues stay in step both ways: titles, status, comments and pull requests, with webhooks for speed and an hourly check for anything missed."
				features={[
					{
						name: "Two-way issue sync",
						desc: "Creating, editing, completing or deleting a task updates its issue, and changes on GitHub update the task.",
					},
					{
						name: "Comments both ways",
						desc: "A task comment is posted on its issue, and a comment written on GitHub becomes a task comment.",
					},
					{
						name: "Pull request links",
						desc: "Pull requests that mention a task’s key show on the task, and merging one completes it.",
					},
					{
						name: "Webhooks and repair",
						desc: "Webhooks bring changes in quickly, and an hourly check puts anything missed back in step.",
					},
				]}
			>
				<GithubDemo />
			</Chapter>
		</>
	);
}
