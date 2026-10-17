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
	/** permission toggles (Shell and Settings queries only) */
	settings?: { permCreate: boolean; permGuests: boolean };
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
	access: string;
	/** the viewer's right: view, comment, edit or full */
	myAccess: import("#/lib/permissions").ProjectRight | null;
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
			settings
			projects {
				id
				title
				icon
				color
				status
				isFavorite
				access
				myAccess
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
	{ slug: string; filter: string; actorId?: string; projectId?: string }
> = gql`
	query Activity(
		$slug: String!
		$filter: String!
		$actorId: ID
		$projectId: ID
	) {
		workspace(slug: $slug) {
			id
			activity(filter: $filter, actorId: $actorId, projectId: $projectId) {
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
			myOpenTasks: number;
			archivedCount: number;
		} | null;
	},
	{ slug: string }
> = gql`
	query NotificationCounts($slug: String!) {
		workspace(slug: $slug) {
			id
			unreadNotifications
			unreadInbox
			myOpenTasks
			archivedCount
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

export type ProjectMember = {
	memberId: string;
	name: string;
	email: string;
	image: string | null;
	role: string;
	permission: import("#/lib/permissions").ProjectRight;
	isLead: boolean;
	isMe: boolean;
};

export const PROJECT_SHARE: TypedDocumentNode<
	{
		workspace: {
			id: string;
			name: string;
			members: SettingsMember[];
			project: {
				id: string;
				title: string;
				access: string;
				myAccess: import("#/lib/permissions").ProjectRight | null;
				members: ProjectMember[];
			} | null;
		} | null;
	},
	{ slug: string; projectId: string }
> = gql`
	query ProjectShare($slug: String!, $projectId: ID!) {
		workspace(slug: $slug) {
			id
			name
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
			project(id: $projectId) {
				id
				title
				access
				myAccess
				members {
					memberId
					name
					email
					image
					role
					permission
					isLead
					isMe
				}
			}
		}
	}
`;

export const SHARE_PROJECT: TypedDocumentNode<
	{ shareProject: boolean },
	{ slug: string; projectId: string; memberId: string; permission: string }
> = gql`
	mutation ShareProject(
		$slug: String!
		$projectId: ID!
		$memberId: ID!
		$permission: String!
	) {
		shareProject(
			slug: $slug
			projectId: $projectId
			memberId: $memberId
			permission: $permission
		)
	}
`;

export const UNSHARE_PROJECT: TypedDocumentNode<
	{ unshareProject: boolean },
	{ slug: string; projectId: string; memberId: string }
> = gql`
	mutation UnshareProject($slug: String!, $projectId: ID!, $memberId: ID!) {
		unshareProject(slug: $slug, projectId: $projectId, memberId: $memberId)
	}
`;

export const INVITE_TO_PROJECT: TypedDocumentNode<
	{ inviteToProject: boolean },
	{ slug: string; projectId: string; email: string; permission: string }
> = gql`
	mutation InviteToProject(
		$slug: String!
		$projectId: ID!
		$email: String!
		$permission: String!
	) {
		inviteToProject(
			slug: $slug
			projectId: $projectId
			email: $email
			permission: $permission
		)
	}
`;

export const SET_PROJECT_ACCESS: TypedDocumentNode<
	{ setProjectAccess: { id: string } },
	{ slug: string; projectId: string; access: string }
> = gql`
	mutation SetProjectAccess($slug: String!, $projectId: ID!, $access: String!) {
		setProjectAccess(slug: $slug, projectId: $projectId, access: $access) {
			id
		}
	}
`;

export type ProjectStats = {
	projectId: string;
	total: number;
	done: number;
	statusCounts: { status: string; count: number }[];
	memberIds: string[];
	lastActivityAt: string | null;
};

export type ProjectSummary = {
	id: string;
	title: string;
	description: string | null;
	icon: string | null;
	color: string | null;
	status: string;
	key: string;
	isFavorite: boolean;
	access: string;
	myAccess: import("#/lib/permissions").ProjectRight | null;
	leadId: string | null;
	teamId: string | null;
	startDate: string | null;
	dueDate: string | null;
};

const PROJECT_FIELDS = gql`
	fragment ProjectFields on Project {
		id
		title
		description
		icon
		color
		status
		key
		isFavorite
		access
		myAccess
		leadId
		teamId
		startDate
		dueDate
	}
`;

const STATS_FIELDS = gql`
	fragment StatsFields on ProjectStats {
		projectId
		total
		done
		statusCounts {
			status
			count
		}
		memberIds
		lastActivityAt
	}
`;

/** Projects page: every visible project with its numbers, plus people and teams to show them. */
export const PROJECTS: TypedDocumentNode<
	{
		workspace: {
			id: string;
			role: string;
			settings: { permCreate: boolean; permGuests: boolean };
			projects: ProjectSummary[];
			projectStats: ProjectStats[];
			members: SettingsMember[];
			teams: SettingsTeam[];
		} | null;
	},
	{ slug: string }
> = gql`
	${PROJECT_FIELDS}
	${STATS_FIELDS}
	query Projects($slug: String!) {
		workspace(slug: $slug) {
			id
			role
			settings
			projects {
				...ProjectFields
			}
			projectStats {
				...StatsFields
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

export type ProjectTask = {
	id: string;
	name: string;
	status: string;
	priority: string;
	dueDate: string | null;
};

export type SavedView = {
	id: string;
	name: string;
	type: "list" | "board" | "table";
	filters: import("#/lib/view-engine").Filter[];
};

export type ProjectDetail = ProjectSummary & {
	savedViews: SavedView[];
	milestones: { id: string; name: string; date: string }[];
	members: ProjectMember[];
	tasks: ProjectTask[];
};

/** One project page: the project, its numbers, and the people and teams it refers to. */
export const PROJECT_PAGE: TypedDocumentNode<
	{
		workspace: {
			id: string;
			role: string;
			project: ProjectDetail | null;
			projectStats: ProjectStats[];
			members: SettingsMember[];
			teams: SettingsTeam[];
		} | null;
	},
	{ slug: string; projectId: string }
> = gql`
	${PROJECT_FIELDS}
	${STATS_FIELDS}
	query ProjectPage($slug: String!, $projectId: ID!) {
		workspace(slug: $slug) {
			id
			role
			project(id: $projectId) {
				...ProjectFields
				savedViews {
					id
					name
					type
					filters
				}
				milestones {
					id
					name
					date
				}
				members {
					memberId
					name
					email
					image
					role
					permission
					isLead
					isMe
				}
				tasks {
					id
					name
					status
					priority
					dueDate
				}
			}
			projectStats {
				...StatsFields
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

export type ProjectFormInput = {
	title: string;
	description?: string | null;
	icon: string;
	color: string;
	teamId?: string | null;
	leadId?: string | null;
	dueDate?: string | null;
	template?: string;
};

export const CREATE_PROJECT: TypedDocumentNode<
	{ createProject: { id: string; title: string } },
	{ slug: string; input: ProjectFormInput }
> = gql`
	mutation CreateProject($slug: String!, $input: ProjectInput!) {
		createProject(slug: $slug, input: $input) {
			id
			title
		}
	}
`;

export const UPDATE_PROJECT: TypedDocumentNode<
	{ updateProject: { id: string } },
	{
		slug: string;
		projectId: string;
		input: Partial<Omit<ProjectFormInput, "template">> & {
			status?: string;
			startDate?: string | null;
		};
	}
> = gql`
	mutation UpdateProject($slug: String!, $projectId: ID!, $input: ProjectPatch!) {
		updateProject(slug: $slug, projectId: $projectId, input: $input) {
			id
		}
	}
`;

export const ADD_MILESTONE: TypedDocumentNode<
	{ addMilestone: { id: string } },
	{ slug: string; projectId: string; name: string; date: string }
> = gql`
	mutation AddMilestone(
		$slug: String!
		$projectId: ID!
		$name: String!
		$date: String!
	) {
		addMilestone(slug: $slug, projectId: $projectId, name: $name, date: $date) {
			id
		}
	}
`;

export const DELETE_MILESTONE: TypedDocumentNode<
	{ deleteMilestone: boolean },
	{ slug: string; projectId: string; id: string }
> = gql`
	mutation DeleteMilestone($slug: String!, $projectId: ID!, $id: ID!) {
		deleteMilestone(slug: $slug, projectId: $projectId, id: $id)
	}
`;

// ---- tasks ----

export type TaskItem = {
	id: string;
	key: string;
	number: number;
	name: string;
	status: string;
	priority: string;
	projectId: string;
	parentId: string | null;
	assigneeId: string | null;
	dueDate: string | null;
	startDate: string | null;
	labels: string[];
	estimate: string | null;
	recur: string | null;
	sortOrder: number;
	completedAt: string | null;
	archivedAt: string | null;
	createdAt: string;
	updatedAt: string;
	isFavorite: boolean;
	subtaskCount: number;
	subtaskDone: number;
	commentCount: number;
	attachmentCount: number;
	dependsOn: string[];
};

export const TASK_FIELDS = gql`
	fragment TaskFields on Task {
		id
		key
		number
		name
		status
		priority
		projectId
		parentId
		assigneeId
		dueDate
		startDate
		labels
		estimate
		recur
		sortOrder
		completedAt
		archivedAt
		createdAt
		updatedAt
		isFavorite
		subtaskCount
		subtaskDone
		commentCount
		attachmentCount
		dependsOn
	}
`;

/** Tasks for a view, plus the people and projects their rows refer to. */
export const TASKS: TypedDocumentNode<
	{
		workspace: {
			id: string;
			role: string;
			tasks: TaskItem[];
			members: SettingsMember[];
			projects: ProjectSummary[];
		} | null;
	},
	{ slug: string; projectId?: string | null; assigneeId?: string | null }
> = gql`
	${TASK_FIELDS}
	${PROJECT_FIELDS}
	query Tasks($slug: String!, $projectId: ID, $assigneeId: ID) {
		workspace(slug: $slug) {
			id
			role
			tasks(projectId: $projectId, assigneeId: $assigneeId) {
				...TaskFields
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
			projects {
				...ProjectFields
			}
		}
	}
`;

export type TaskPatch = Partial<{
	title: string;
	description: string | null;
	status: string;
	priority: string;
	assigneeId: string | null;
	dueDate: string | null;
	startDate: string | null;
	labels: string[];
	estimate: string | null;
	recur: string | null;
	projectId: string;
	sortOrder: number;
}>;

export const CREATE_TASK: TypedDocumentNode<
	{ createTask: TaskItem },
	{
		slug: string;
		input: TaskPatch & {
			projectId: string;
			title: string;
			parentId?: string | null;
		};
	}
> = gql`
	${TASK_FIELDS}
	mutation CreateTask($slug: String!, $input: TaskInput!) {
		createTask(slug: $slug, input: $input) {
			...TaskFields
		}
	}
`;

export const UPDATE_TASK: TypedDocumentNode<
	{ updateTask: TaskItem },
	{ slug: string; id: string; patch: TaskPatch }
> = gql`
	${TASK_FIELDS}
	mutation UpdateTask($slug: String!, $id: ID!, $patch: TaskPatch!) {
		updateTask(slug: $slug, id: $id, patch: $patch) {
			...TaskFields
		}
	}
`;

export const BULK_UPDATE_TASKS: TypedDocumentNode<
	{ bulkUpdateTasks: number },
	{ slug: string; ids: string[]; patch: TaskPatch }
> = gql`
	mutation BulkUpdateTasks($slug: String!, $ids: [ID!]!, $patch: TaskPatch!) {
		bulkUpdateTasks(slug: $slug, ids: $ids, patch: $patch)
	}
`;

export const DELETE_TASKS: TypedDocumentNode<
	{ deleteTasks: number },
	{ slug: string; ids: string[] }
> = gql`
	mutation DeleteTasks($slug: String!, $ids: [ID!]!) {
		deleteTasks(slug: $slug, ids: $ids)
	}
`;

export const OVERVIEW: TypedDocumentNode<
	{
		workspace: {
			id: string;
			name: string;
			invites: { id: string }[];
			projects: {
				id: string;
				title: string;
				color: string | null;
				milestones: { id: string; name: string; date: string }[];
			}[];
		} | null;
	},
	{ slug: string }
> = gql`
	query Overview($slug: String!) {
		workspace(slug: $slug) {
			id
			name
			invites {
				id
			}
			projects {
				id
				title
				color
				milestones {
					id
					name
					date
				}
			}
		}
	}
`;

export const ARCHIVE: TypedDocumentNode<
	{
		workspace: {
			id: string;
			role: string;
			tasks: Pick<
				TaskItem,
				"id" | "key" | "name" | "status" | "projectId" | "archivedAt"
			>[];
			projects: { id: string; title: string }[];
			archivedProjects: {
				id: string;
				title: string;
				icon: string | null;
				color: string | null;
				status: string;
				myAccess: import("#/lib/permissions").ProjectRight | null;
				archivedAt: string | null;
			}[];
			projectStats: { projectId: string; total: number }[];
		} | null;
	},
	{ slug: string }
> = gql`
	query Archive($slug: String!) {
		workspace(slug: $slug) {
			id
			role
			tasks(includeArchived: true) {
				id
				key
				name
				status
				projectId
				archivedAt
			}
			projects {
				id
				title
			}
			archivedProjects {
				id
				title
				icon
				color
				status
				myAccess
				archivedAt
			}
			projectStats {
				projectId
				total
			}
		}
	}
`;

export const ARCHIVE_TASK: TypedDocumentNode<
	{ archiveTask: TaskItem },
	{ slug: string; id: string; archived: boolean }
> = gql`
	${TASK_FIELDS}
	mutation ArchiveTask($slug: String!, $id: ID!, $archived: Boolean!) {
		archiveTask(slug: $slug, id: $id, archived: $archived) {
			...TaskFields
		}
	}
`;

export const DUPLICATE_TASK: TypedDocumentNode<
	{ duplicateTask: TaskItem },
	{ slug: string; id: string }
> = gql`
	${TASK_FIELDS}
	mutation DuplicateTask($slug: String!, $id: ID!) {
		duplicateTask(slug: $slug, id: $id) {
			...TaskFields
		}
	}
`;

export const SET_DEPENDENCIES: TypedDocumentNode<
	{ setDependencies: TaskItem },
	{ slug: string; id: string; dependsOn: string[] }
> = gql`
	${TASK_FIELDS}
	mutation SetDependencies($slug: String!, $id: ID!, $dependsOn: [ID!]!) {
		setDependencies(slug: $slug, id: $id, dependsOn: $dependsOn) {
			...TaskFields
		}
	}
`;

export const TOGGLE_TASK_FAVORITE: TypedDocumentNode<
	{ toggleTaskFavorite: boolean },
	{ slug: string; id: string }
> = gql`
	mutation ToggleTaskFavorite($slug: String!, $id: ID!) {
		toggleTaskFavorite(slug: $slug, id: $id)
	}
`;

export type TaskComment = {
	id: string;
	text: string;
	createdAt: string;
	author: { id: string; name: string; image: string | null } | null;
	authorMemberId: string | null;
	isMine: boolean;
	reactions: { emoji: string; count: number; mine: boolean; names: string[] }[];
};

export type TaskAttachment = {
	id: string;
	projectId: string;
	taskId: string | null;
	taskKey: string | null;
	name: string;
	url: string;
	mime: string | null;
	size: number;
	uploadedBy: string | null;
	createdAt: string;
};

export type TaskDetail = TaskItem & {
	description: string | null;
	subtasks: TaskItem[];
	comments: TaskComment[];
	attachments: TaskAttachment[];
};

/** Everything the task drawer shows. */
export const TASK_DETAIL: TypedDocumentNode<
	{
		workspace: {
			id: string;
			role: string;
			task: TaskDetail | null;
			activity: ActivityItem[];
			members: SettingsMember[];
			projects: ProjectSummary[];
		} | null;
	},
	{ slug: string; id: string }
> = gql`
	${TASK_FIELDS}
	${PROJECT_FIELDS}
	query TaskDetail($slug: String!, $id: ID!) {
		workspace(slug: $slug) {
			id
			role
			task(id: $id) {
				...TaskFields
				description
				subtasks {
					...TaskFields
				}
				comments {
					id
					text
					createdAt
					author {
						id
						name
						image
					}
					authorMemberId
					isMine
					reactions {
						emoji
						count
						mine
						names
					}
				}
				attachments {
					id
					projectId
					taskId
					taskKey
					name
					url
					mime
					size
					uploadedBy
					createdAt
				}
			}
			activity(taskId: $id) {
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
				role
				name
				email
				image
				isMe
				title
				tz
			}
			projects {
				...ProjectFields
			}
		}
	}
`;

export const ADD_COMMENT: TypedDocumentNode<
	{ addComment: TaskComment },
	{ slug: string; taskId: string; text: string }
> = gql`
	mutation AddComment($slug: String!, $taskId: ID!, $text: String!) {
		addComment(slug: $slug, taskId: $taskId, text: $text) {
			id
		}
	}
`;

export const DELETE_COMMENT: TypedDocumentNode<
	{ deleteComment: boolean },
	{ slug: string; id: string }
> = gql`
	mutation DeleteComment($slug: String!, $id: ID!) {
		deleteComment(slug: $slug, id: $id)
	}
`;

export const REACT_TO_COMMENT: TypedDocumentNode<
	{ reactToComment: { id: string } },
	{ slug: string; id: string; emoji: string }
> = gql`
	mutation ReactToComment($slug: String!, $id: ID!, $emoji: String!) {
		reactToComment(slug: $slug, id: $id, emoji: $emoji) {
			id
		}
	}
`;

export const ATTACHMENT_UPLOAD: TypedDocumentNode<
	{
		attachmentUpload: {
			url: string;
			apiKey: string;
			timestamp: number;
			signature: string;
			publicId: string;
			folder: string;
		};
	},
	{ slug: string; taskId?: string | null; projectId?: string | null }
> = gql`
	mutation AttachmentUpload($slug: String!, $taskId: ID, $projectId: ID) {
		attachmentUpload(slug: $slug, taskId: $taskId, projectId: $projectId) {
			url
			apiKey
			timestamp
			signature
			publicId
			folder
		}
	}
`;

export const ADD_ATTACHMENT: TypedDocumentNode<
	{ addAttachment: { id: string } },
	{
		slug: string;
		taskId?: string | null;
		projectId?: string | null;
		name: string;
		url: string;
		mime?: string | null;
		size: number;
	}
> = gql`
	mutation AddAttachment(
		$slug: String!
		$taskId: ID
		$projectId: ID
		$name: String!
		$url: String!
		$mime: String
		$size: Int!
	) {
		addAttachment(
			slug: $slug
			taskId: $taskId
			projectId: $projectId
			name: $name
			url: $url
			mime: $mime
			size: $size
		) {
			id
		}
	}
`;

export const REMOVE_ATTACHMENT: TypedDocumentNode<
	{ removeAttachment: boolean },
	{ slug: string; id: string }
> = gql`
	mutation RemoveAttachment($slug: String!, $id: ID!) {
		removeAttachment(slug: $slug, id: $id)
	}
`;

export const PROJECT_FILES: TypedDocumentNode<
	{
		workspace: {
			id: string;
			project: {
				id: string;
				myAccess: string | null;
				attachments: TaskAttachment[];
			} | null;
		} | null;
	},
	{ slug: string; projectId: string }
> = gql`
	query ProjectFiles($slug: String!, $projectId: ID!) {
		workspace(slug: $slug) {
			id
			project(id: $projectId) {
				id
				myAccess
				attachments {
					id
					projectId
					taskId
					taskKey
					name
					url
					mime
					size
					uploadedBy
					createdAt
				}
			}
		}
	}
`;

export const RENAME_ATTACHMENT: TypedDocumentNode<
	{ renameAttachment: { id: string; name: string } },
	{ slug: string; id: string; name: string }
> = gql`
	mutation RenameAttachment($slug: String!, $id: ID!, $name: String!) {
		renameAttachment(slug: $slug, id: $id, name: $name) {
			id
			name
		}
	}
`;

export const SAVE_VIEW: TypedDocumentNode<
	{ saveView: { id: string } },
	{
		slug: string;
		projectId: string;
		name: string;
		type: string;
		filters: unknown;
	}
> = gql`
	mutation SaveView($slug: String!, $projectId: ID!, $name: String!, $type: String!, $filters: JSON!) {
		saveView(slug: $slug, projectId: $projectId, name: $name, type: $type, filters: $filters) {
			id
		}
	}
`;

export const RENAME_VIEW: TypedDocumentNode<
	{ renameView: { id: string } },
	{ slug: string; id: string; name: string }
> = gql`
	mutation RenameView($slug: String!, $id: ID!, $name: String!) {
		renameView(slug: $slug, id: $id, name: $name) {
			id
		}
	}
`;

export const DELETE_VIEW: TypedDocumentNode<
	{ deleteView: boolean },
	{ slug: string; id: string }
> = gql`
	mutation DeleteView($slug: String!, $id: ID!) {
		deleteView(slug: $slug, id: $id)
	}
`;
