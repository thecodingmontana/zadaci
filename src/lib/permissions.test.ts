import assert from "node:assert/strict";
import { can, canInvite, hasRight, projectRight } from "./permissions";

// The rules the server enforces; a change here should be deliberate.
assert.equal(can("owner", "deleteWorkspace"), true);
assert.equal(can("moderator", "deleteWorkspace"), false);
assert.equal(can("moderator", "manageRoles"), true);
assert.equal(can("member", "manageRoles"), false);
assert.equal(can("member", "createProjects"), true);
assert.equal(can("member", "createProjects", { permCreate: false }), false);
assert.equal(can("moderator", "createProjects", { permCreate: false }), true);
assert.equal(can("member", "inviteGuests", { permGuests: false }), false);
assert.equal(canInvite("moderator", { permGuests: false }), true);
assert.equal(canInvite("member"), true);
assert.equal(canInvite("member", { permGuests: false }), false);
assert.equal(canInvite("guest"), false);
assert.equal(can("member", "inviteMembers"), false);
assert.equal(can("guest", "editProjects"), false);
assert.equal(can("guest", "createProjects"), false);
assert.equal(can(undefined, "createProjects"), false);

// project rights
const open = { access: "workspace", isLead: false };
const priv = { access: "private", isLead: false };
assert.equal(
	projectRight("moderator", priv, undefined),
	"full",
	"admins manage every project",
);
assert.equal(
	projectRight("member", priv, undefined),
	null,
	"private: invited only",
);
assert.equal(
	projectRight("member", open, undefined),
	"comment",
	"workspace: view and comment",
);
assert.equal(
	projectRight("member", open, null),
	"edit",
	"members on a project edit by default",
);
assert.equal(
	projectRight("guest", open, undefined),
	null,
	"guests only see projects they're on",
);
assert.equal(projectRight("guest", open, null), "comment");
assert.equal(
	projectRight("guest", priv, "edit"),
	"edit",
	"Share can raise a guest",
);
assert.equal(
	projectRight("member", { access: "private", isLead: true }, undefined),
	"full",
);
assert.equal(hasRight("comment", "edit"), false);
assert.equal(hasRight("full", "edit"), true);
assert.equal(hasRight(null, "view"), false);
console.log("permissions ok");
