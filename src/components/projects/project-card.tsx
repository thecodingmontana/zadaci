import { Link, useNavigate } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AvStack } from "#/components/q/av";
import type { ProjectStats, ProjectSummary } from "#/graphql/operations";
import { ago, fmtDay } from "#/lib/time";
import { PIcon, ProgBar, PStatus } from "./bits";

export const progressOf = (s: ProjectStats | undefined) =>
	s?.total ? Math.round((s.done / s.total) * 100) : 0;

/** A project in the grid (reference projectCard), used by Projects and Favorites. */
export function ProjectCard({
	slug,
	p,
	s,
	people,
	menu,
}: {
	slug: string;
	p: ProjectSummary;
	s: ProjectStats | undefined;
	people: { id: string; name: string; image?: string | null }[];
	menu?: ReactNode;
}) {
	const navigate = useNavigate();
	const pct = progressOf(s);
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: the title link is the keyboard target; the card is a bigger click area
		// biome-ignore lint/a11y/useKeyWithClickEvents: same as above
		<div
			className="pcard"
			onClick={() =>
				navigate({
					to: "/w/$slug/p/$projectId",
					params: { slug, projectId: p.id },
				})
			}
		>
			<div className="row">
				<PIcon icon={p.icon} color={p.color} />
				<div className="grow" style={{ minWidth: 0 }}>
					<div className="row" style={{ gap: 6 }}>
						<Link
							to="/w/$slug/p/$projectId"
							params={{ slug, projectId: p.id }}
							className="trunc"
							style={{ fontWeight: 600, fontSize: 14 }}
							onClick={(e) => e.stopPropagation()}
						>
							{p.title}
						</Link>
						{p.isFavorite && (
							<span
								style={{ color: "var(--q-amber)", display: "inline-flex" }}
								role="img"
								aria-label="Favorite"
							>
								<span
									className="icon-[solar--star-bold] size-3"
									aria-hidden="true"
								/>
							</span>
						)}
						{p.access === "private" && (
							<span
								className="faint"
								style={{ display: "inline-flex" }}
								data-tip="Private project"
								role="img"
								aria-label="Private project"
							>
								<span
									className="icon-[solar--lock-keyhole-linear] size-3"
									aria-hidden="true"
								/>
							</span>
						)}
					</div>
				</div>
				<PStatus status={p.status} />
			</div>
			<div className="desc">{p.description || "No description yet."}</div>
			<div className="row" style={{ gap: 10 }}>
				<ProgBar
					value={pct}
					tone={
						p.status === "complete"
							? "green"
							: p.status === "risk"
								? "red"
								: undefined
					}
				/>
				<span className="num" style={{ fontSize: 12, fontWeight: 500 }}>
					{pct}%
				</span>
			</div>
			<div className="foot">
				<span className="row" style={{ gap: 4 }}>
					<span
						className="icon-[solar--check-circle-linear] size-3"
						aria-hidden="true"
					/>
					{s?.done ?? 0}/{s?.total ?? 0}
				</span>
				<span className="row" style={{ gap: 4 }}>
					<span
						className="icon-[solar--calendar-linear] size-3"
						aria-hidden="true"
					/>
					{fmtDay(p.dueDate)}
				</span>
				<span
					className="row hide-m"
					style={{ gap: 4 }}
					suppressHydrationWarning
				>
					<span
						className="icon-[solar--clock-circle-linear] size-3"
						aria-hidden="true"
					/>
					{s?.lastActivityAt ? ago(s.lastActivityAt) : "—"}
				</span>
				<span className="sp" />
				<AvStack people={people} max={3} />
			</div>
			{menu}
		</div>
	);
}
