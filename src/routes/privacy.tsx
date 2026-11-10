import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "#/components/legal";

export const Route = createFileRoute("/privacy")({
	head: () => ({ meta: [{ title: "Privacy Policy · Zadaci" }] }),
	component: Privacy,
});

function Privacy() {
	return (
		<LegalPage title="Privacy Policy" updated="November 10, 2026">
			<p>
				This explains what Zadaci keeps about you, why, and what you can do
				about it.
			</p>

			<h2>What we keep</h2>
			<ul>
				<li>
					<b>Your account:</b> your name, email and picture from Google (or the
					one you set), your settings and time zone.
				</li>
				<li>
					<b>Your work:</b> the projects, tasks, notes, comments, files and
					bookmarks you add, and an activity log of changes.
				</li>
				<li>
					<b>Security:</b> your active sessions (device and IP address),
					passkeys and two-step verification setup.
				</li>
				<li>
					<b>The assistant:</b> your chat with it, and any AI keys you connect.
					Keys are encrypted before they're stored, tied to your account, and
					never shown again.
				</li>
				<li>
					<b>Connected apps:</b> AI agents you connect (like Claude Code), what
					you approved, and the short-lived sign-in tokens they use.
				</li>
				<li>
					<b>Feedback you send:</b> your message, name, email, the page you were
					on and your browser go by email to our support inbox, so we can reply.
					We don't store them in Zadaci.
				</li>
				<li>
					<b>GitHub:</b> for a project linked to a repo, the repo's name and the
					title, number, link and state of pull requests that mention a task. If
					you connect your GitHub account, your GitHub username and an access
					token (plus, for sign-ins that expire, the token that renews it),
					encrypted before it's stored. It can only manage repo webhooks, or,
					through the Zadaci GitHub App, read the repos you installed the app
					on, their pull requests and issues, and write issues, issue comments
					and a project board (never your code). A task comment goes onto its
					issue with its author's name, so people who can see the repo see it.
					We use it to list the repos you can link, to keep a linked project's
					tasks and the repo's issues in step (a task's title, description,
					subtasks, priority, due date and a link back go into its issue, and
					its status goes onto the repo's board), and, without the app, to add
					or remove a project's webhook.
				</li>
				<li>
					<b>Errors:</b> when something fails (a page crashes, GitHub refuses a
					change, a background job breaks), what failed and where: the page's
					address, the error message, and a task's or project's id or key, never
					its text. Kept 14 days so we can fix it, then deleted.
				</li>
			</ul>

			<h2>Why</h2>
			<p>
				Only to run Zadaci: to sign you in, show your work to you and the people
				you share it with, send the notifications you choose, and keep your
				account secure. We don't sell your data or use it for ads.
			</p>
			<p>
				The people who run Zadaci have an admin area to keep it healthy. It
				shows your name and email, how you sign in, whether two-step
				verification is on, when you joined and were last seen, and how many
				workspaces you're in; for workspaces, their name, size and when they
				last changed; and totals and counts of what happens in Zadaci. It never
				shows your tasks, notes, comments or messages.
			</p>

			<h2>Who helps us run it</h2>
			<p>
				Your data is processed by the services Zadaci is built on: Vercel
				(hosting), Supabase (database), Cloudinary (files and pictures), Resend
				(email), Google (sign-in) and, when you use it, Unsplash (photo search).
				Messages to the assistant go to OpenRouter's AI models, or to the
				provider of the key you connect (Anthropic, OpenAI, Google or
				OpenRouter). Free AI models may log prompts, so don't share anything
				sensitive with the assistant. When you connect an AI agent, what it
				reads in Zadaci goes to that agent and the AI service behind it, under
				their terms. When you link a GitHub repo, GitHub sends us its pull
				requests' titles, descriptions and branch names; we keep only those that
				mention a task.
			</p>

			<h2>Cookies</h2>
			<p>
				We use only the cookies needed to keep you signed in and remember your
				layout. No tracking or advertising cookies.
			</p>

			<h2>Your choices</h2>
			<ul>
				<li>Change your notifications in Settings → Notifications.</li>
				<li>
					Remove AI keys and clear the assistant's chat whenever you like.
				</li>
				<li>
					Disconnect an AI agent in Settings → Sessions → Connected apps; it
					stops at once.
				</li>
				<li>
					Unlink a GitHub repo in the project's menu → GitHub, or disconnect
					your GitHub account in Settings → Sessions → Connected apps: we unlink
					the projects you linked, remove their webhooks, delete the token and
					revoke it on GitHub.
				</li>
				<li>
					Download all your data, or delete your account, in Settings → Your
					data. Deleting removes your name, email, picture, sign-ins, private
					notes and bookmarks, and AI keys and chats; work you shared stays with
					your team under "Deleted user".
				</li>
			</ul>
		</LegalPage>
	);
}
