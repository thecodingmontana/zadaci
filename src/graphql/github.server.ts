import { asc, eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { generateNanoId } from "#/db/utils";
import { MCP_RESOURCE } from "#/lib/auth";
import { githubSecret, parseRepo } from "#/lib/github.server";
import { githubConnectReady } from "#/lib/github-connect.server";
import { requireProject } from "./projects.server";
import { badInput, type GraphQLContext } from "./schema.server";

// A project's link to a GitHub repo (the webhook GitHub calls), and the PRs that mention a task.

export const githubTypeDefs = /* GraphQL */ `
	"a project's GitHub link: paste webhookUrl and secret into the repo's Settings → Webhooks"
	type ProjectGitHub {
		repo: String!
		webhookUrl: String!
		secret: String!
	}

	type GitHubPr {
		repo: String!
		number: Int!
		title: String!
		url: String!
		"open, merged or closed"
		state: String!
	}

	extend type Query {
		"for people with full access to the project; null when it isn't linked"
		projectGitHub(slug: String!, projectId: ID!): ProjectGitHub
		"true when Connect with GitHub is set up on this server"
		githubConnectReady: Boolean!
	}

	extend type Mutation {
		"link the project to a repo (owner/name); a new secret each time"
		connectGitHub(slug: String!, projectId: ID!, repo: String!): ProjectGitHub!
		disconnectGitHub(slug: String!, projectId: ID!): Boolean!
	}

	extend type Task {
		githubPrs: [GitHubPr!]!
	}
`;

const shape = (projectId: string, repo: string, nonce: string) => ({
	repo,
	webhookUrl: `${new URL(MCP_RESOURCE).origin}/api/github/${projectId}`,
	secret: githubSecret(projectId, nonce),
});

export const githubResolvers = {
	Query: {
		githubConnectReady: () => githubConnectReady(),
		projectGitHub: async (
			_: unknown,
			args: { slug: string; projectId: string },
			ctx: GraphQLContext,
		) => {
			const { project } = await requireProject(ctx, args.slug, args.projectId, {
				right: "full",
			});
			const [link] = await db
				.select()
				.from(tables.project_github)
				.where(eq(tables.project_github.project_id, project.id));
			return link ? shape(project.id, link.repo, link.nonce) : null;
		},
	},
	Mutation: {
		connectGitHub: async (
			_: unknown,
			args: { slug: string; projectId: string; repo: string },
			ctx: GraphQLContext,
		) => {
			const { user, project } = await requireProject(
				ctx,
				args.slug,
				args.projectId,
				{ right: "full" },
			);
			const repo = parseRepo(args.repo);
			if (!repo)
				badInput("Enter the repo as owner/name, like octocat/hello-world");
			const nonce = generateNanoId();
			await db
				.insert(tables.project_github)
				.values({ project_id: project.id, repo, nonce, connected_by: user.id })
				.onConflictDoUpdate({
					target: tables.project_github.project_id,
					set: { repo, nonce, connected_by: user.id, created_at: new Date() },
				});
			return shape(project.id, repo, nonce);
		},
		disconnectGitHub: async (
			_: unknown,
			args: { slug: string; projectId: string },
			ctx: GraphQLContext,
		) => {
			const { project } = await requireProject(ctx, args.slug, args.projectId, {
				right: "full",
			});
			await db
				.delete(tables.project_github)
				.where(eq(tables.project_github.project_id, project.id));
			return true;
		},
	},
	Task: {
		// shortcut: one query per task; it's only asked for on an open task
		githubPrs: (t: { id: string }) =>
			db
				.select({
					repo: tables.task_github_pr.repo,
					number: tables.task_github_pr.number,
					title: tables.task_github_pr.title,
					url: tables.task_github_pr.url,
					state: tables.task_github_pr.state,
				})
				.from(tables.task_github_pr)
				.where(eq(tables.task_github_pr.task_id, t.id))
				.orderBy(asc(tables.task_github_pr.number)),
	},
};
