import { Modal } from "#/components/q/modal";

// Help & resources: who to contact, where the code lives, and who made it.

export const SUPPORT_EMAIL = "thecodingmontana@gmail.com";
export const REPO_URL = "https://github.com/thecodingmontana/zadaci";

export const supportMailto = () =>
	`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Zadaci support")}`;

const BUILT_WITH: [string, string][] = [
	["TanStack Start & Router", "https://tanstack.com"],
	["React", "https://react.dev"],
	["Apollo GraphQL", "https://www.apollographql.com"],
	["Drizzle ORM", "https://orm.drizzle.team"],
	["PostgreSQL", "https://www.postgresql.org"],
	["Better Auth", "https://www.better-auth.com"],
	["Tiptap", "https://tiptap.dev"],
	["Tailwind CSS", "https://tailwindcss.com"],
	["Radix UI", "https://www.radix-ui.com"],
	["Motion", "https://motion.dev"],
	["Iconify (Solar, Hugeicons)", "https://iconify.design"],
	["Cloudinary", "https://cloudinary.com"],
];

export function CreditsModal({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Modal open={open} onOpenChange={onOpenChange} title="Credits" size="sm">
			<div className="credits">
				<a
					className="credits-maker"
					href="https://x.com/codewithmontana"
					target="_blank"
					rel="noreferrer"
				>
					<img
						src="https://avatars.githubusercontent.com/u/63234437?v=4"
						alt=""
						width={40}
						height={40}
					/>
					<span>
						<span className="faint block" style={{ fontSize: 12 }}>
							Designed and built by
						</span>
						<b>@codewithmontana</b>
					</span>
				</a>
				<div className="mh" style={{ padding: "4px 0 6px" }}>
					Built with open source
				</div>
				<ul className="credits-list">
					{BUILT_WITH.map(([name, href]) => (
						<li key={name}>
							<a href={href} target="_blank" rel="noreferrer">
								{name}
							</a>
						</li>
					))}
				</ul>
				<div className="credits-links">
					<a
						className="btn btn-secondary btn-sm"
						href={REPO_URL}
						target="_blank"
						rel="noreferrer"
					>
						<span
							className="icon-[hugeicons--github] size-4"
							aria-hidden="true"
						/>
						Source code
					</a>
					<a className="btn btn-secondary btn-sm" href={supportMailto()}>
						<span
							className="icon-[hugeicons--mail-01] size-4"
							aria-hidden="true"
						/>
						Contact support
					</a>
				</div>
				<p className="faint" style={{ fontSize: 12, margin: 0 }}>
					Made with 💚 · © {new Date().getFullYear()} Zadaci
				</p>
			</div>
		</Modal>
	);
}
