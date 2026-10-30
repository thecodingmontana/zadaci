import { asc, eq } from "drizzle-orm";
import { db, tables } from "#/db";
import { generateNanoId } from "#/db/utils";
import { MCP_RESOURCE } from "#/lib/auth";
import { githubSecret, parseRepo } from "#/lib/github.server";
import {
	addWebhook,
	disconnectGitHubAccount,
	githubAccount,
	githubConnectReady,
	githubRepos,
	removeWebhook,
} from "#/lib/github-connect.server";
import { requireProject } from "./projects.server";
import { badInput, type GraphQLContext, requireUser } from "./schema.server";

// A project's link to a GitHub repo (the webhook GitHub calls), the PRs that mention a task, and
// your connected GitHub account (which adds the webhook for you).

export const githubTypeDefs = /* GraphQL */ `
	"a project's GitHub link: paste webhookUrl and secret into the repo's Settings → Webhooks"
	type ProjectGitHub {
		repo: String!
		webhookUrl: String!
		secret: String!
	}

	"your GitHub account, connected in Settings → Connected apps"
	type GitHubAccount {
		login: String!
		"repos you admin (so we can add a webhook), most recently pushed first; public ones only"
		repos: [String!]!
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
		githubAccount: GitHubAccount
	}

	extend type Mutation {
		"link the project to a repo (owner/name); a new secret each time. With your GitHub account connected, this also adds the webhook on GitHub"
		connectGitHub(slug: String!, projectId: ID!, repo: String!): ProjectGitHub!
		disconnectGitHub(slug: String!, projectId: ID!): Boolean!
		"forget your GitHub account here and revoke Zadaci on GitHub"
		disconnectGitHubAccount: Boolean!
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
		githubConnectReady: (_: unknown, __: unknown, ctx: GraphQLContext) => {
			requireUser(ctx);
			return githubConnectReady();
		},
		githubAccount: (_: unknown, __: unknown, ctx: GraphQLContext) =>
			githubAccount(requireUser(ctx).id),
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
			const [before] = await db
				.select()
				.from(tables.project_github)
				.where(eq(tables.project_github.project_id, project.id));
			const nonce = generateNanoId();
			await db
				.insert(tables.project_github)
				.values({ project_id: project.id, repo, nonce, connected_by: user.id })
				.onConflictDoUpdate({
					target: tables.project_github.project_id,
					set: { repo, nonce, connected_by: user.id, created_at: new Date() },
				});
			const link = shape(project.id, repo, nonce);
			const account = await githubAccount(user.id);
			if (!account) return link;
			const added = await addWebhook(
				account.token,
				repo,
				link.webhookUrl,
				link.secret,
			);
			if (added === "ok") return link;
			// GitHub said no: put back what was there, so a link never sits without its webhook
			if (before)
				await db
					.update(tables.project_github)
					.set({
						repo: before.repo,
						nonce: before.nonce,
						connected_by: before.connected_by,
					})
					.where(eq(tables.project_github.id, before.id));
			else
				await db
					.delete(tables.project_github)
					.where(eq(tables.project_github.project_id, project.id));
			badInput(
				added === "no-access"
					? `@${account.login} needs admin access to ${repo} (and it must exist)`
					: "GitHub didn't accept the webhook. Try again in a moment.",
			);
		},
		disconnectGitHubAccount: async (
			_: unknown,
			__: unknown,
			ctx: GraphQLContext,
		) => {
			await disconnectGitHubAccount(requireUser(ctx).id);
			return true;
		},
		disconnectGitHub: async (
			_: unknown,
			args: { slug: string; projectId: string },
			ctx: GraphQLContext,
		) => {
			const { user, project } = await requireProject(
				ctx,
				args.slug,
				args.projectId,
				{ right: "full" },
			);
			const [gone] = await db
				.delete(tables.project_github)
				.where(eq(tables.project_github.project_id, project.id))
				.returning({ repo: tables.project_github.repo });
			const account = gone && (await githubAccount(user.id));
			if (account)
				await removeWebhook(
					account.token,
					gone.repo,
					shape(project.id, gone.repo, "").webhookUrl,
				).catch(() => {});
			return true;
		},
	},
	GitHubAccount: {
		repos: (a: { token: string }) => githubRepos(a.token),
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
