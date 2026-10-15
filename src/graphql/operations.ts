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
	userId: string;
	role: string;
	name: string;
	email: string;
	image: string | null;
	isMe: boolean;
	title: string | null;
	tz: string | null;
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
				invites: {
					id: string;
					email: string;
					role: string;
					teamId: string | null;
				}[];
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
				userId
				role
				name
				email
				image
				isMe
				title
				tz
			}
			invites {
				id
				email
				role
				teamId
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
	{ slug: string; emails: string[]; role: string; teamId?: string | null }
> = gql`
	mutation InviteMembers(
		$slug: String!
		$emails: [String!]!
		$role: String!
		$teamId: ID
	) {
		inviteMembers(slug: $slug, emails: $emails, role: $role, teamId: $teamId) {
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

export type ActivityItem = {
	id: string;
	kind: string;
	verb: string;
	target: string | null;
	extra: string | null;
	projectId: string | null;
	taskId: string | null;
	actor: { id: string; name: string; image: string | null } | null;
	createdAt: string;
};

export const ACTIVITY: TypedDocumentNode<
	{
		workspace: {
			id: string;
			activity: ActivityItem[];
			members: { id: string; userId: string; name: string }[];
		} | null;
	},
	{ slug: string; filter: string; actorId?: string }
> = gql`
	query Activity($slug: String!, $filter: String!, $actorId: ID) {
		workspace(slug: $slug) {
			id
			activity(filter: $filter, actorId: $actorId) {
				id
				kind
				verb
				target
				extra
				projectId
				taskId
				actor {
					id
					name
					image
				}
				createdAt
			}
			members {
				id
				userId
				name
			}
		}
	}
`;

export type NotificationItem = {
	id: string;
	type: string;
	text: string;
	snippet: string | null;
	projectId: string | null;
	projectTitle: string | null;
	projectColor: string | null;
	taskId: string | null;
	taskTitle: string | null;
	actor: { id: string; name: string; image: string | null } | null;
	read: boolean;
	createdAt: string;
};

export const NOTIFICATIONS: TypedDocumentNode<
	{
		workspace: {
			id: string;
			unreadNotifications: number;
			notifications: NotificationItem[];
		} | null;
	},
	{ slug: string; unread: boolean }
> = gql`
	query Notifications($slug: String!, $unread: Boolean!) {
		workspace(slug: $slug) {
			id
			unreadNotifications
			notifications(unread: $unread) {
				id
				type
				text
				snippet
				projectId
				projectTitle
				projectColor
				taskId
				taskTitle
				actor {
					id
					name
					image
				}
				read
				createdAt
			}
		}
	}
`;

export const NOTIFICATION_COUNTS: TypedDocumentNode<
	{
		workspace: {
			id: string;
			unreadNotifications: number;
			unreadInbox: number;
		} | null;
	},
	{ slug: string }
> = gql`
	query NotificationCounts($slug: String!) {
		workspace(slug: $slug) {
			id
			unreadNotifications
			unreadInbox
		}
	}
`;

export const SET_NOTIFICATION_READ: TypedDocumentNode<
	{ setNotificationRead: { id: string; read: boolean } },
	{ slug: string; id: string; read: boolean }
> = gql`
	mutation SetNotificationRead($slug: String!, $id: ID!, $read: Boolean!) {
		setNotificationRead(slug: $slug, id: $id, read: $read) {
			id
			read
		}
	}
`;

export const MARK_ALL_NOTIFICATIONS_READ: TypedDocumentNode<
	{ markAllNotificationsRead: number },
	{ slug: string }
> = gql`
	mutation MarkAllNotificationsRead($slug: String!) {
		markAllNotificationsRead(slug: $slug)
	}
`;

export const RESEND_INVITE: TypedDocumentNode<
	{ resendInvite: boolean },
	{ slug: string; id: string }
> = gql`
	mutation ResendInvite($slug: String!, $id: ID!) {
		resendInvite(slug: $slug, id: $id)
	}
`;

export type MemberStats = {
	memberId: string;
	teamIds: string[];
	activeProjects: number;
	openTasks: number;
	lastActiveAt: string | null;
};

export const MEMBER_STATS: TypedDocumentNode<
	{ workspace: { id: string; memberStats: MemberStats[] } | null },
	{ slug: string }
> = gql`
	query MemberStats($slug: String!) {
		workspace(slug: $slug) {
			id
			memberStats {
				memberId
				teamIds
				activeProjects
				openTasks
				lastActiveAt
			}
		}
	}
`;

export type TeamInput = {
	name: string;
	description: string;
	icon: string;
	color: string;
	memberIds: string[];
};

export const CREATE_TEAM: TypedDocumentNode<
	{ createTeam: { id: string; name: string } },
	{ slug: string; input: TeamInput }
> = gql`
	mutation CreateTeam($slug: String!, $input: TeamInput!) {
		createTeam(slug: $slug, input: $input) {
			id
			name
		}
	}
`;

export const UPDATE_TEAM: TypedDocumentNode<
	{ updateTeam: { id: string; name: string } },
	{ slug: string; id: string; input: TeamInput }
> = gql`
	mutation UpdateTeam($slug: String!, $id: ID!, $input: TeamInput!) {
		updateTeam(slug: $slug, id: $id, input: $input) {
			id
			name
		}
	}
`;

export const DELETE_TEAM: TypedDocumentNode<
	{ deleteTeam: boolean },
	{ slug: string; id: string }
> = gql`
	mutation DeleteTeam($slug: String!, $id: ID!) {
		deleteTeam(slug: $slug, id: $id)
	}
`;

export type ProfileTask = {
	id: string;
	name: string;
	status: string;
	priority: string;
	dueDate: string | null;
	projectId: string;
	projectTitle: string;
	projectColor: string | null;
};

export const MEMBER_PROFILE: TypedDocumentNode<
	{
		workspace: {
			id: string;
			memberProfile: {
				projects: {
					id: string;
					title: string;
					icon: string | null;
					color: string | null;
					status: string;
				}[];
				tasks: ProfileTask[];
			};
		} | null;
	},
	{ slug: string; memberId: string }
> = gql`
	query MemberProfile($slug: String!, $memberId: ID!) {
		workspace(slug: $slug) {
			id
			memberProfile(memberId: $memberId) {
				projects {
					id
					title
					icon
					color
					status
				}
				tasks {
					id
					name
					status
					priority
					dueDate
					projectId
					projectTitle
					projectColor
				}
			}
		}
	}
`;

export const WORKSPACE_PROJECTS: TypedDocumentNode<
	{
		workspace: {
			id: string;
			projects: {
				id: string;
				title: string;
				icon: string | null;
				color: string | null;
				status: string;
				teamId: string | null;
			}[];
		} | null;
	},
	{ slug: string }
> = gql`
	query WorkspaceProjects($slug: String!) {
		workspace(slug: $slug) {
			id
			projects {
				id
				title
				icon
				color
				status
				teamId
			}
		}
	}
`;
