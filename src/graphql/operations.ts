import type { TypedDocumentNode } from "@apollo/client";
import { gql } from "@apollo/client";

export type WorkspaceSummary = {
	id: string;
	name: string;
	slug: string;
	imageUrl: string | null;
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
