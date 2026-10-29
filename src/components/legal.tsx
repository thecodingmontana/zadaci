import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { SUPPORT_EMAIL } from "#/components/shell/credits";
import { ZadaciLogo } from "#/components/zadaci-logo";

// The Terms of Service and Privacy Policy pages share this frame: the logo home, the title, the
// date it last changed, and the text in the notes reading style.

export function LegalPage({
	title,
	updated,
	children,
}: {
	title: string;
	updated: string;
	children: ReactNode;
}) {
	return (
		<div className="shared">
			<header className="shared-top">
				<Link to="/" className="row" style={{ gap: 8, fontWeight: 600 }}>
					<ZadaciLogo className="size-6" />
					Zadaci
				</Link>
				<span className="row" style={{ gap: 4 }}>
					<Link to="/terms" className="legal-tab">
						Terms
					</Link>
					<Link to="/privacy" className="legal-tab">
						Privacy
					</Link>
				</span>
			</header>
			<article className="note-page legal">
				<h1 className="shared-title">{title}</h1>
				<p className="faint">Last updated {updated}</p>
				{children}
				<p>
					Questions? Email{" "}
					<a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
				</p>
			</article>
		</div>
	);
}
