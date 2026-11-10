import { Chapter, EdgeFade, Panel } from "./chapter";
import { GithubSync } from "./github-sync";
import { LiveBoard } from "./live-board";
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
					"Board, list and table",
					"Calendar and timeline",
					"Milestones and leads",
					"Saved views",
					"Dependencies",
					"Repeating tasks",
				]}
			>
				<div className="relative pb-0 md:pb-16">
					<Panel>
						<Shot
							name="timeline"
							alt="The timeline view of a Zadaci project, with tasks grouped by status across November"
						/>
						<EdgeFade right />
					</Panel>
					<div className="mt-3 md:absolute md:right-6 md:bottom-0 md:mt-0 md:w-[440px]">
						<LiveBoard />
					</div>
				</div>
			</Chapter>

			<Chapter
				id="together"
				title={["Work on it", "together"]}
				body="Tasks carry their subtasks, assignees, comments and time spent. Write the plan in a Notion-style note, talk it through in team chat, and get a morning digest of what changed."
				features={[
					"Subtasks and assignees",
					"Comments and mentions",
					"Notes with blocks",
					"Channels and DMs",
					"Time tracking",
					"Digest and web push",
				]}
			>
				<div className="grid gap-3 md:grid-cols-[1.25fr_1fr]">
					<Panel className="aspect-[4/3] md:aspect-auto md:h-[420px]">
						<Shot
							name="notes"
							alt="A Zadaci note titled Mobile 2.0 launch plan, with goals, timeline and open questions"
							className="w-[180%]! max-w-none -translate-x-[18%] md:w-[150%]! md:-translate-x-[16%]"
						/>
						<EdgeFade />
					</Panel>
					<Panel className="aspect-[4/3] md:aspect-auto md:h-[420px]">
						<Shot
							name="chat"
							alt="The #mobile channel in Zadaci chat, with the team discussing the beta"
							className="w-[190%]! max-w-none -translate-x-[33%] -translate-y-[50%] md:w-[170%]! md:-translate-y-[54%]"
						/>
						<EdgeFade />
					</Panel>
				</div>
			</Chapter>

			<Chapter
				id="ai"
				title={["Zad and your", "own agents"]}
				body="Ask Zad what's due, what's blocked or to plan your week, and it acts on your tasks for you. Connect Claude, Cursor or ChatGPT over MCP and they work in Zadaci as you, with exactly your access."
				features={[
					"Zad assistant",
					"MCP server",
					"Approvals before changes",
					"Bring your own key",
					"Claude, Cursor, ChatGPT",
					"Same permissions as you",
				]}
			>
				<ZadDemo />
				<Panel className="mt-3 hidden md:block">
					<Shot
						name="zad"
						alt="Zad, the Zadaci assistant, open beside a project timeline"
					/>
					<EdgeFade />
				</Panel>
			</Chapter>

			<Chapter
				id="github"
				title={["Linked to", "GitHub"]}
				body="Link a project to a repository and its tasks and issues stay in step both ways: titles, status, comments and pull requests, with webhooks for speed and an hourly check for anything missed."
				features={[
					"Two-way issue sync",
					"Comments both ways",
					"Pull request links",
					"Webhooks and repair",
				]}
			>
				<GithubSync />
			</Chapter>
		</>
	);
}
