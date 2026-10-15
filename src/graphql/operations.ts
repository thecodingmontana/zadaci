import type { TypedDocumentNode } from "@apollo/client";
import { gql } from "@apollo/client";

export type WorkspaceSummary = {
	id: string;
	name: string;
	slug: string;
	imageUrl: string | null;
	color?: string | null;
	defaultView: string;
	role: string;
};

export const WORKSPACES: TypedDocumentNode<{ workspaces: WorkspaceSummary[] }> =
	gql`
	query Workspaces {
		workspaces {
			id
			name
			slug
			imageUrl
			defaultView
			role
		}
	}
`;

export const WORKSPACE: TypedDocumentNode<
	{
		workspace:
			| (WorkspaceSummary & {
					inviteCode: string;
					projects: {
						id: string;
						title: string;
						icon: string | null;
						tasks: { id: string; name: string; status: string }[];
					}[];
			  })
			| null;
	},
	{ slug: string }
> = gql`
	query Workspace($slug: String!) {
		workspace(slug: $slug) {
			id
			name
			slug
			imageUrl
			defaultView
			role
			inviteCode
			projects {
				id
				title
				icon
				tasks {
					id
					name
					status
				}
			}
		}
	}
`;

export const SLUG_AVAILABLE: TypedDocumentNode<
	{ slugAvailable: boolean },
	{ slug: string }
> = gql`
	query SlugAvailable($slug: String!) {
		slugAvailable(slug: $slug)
	}
`;

export type OnboardingInput = {
	useCase: string;
	name: string;
	slug: string;
	defaultView: string;
	teamSize: string;
	projectName: string;
	templateId: string;
	invites: string[];
};

export const COMPLETE_ONBOARDING: TypedDocumentNode<
	{ completeOnboarding: WorkspaceSummary & { inviteCode: string } },
	{ input: OnboardingInput }
> = gql`
	mutation CompleteOnboarding($input: OnboardingInput!) {
		completeOnboarding(input: $input) {
			id
			name
			slug
			imageUrl
			defaultView
			role
			inviteCode
		}
	}
`;

export const JOIN_WORKSPACE: TypedDocumentNode<
	{ joinWorkspace: WorkspaceSummary },
	{ code: string }
> = gql`
	mutation JoinWorkspace($code: String!) {
		joinWorkspace(code: $code) {
			id
			name
			slug
			imageUrl
			defaultView
			role
		}
	}
`;

export type ShellProject = {
	id: string;
	title: string;
	icon: string | null;
	color: string | null;
	status: string;
	isFavorite: boolean;
};
export type ShellTeam = {
	id: string;
	name: string;
	color: string | null;
	icon?: string | null;
};

export const SHELL: TypedDocumentNode<
	{
		workspaces: WorkspaceSummary[];
		workspace:
			| (WorkspaceSummary & { projects: ShellProject[]; teams: ShellTeam[] })
			| null;
	},
	{ slug: string }
> = gql`
	query Shell($slug: String!) {
		workspaces {
			id
			name
			slug
			imageUrl
			color
			defaultView
			role
		}
		workspace(slug: $slug) {
			id
			name
			slug
			imageUrl
			color
			defaultView
			role
			projects {
				id
				title
				icon
				color
				status
				isFavorite
			}
			teams {
				id
				name
				color
				icon
			}
		}
	}
`;

export type SearchResults = {
	tasks: {
		id: string;
		name: string;
		status: string;
		projectId: string;
		projectTitle: string;
	}[];
	projects: { id: string; title: string; color: string | null }[];
	people: { id: string; name: string; email: string; image: string | null }[];
};

export const SEARCH: TypedDocumentNode<
	{ search: SearchResults },
	{ slug: string; q: string }
> = gql`
	query Search($slug: String!, $q: String!) {
		search(slug: $slug, q: $q) {
			tasks {
				id
				name
				status
				projectId
				projectTitle
			}
			projects {
				id
				title
				color
			}
			people {
				id
				name
				email
				image
			}
		}
	}
`;

export type SettingsMember = {
	id: string;
	role: string;
	name: string;
	email: string;
	image: string | null;
	isMe: boolean;
};
export type SettingsTeam = {
	id: string;
	name: string;
	color: string | null;
	icon: string | null;
	description: string | null;
	memberCount: number;
	projectCount: number;
};
export type SettingsData = {
	me: {
		id: string;
		name: string;
		email: string;
		image: string | null;
		preferences: import("#/lib/preferences").ResolvedPreferences;
	};
	workspace:
		| (WorkspaceSummary & {
				color: string | null;
				inviteCode: string;
				settings: {
					permCreate: boolean;
					permGuests: boolean;
					permPublic: boolean;
					showDoneBoard: boolean;
				};
				projectCount: number;
				archivedProjects: {
					id: string;
					title: string;
					icon: string | null;
					color: string | null;
				}[];
				members: SettingsMember[];
				invites: { id: string; email: string; role: string }[];
				teams: SettingsTeam[];
		  })
		| null;
};

export const SETTINGS: TypedDocumentNode<SettingsData, { slug: string }> = gql`
	query Settings($slug: String!) {
		me {
			id
			name
			email
			image
			preferences
		}
		workspace(slug: $slug) {
			id
			name
			slug
			imageUrl
			defaultView
			role
			color
			inviteCode
			settings
			projectCount
			archivedProjects {
				id
				title
				icon
				color
			}
			members {
				id
				role
				name
				email
				image
				isMe
			}
			invites {
				id
				email
				role
			}
			teams {
				id
				name
				color
				icon
				description
				memberCount
				projectCount
			}
		}
	}
`;

