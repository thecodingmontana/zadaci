import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "#/components/legal";

export const Route = createFileRoute("/terms")({
	head: () => ({ meta: [{ title: "Terms of Service · Zadaci" }] }),
	component: Terms,
});

function Terms() {
	return (
		<LegalPage title="Terms of Service" updated="October 31, 2026">
			<p>
				These terms cover your use of Zadaci, a tool for planning projects,
				tasks, notes and bookmarks with your team. By signing in you agree to
				them.
			</p>

			<h2>Your account</h2>
			<p>
				You sign in with Google or a passkey. Keep your sign-in methods secure;
				you're responsible for what happens in your account. You can download
				your data or delete your account any time in Settings → Your data.
			</p>

			<h2>Your content</h2>
			<p>
				What you add to Zadaci (tasks, notes, comments, files, bookmarks) stays
				yours. You give us permission to store it, show it to the people you
				share it with, and process it to run the service, nothing more. Don't
				upload anything you don't have the right to share, or anything illegal
				or harmful.
			</p>

			<h2>Workspaces</h2>
			<p>
				A workspace belongs to its owner, who decides who can join and what they
				can do. Work you add to a shared workspace stays with that workspace if
				you leave it or delete your account.
			</p>

			<h2>The assistant</h2>
			<p>
				The assistant can read and change what you're allowed to in your
				workspace, and asks before deleting or changing many things at once. Its
				answers come from AI models and can be wrong, so check anything
				important. If you connect your own AI key, the provider bills you for
				what the assistant uses, under their terms.
			</p>

			<h2>AI agents you connect</h2>
			<p>
				You can connect AI agents (like Claude Code or Cursor) to use Zadaci as
				you. An agent acts with your account and your role in each workspace,
				and what it does counts as done by you, so connect only agents you trust
				and check their work. You can disconnect one at any time in Settings.
				If you link a GitHub repo to a project, merging a pull request that
				mentions a task marks it done as you.
			</p>

			<h2>Acceptable use</h2>
			<p>
				Don't try to break, overload or get around the service's limits or
				security, access other people's data, or use Zadaci to spam, harass or
				break the law. We may suspend accounts that do.
			</p>

			<h2>The service</h2>
			<p>
				We work to keep Zadaci running and your data safe, but it's provided as
				is, without guarantees that it will always be available or free of
				errors. To the extent the law allows, we aren't liable for indirect
				losses from using it. We may change features or these terms; we'll
				update the date above when we do.
			</p>
		</LegalPage>
	);
}
