import assert from "node:assert/strict";
import { can } from "./permissions";

// The rules the server enforces; a change here should be deliberate.
assert.equal(can("owner", "deleteWorkspace"), true);
assert.equal(can("moderator", "deleteWorkspace"), false);
assert.equal(can("moderator", "manageRoles"), true);
assert.equal(can("member", "manageRoles"), false);
assert.equal(can("member", "createProjects"), true);
assert.equal(can("member", "createProjects", { permCreate: false }), false);
assert.equal(can("moderator", "createProjects", { permCreate: false }), true);
assert.equal(can("member", "inviteGuests", { permGuests: false }), false);
assert.equal(can("member", "inviteMembers"), false);
assert.equal(can("guest", "editProjects"), false);
assert.equal(can("guest", "createProjects"), false);
assert.equal(can("guest", "comment"), true);
assert.equal(can(undefined, "comment"), false);
console.log("permissions ok");
