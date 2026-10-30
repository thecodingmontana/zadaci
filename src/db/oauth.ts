import {
	boolean,
	index,
	integer,
	jsonb,
	text,
	timestamp,
	varchar,
} from "drizzle-orm/pg-core";
import { session, user } from "./user";
import { pgTable } from "./utils";

// AI agents signing in as a person (Better Auth's OAuth provider): the agents that registered
// (clients), what a person approved (consents), and the tokens issued. The field names are the
// plugin's; Better Auth reads and writes these tables itself.

const when = (name: string) =>
	timestamp(name, { mode: "date", withTimezone: true });
const userRef = (name: string) =>
	varchar(name, { length: 16 }).references(() => user.id, {
		onDelete: "cascade",
	});

export const oauthClient = pgTable("oauth_client", {
	id: text("id").primaryKey(),
	clientId: text("client_id").notNull().unique(),
	clientSecret: text("client_secret"),
	clientDiscoveryId: text("client_discovery_id"),
	disabled: boolean("disabled").default(false),
	skipConsent: boolean("skip_consent"),
	enableEndSession: boolean("enable_end_session"),
	subjectType: text("subject_type"),
	scopes: text("scopes").array(),
	clientCredentialsScopes: text("client_credentials_scopes")
		.array()
		.default([]),
	userId: userRef("user_id"),
	createdAt: when("created_at"),
	updatedAt: when("updated_at"),
	name: text("name"),
	uri: text("uri"),
	icon: text("icon"),
	contacts: text("contacts").array(),
	tos: text("tos"),
	policy: text("policy"),
	softwareId: text("software_id"),
	softwareVersion: text("software_version"),
	softwareStatement: text("software_statement"),
	redirectUris: text("redirect_uris").array().notNull(),
	postLogoutRedirectUris: text("post_logout_redirect_uris").array(),
	backchannelLogoutUri: text("backchannel_logout_uri"),
	backchannelLogoutSessionRequired: boolean(
		"backchannel_logout_session_required",
	),
	tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
	applicationType: text("application_type"),
	jwks: text("jwks"),
	jwksUri: text("jwks_uri"),
	grantTypes: text("grant_types").array(),
	responseTypes: text("response_types").array(),
	requirePKCE: boolean("require_pkce"),
	dpopBoundAccessTokens: boolean("dpop_bound_access_tokens").default(false),
	referenceId: text("reference_id"),
	metadata: jsonb("metadata"),
});

export const oauthResource = pgTable("oauth_resource", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull().unique(),
	name: text("name").notNull(),
	accessTokenTtl: integer("access_token_ttl"),
	refreshTokenTtl: integer("refresh_token_ttl"),
	signingAlgorithm: text("signing_algorithm"),
	signingKeyId: text("signing_key_id"),
	allowedScopes: text("allowed_scopes").array(),
	customClaims: jsonb("custom_claims"),
	dpopBoundAccessTokensRequired: boolean(
		"dpop_bound_access_tokens_required",
	).default(false),
	disabled: boolean("disabled").default(false),
	createdAt: when("created_at"),
	updatedAt: when("updated_at"),
	policyVersion: integer("policy_version").default(1),
	metadata: jsonb("metadata"),
});

export const oauthClientResource = pgTable(
	"oauth_client_resource",
	{
		id: text("id").primaryKey(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: "cascade" }),
		resourceId: text("resource_id")
			.notNull()
			.references(() => oauthResource.identifier, { onDelete: "cascade" }),
		metadata: jsonb("metadata"),
		createdAt: when("created_at"),
	},
	(t) => [index("oauth_client_resource_client_idx").on(t.clientId)],
);

export const oauthRefreshToken = pgTable(
	"oauth_refresh_token",
	{
		id: text("id").primaryKey(),
		token: text("token").notNull().unique(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: "cascade" }),
		sessionId: text("session_id").references(() => session.id, {
			onDelete: "set null",
		}),
		userId: userRef("user_id").notNull(),
		referenceId: text("reference_id"),
		authorizationCodeId: text("authorization_code_id"),
		resources: text("resources").array(),
		requestedUserInfoClaims: text("requested_user_info_claims").array(),
		expiresAt: when("expires_at"),
		createdAt: when("created_at"),
		revoked: when("revoked"),
		rotatedAt: when("rotated_at"),
		rotationReplayResponse: text("rotation_replay_response"),
		rotationReplayExpiresAt: when("rotation_replay_expires_at"),
		authTime: when("auth_time"),
		confirmation: jsonb("confirmation"),
		scopes: text("scopes").array().notNull(),
	},
	(t) => [index("oauth_refresh_token_user_idx").on(t.userId)],
);

export const oauthAccessToken = pgTable(
	"oauth_access_token",
	{
		id: text("id").primaryKey(),
		token: text("token").unique(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: "cascade" }),
		sessionId: text("session_id").references(() => session.id, {
			onDelete: "set null",
		}),
		userId: userRef("user_id"),
		referenceId: text("reference_id"),
		authorizationCodeId: text("authorization_code_id"),
		resources: text("resources").array(),
		requestedUserInfoClaims: text("requested_user_info_claims").array(),
		refreshId: text("refresh_id").references(() => oauthRefreshToken.id, {
			onDelete: "cascade",
		}),
		expiresAt: when("expires_at"),
		createdAt: when("created_at"),
		revoked: when("revoked"),
		confirmation: jsonb("confirmation"),
		scopes: text("scopes").array().notNull(),
	},
	(t) => [index("oauth_access_token_user_idx").on(t.userId)],
);

export const oauthConsent = pgTable(
	"oauth_consent",
	{
		id: text("id").primaryKey(),
		clientId: text("client_id")
			.notNull()
			.references(() => oauthClient.clientId, { onDelete: "cascade" }),
		userId: userRef("user_id"),
		referenceId: text("reference_id"),
		resources: text("resources").array(),
		requestedUserInfoClaims: text("requested_user_info_claims").array(),
		scopes: text("scopes").array().notNull(),
		createdAt: when("created_at"),
		updatedAt: when("updated_at"),
	},
	(t) => [index("oauth_consent_user_idx").on(t.userId, t.clientId)],
);

export const oauthClientAssertion = pgTable("oauth_client_assertion", {
	id: text("id").primaryKey(),
	expiresAt: when("expires_at").notNull(),
});
