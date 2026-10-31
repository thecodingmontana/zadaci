import { gql, type TypedDocumentNode } from "@apollo/client";

// A project's link to a GitHub repo (see github.server.ts).

export type ProjectGitHub = {
	repo: string;
	webhookUrl: string;
	secret: string;
	/** whoever linked the repo, while they're still in the workspace */
	mergesAs: string | null;
	/** linked through the Zadaci GitHub App: nothing to set up by hand */
	viaApp: boolean;
};
export type GitHubPr = {
	repo: string;
	number: number;
	title: string;
	url: string;
	state: "open" | "merged" | "closed";
};

export const PROJECT_GITHUB: TypedDocumentNode<
	{
		projectGitHub: ProjectGitHub | null;
		githubConnectReady: boolean;
		githubAppInstallUrl: string | null;
		githubAccount: { login: string; repos: string[] } | null;
	},
	{ slug: string; projectId: string }
> = gql`
	query ProjectGitHub($slug: String!, $projectId: ID!) {
		projectGitHub(slug: $slug, projectId: $projectId) {
			repo
			webhookUrl
			secret
			mergesAs
			viaApp
		}
		githubConnectReady
		githubAppInstallUrl
		githubAccount {
			login
			repos
		}
	}
`;

export const CONNECT_GITHUB: TypedDocumentNode<
	{ connectGitHub: ProjectGitHub },
	{ slug: string; projectId: string; repo: string }
> = gql`
	mutation ConnectGitHub($slug: String!, $projectId: ID!, $repo: String!) {
		connectGitHub(slug: $slug, projectId: $projectId, repo: $repo) {
			repo
			webhookUrl
			secret
			mergesAs
			viaApp
		}
	}
`;

export const DISCONNECT_GITHUB: TypedDocumentNode<
	{ disconnectGitHub: boolean },
	{ slug: string; projectId: string }
> = gql`
	mutation DisconnectGitHub($slug: String!, $projectId: ID!) {
		disconnectGitHub(slug: $slug, projectId: $projectId)
	}
`;

// your GitHub account (Settings → Connected apps)
export const GITHUB_ACCOUNT: TypedDocumentNode<
	{
		githubConnectReady: boolean;
		githubAccount: {
			login: string;
			linkedProjects: { title: string; repo: string }[];
		} | null;
	},
	Record<string, never>
> = gql`
	query GitHubAccount {
		githubConnectReady
		githubAccount {
			login
			linkedProjects {
				title
				repo
			}
		}
	}
`;

export const DISCONNECT_GITHUB_ACCOUNT: TypedDocumentNode<
	{ disconnectGitHubAccount: boolean },
	Record<string, never>
> = gql`
	mutation DisconnectGitHubAccount {
		disconnectGitHubAccount
	}
`;
