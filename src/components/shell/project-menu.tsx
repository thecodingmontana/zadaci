import { useMutation } from "@apollo/client/react";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ProjectModalLoader } from "#/components/projects/project-modal";
import { ShareModal } from "#/components/projects/share-modal";
import { ConfirmModal } from "#/components/q/confirm";
import {
	Menu,
	MenuContent,
	MenuItem,
	MenuSeparator,
	MenuTrigger,
} from "#/components/q/menu";
import {
	ARCHIVE_PROJECT,
	DELETE_PROJECT,
	DUPLICATE_PROJECT,
	MOVE_PROJECT,
	type ShellProject,
	TOGGLE_FAVORITE,
} from "#/graphql/operations";
import { hasRight, type Permission } from "#/lib/permissions";
import { toast } from "#/lib/toast";

// The project "…" menu, ported from the reference app's project context menu.

export function ProjectMenu({
	slug,
	project,
	index,
	count,
	allowed,
	className = "ibtn ibtn-xs",
}: {
	slug: string;
	project: ShellProject;
	index: number;
	count: number;
	allowed: (permission: Permission) => boolean;
	/** trigger look: the sidebar's small button by default */
	className?: string;
}) {
	// renaming and archiving follow the viewer's right on this project (Share)
	const canEdit = hasRight(project.myAccess, "edit");
	const canReorder = allowed("editProjects");
	const [sharing, setSharing] = useState(false);
	const navigate = useNavigate();
	const [editing, setEditing] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const refetch = {
		refetchQueries: [
			"Shell",
			"Settings",
			"Projects",
			"ProjectPage",
			"NotificationCounts",
		],
	};
	// starring only flips the cached flag (sidebar, cards and Favorites share it)
	const [toggleFavorite] = useMutation(TOGGLE_FAVORITE, {
		update: (cache, { data }) =>
			cache.modify({
				id: cache.identify({ __typename: "Project", id: project.id }),
				fields: { isFavorite: () => !!data?.toggleFavorite },
			}),
	});
	const [duplicate] = useMutation(DUPLICATE_PROJECT, refetch);
	const [move] = useMutation(MOVE_PROJECT, refetch);
	const [archive] = useMutation(ARCHIVE_PROJECT, refetch);
	const [remove] = useMutation(DELETE_PROJECT, refetch);
	const vars = { slug, projectId: project.id };

	// every action shows it's running, then what happened (or why it failed)
	const run =
		<T,>(
			fn: () => Promise<T>,
			msg: {
				loading: string;
				success: string | ((v: T) => string);
				error: string;
			},
		) =>
		() => {
			toast.promise(fn(), msg).catch(() => {});
		};

	return (
		<>
			<Menu>
				<MenuTrigger
					className={className}
					aria-label={`Options for ${project.title}`}
				>
					<span
						className="icon-[solar--menu-dots-bold] size-3.5"
						aria-hidden="true"
					/>
				</MenuTrigger>
				<MenuContent width={230} align="start">
					<MenuItem
						icon="icon-[solar--arrow-right-up-linear]"
						onSelect={() =>
							navigate({
								to: "/w/$slug/p/$projectId",
								params: { slug, projectId: project.id },
							})
						}
					>
						Open
					</MenuItem>
					<MenuItem
						icon="icon-[solar--star-linear]"
						onSelect={run(() => toggleFavorite({ variables: vars }), {
							loading: project.isFavorite
								? "Removing from favorites…"
								: "Adding to favorites…",
							success: ({ data }) =>
								data?.toggleFavorite
									? "Added to favorites"
									: "Removed from favorites",
							error: "Couldn't update favorites",
						})}
					>
						{project.isFavorite ? "Remove from favorites" : "Add to favorites"}
					</MenuItem>
					{canEdit && (
						<MenuItem
							icon="icon-[solar--pen-linear]"
							onSelect={() => {
								setEditing(true);
							}}
						>
							Rename & edit
						</MenuItem>
					)}
					<MenuItem
						icon="icon-[solar--share-linear]"
						onSelect={() => setSharing(true)}
					>
						Share
					</MenuItem>
					<MenuItem
						icon="icon-[solar--link-linear]"
						onSelect={run(
							() =>
								navigator.clipboard.writeText(
									`${location.origin}/w/${slug}/p/${project.id}`,
								),
							{
								loading: "Copying link…",
								success: "Link copied",
								error: "Couldn't copy the link",
							},
						)}
					>
						Copy link
					</MenuItem>
					{allowed("createProjects") && (
						<MenuItem
							icon="icon-[solar--copy-linear]"
							onSelect={run(() => duplicate({ variables: vars }), {
								loading: `Duplicating ${project.title}…`,
								success: ({ data }) =>
									`Duplicated as “${data?.duplicateProject.title}”`,
								error: "Couldn't duplicate the project",
							})}
						>
							Duplicate
						</MenuItem>
					)}
					{canReorder && count > 1 && <MenuSeparator />}
					{canReorder && index > 0 && (
						<MenuItem
							icon="icon-[solar--arrow-up-linear]"
							onSelect={run(
								() => move({ variables: { ...vars, direction: "up" } }),
								{
									loading: "Moving up…",
									success: `Moved ${project.title} up`,
									error: "Couldn't move the project",
								},
							)}
						>
							Move up in sidebar
						</MenuItem>
					)}
					{canReorder && index < count - 1 && (
						<MenuItem
							icon="icon-[solar--arrow-down-linear]"
							onSelect={run(
								() => move({ variables: { ...vars, direction: "down" } }),
								{
									loading: "Moving down…",
									success: `Moved ${project.title} down`,
									error: "Couldn't move the project",
								},
							)}
						>
							Move down in sidebar
						</MenuItem>
					)}
					{canEdit && <MenuSeparator />}
					{canEdit && (
						<MenuItem
							icon="icon-[solar--archive-linear]"
							onSelect={run(
								() => archive({ variables: { ...vars, archived: true } }),
								{
									loading: `Archiving ${project.title}…`,
									success: `${project.title} archived`,
									error: "Couldn't archive the project",
								},
							)}
						>
							{project.status === "complete" ? "Archive" : "Archive project"}
						</MenuItem>
					)}
					{allowed("deleteProjects") && (
						<MenuItem
							icon="icon-[solar--trash-bin-minimalistic-linear]"
							danger
							onSelect={() => setDeleting(true)}
						>
							Delete project
						</MenuItem>
					)}
				</MenuContent>
			</Menu>
			<ProjectModalLoader
				open={editing}
				onOpenChange={setEditing}
				slug={slug}
				projectId={project.id}
			/>
			<ShareModal
				open={sharing}
				onOpenChange={setSharing}
				slug={slug}
				projectId={project.id}
			/>
			<ConfirmModal
				open={deleting}
				onOpenChange={setDeleting}
				title={`Delete ${project.title}?`}
				body="The project and all of its tasks will be deleted for everyone in the workspace."
				ok="Delete project"
				danger
				onConfirm={async () => {
					await toast.promise(remove({ variables: vars }), {
						loading: `Deleting ${project.title}…`,
						success: `${project.title} was deleted`,
						error: "Couldn't delete the project",
					});
					navigate({ to: "/w/$slug", params: { slug } });
				}}
			/>
		</>
	);
}
