import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "#/components/legal";

export const Route = createFileRoute("/privacy")({
	head: () => ({ meta: [{ title: "Privacy Policy · Zadaci" }] }),
	component: Privacy,
});

function Privacy() {
	return (
		<LegalPage title="Privacy Policy" updated="October 25, 2026">
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
			</ul>

			<h2>Why</h2>
			<p>
				Only to run Zadaci: to sign you in, show your work to you and the people
				you share it with, send the notifications you choose, and keep your
				account secure. We don't sell your data or use it for ads.
			</p>

			<h2>Who helps us run it</h2>
			<p>
				Your data is processed by the services Zadaci is built on: Vercel
				(hosting), Supabase (database), Cloudinary (files and pictures), Resend
				(email), Google (sign-in) and, when you use it, Unsplash (photo search).
				Messages to the assistant go to OpenRouter's AI models, or to the
				provider of the key you connect (Anthropic, OpenAI, Google or
				OpenRouter). Free AI models may log prompts, so don't share anything
				sensitive with the assistant.
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
					Download all your data, or delete your account, in Settings → Your
					data. Deleting removes your name, email, picture, sign-ins, private
					notes and bookmarks, and AI keys and chats; work you shared stays with
					your team under "Deleted user".
				</li>
			</ul>
		</LegalPage>
	);
}