export const UPDATE_PREFERENCES: TypedDocumentNode<
	{ updatePreferences: unknown },
	{ patch: unknown }
> = gql`
	mutation UpdatePreferences($patch: JSON!) {
		updatePreferences(patch: $patch)
	}
`;

export const UPDATE_WORKSPACE: TypedDocumentNode<
	{ updateWorkspace: { id: string; slug: string } },
	{ slug: string; input: Record<string, unknown> }
> = gql`
	mutation UpdateWorkspace($slug: String!, $input: WorkspaceInput!) {
		updateWorkspace(slug: $slug, input: $input) {
			id
			slug
		}
	}
`;

export const DELETE_WORKSPACE: TypedDocumentNode<
	{ deleteWorkspace: boolean },
	{ slug: string }
> = gql`
	mutation DeleteWorkspace($slug: String!) {
		deleteWorkspace(slug: $slug)
	}
`;

export const WORKSPACE_LOGO_UPLOAD: TypedDocumentNode<
	{
		workspaceLogoUpload: {
			url: string;
			apiKey: string;
			timestamp: number;
			signature: string;
			publicId: string;
			folder: string;
		};
	},
	{ slug: string }
> = gql`
	mutation WorkspaceLogoUpload($slug: String!) {
		workspaceLogoUpload(slug: $slug) {
			url
			apiKey
			timestamp
			signature
			publicId
			folder
		}
	}
`;

export const SET_WORKSPACE_IMAGE: TypedDocumentNode<
	{ setWorkspaceImage: { id: string } },
	{ slug: string; imageUrl: string | null }
> = gql`
	mutation SetWorkspaceImage($slug: String!, $imageUrl: String) {
		setWorkspaceImage(slug: $slug, imageUrl: $imageUrl) {
			id
		}
	}
`;

export const INVITE_MEMBERS: TypedDocumentNode<
	{ inviteMembers: { id: string; email: string }[] },
	{ slug: string; emails: string[]; role: string }
> = gql`
	mutation InviteMembers($slug: String!, $emails: [String!]!, $role: String!) {
		inviteMembers(slug: $slug, emails: $emails, role: $role) {
			id
			email
		}
	}
`;

export const REVOKE_INVITE: TypedDocumentNode<
	{ revokeInvite: boolean },
	{ slug: string; id: string }
> = gql`
	mutation RevokeInvite($slug: String!, $id: ID!) {
		revokeInvite(slug: $slug, id: $id)
	}
`;

export const UPDATE_MEMBER_ROLE: TypedDocumentNode<
	{ updateMemberRole: { id: string; role: string } },
	{ slug: string; memberId: string; role: string }
> = gql`
	mutation UpdateMemberRole($slug: String!, $memberId: ID!, $role: String!) {
		updateMemberRole(slug: $slug, memberId: $memberId, role: $role) {
			id
			role
		}
	}
`;

export const REMOVE_MEMBER: TypedDocumentNode<
	{ removeMember: boolean },
	{ slug: string; memberId: string }
> = gql`
	mutation RemoveMember($slug: String!, $memberId: ID!) {
		removeMember(slug: $slug, memberId: $memberId)
	}
`;

type ProjectVars = { slug: string; projectId: string };

export const TOGGLE_FAVORITE: TypedDocumentNode<
	{ toggleFavorite: boolean },
	ProjectVars
> = gql`
	mutation ToggleFavorite($slug: String!, $projectId: ID!) {
		toggleFavorite(slug: $slug, projectId: $projectId)
	}
`;

export const RENAME_PROJECT: TypedDocumentNode<
	{ renameProject: { id: string } },
	ProjectVars & { title: string }
> = gql`
	mutation RenameProject($slug: String!, $projectId: ID!, $title: String!) {
		renameProject(slug: $slug, projectId: $projectId, title: $title) {
			id
		}
	}
`;

export const DUPLICATE_PROJECT: TypedDocumentNode<
	{ duplicateProject: { id: string; title: string } },
	ProjectVars
> = gql`
	mutation DuplicateProject($slug: String!, $projectId: ID!) {
		duplicateProject(slug: $slug, projectId: $projectId) {
			id
			title
		}
	}
`;

export const MOVE_PROJECT: TypedDocumentNode<
	{ moveProject: boolean },
	ProjectVars & { direction: "up" | "down" }
> = gql`
	mutation MoveProject($slug: String!, $projectId: ID!, $direction: String!) {
		moveProject(slug: $slug, projectId: $projectId, direction: $direction)
	}
`;

export const ARCHIVE_PROJECT: TypedDocumentNode<
	{ archiveProject: { id: string } },
	ProjectVars & { archived: boolean }
> = gql`
	mutation ArchiveProject($slug: String!, $projectId: ID!, $archived: Boolean!) {
		archiveProject(slug: $slug, projectId: $projectId, archived: $archived) {
			id
		}
	}
`;

export const DELETE_PROJECT: TypedDocumentNode<
	{ deleteProject: boolean },
	ProjectVars
> = gql`
	mutation DeleteProject($slug: String!, $projectId: ID!) {
		deleteProject(slug: $slug, projectId: $projectId)
	}
`;
