import { Modal } from "#/components/q/modal";

// Help & resources: who to contact, where the code lives, and who made it.

import { SUPPORT_EMAIL } from "#/lib/seo";

export { SUPPORT_EMAIL };
export const REPO_URL = "https://github.com/thecodingmontana/zadaci";

export const supportMailto = () =>
	`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Zadaci support")}`;

// [name, link, logo] — projects without a logo in the icon set get a lettered tile
const BUILT_WITH: [string, string, string?][] = [
	["React", "https://react.dev", "icon-[logos--react]"],
	[
		"TypeScript",
		"https://www.typescriptlang.org",
		"icon-[logos--typescript-icon]",
	],
	["TanStack Start", "https://tanstack.com"],
	["Vite", "https://vite.dev", "icon-[logos--vitejs]"],
	["GraphQL", "https://graphql.org", "icon-[logos--graphql]"],
	["Apollo", "https://www.apollographql.com", "icon-[logos--apollostack]"],
	["Drizzle ORM", "https://orm.drizzle.team", "icon-[logos--drizzle-icon]"],
	["PostgreSQL", "https://www.postgresql.org", "icon-[logos--postgresql]"],
	["Better Auth", "https://www.better-auth.com"],
	["Tiptap", "https://tiptap.dev"],
	["Tailwind CSS", "https://tailwindcss.com", "icon-[logos--tailwindcss-icon]"],
	["Radix UI", "https://www.radix-ui.com"],
	["Motion", "https://motion.dev", "icon-[logos--framer]"],
	["Iconify", "https://iconify.design"],
	["Cloudinary", "https://cloudinary.com", "icon-[logos--cloudinary-icon]"],
	["Biome", "https://biomejs.dev", "icon-[logos--biomejs-icon]"],
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
			<div className="modal-b credits">
				<a
					className="credits-maker"
					href="https://x.com/codewithmontana"
					target="_blank"
					rel="noreferrer"
				>
					<img
						src="https://avatars.githubusercontent.com/u/63234437?v=4"
						alt=""
						width={44}
						height={44}
					/>
					<span className="grow">
						<span className="faint block" style={{ fontSize: 12 }}>
							Designed and built by
						</span>
						<b>@codewithmontana</b>
					</span>
					<span
						className="icon-[solar--arrow-right-up-linear] size-4 faint"
						aria-hidden="true"
					/>
				</a>
				<div>
					<div className="mh" style={{ padding: "0 0 8px" }}>
						Built with open source
					</div>
					<ul className="credits-list">
						{BUILT_WITH.map(([name, href, logo]) => (
							<li key={name}>
								<a href={href} target="_blank" rel="noreferrer">
									{logo ? (
										<span
											className={`${logo} size-4 shrink-0`}
											aria-hidden="true"
										/>
									) : (
										<span className="credits-mono" aria-hidden="true">
											{name[0]}
										</span>
									)}
									<span className="trunc">{name}</span>
								</a>
							</li>
						))}
					</ul>
				</div>
				<div className="credits-links">
					<a
						className="btn btn-secondary btn-sm grow"
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
					<a className="btn btn-secondary btn-sm grow" href={supportMailto()}>
						<span
							className="icon-[hugeicons--mail-01] size-4"
							aria-hidden="true"
						/>
						Contact support
					</a>
				</div>
				<p className="faint credits-foot">
					Made with 💚 · © {new Date().getFullYear()} Zadaci
				</p>
			</div>
		</Modal>
	);
}
