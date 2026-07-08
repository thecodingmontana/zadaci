import { db, tables } from "~~/server/database/db";
import { USER_ROLE } from "~~/server/database/enums";
import { generateUniqueCode } from "~~/server/libs/utils";

export default defineEventHandler(async (event) => {
  try {
    const session = await requireUserSession(event);
    const body = await readBody(event);
    if (!session) {
      throw createError({
        statusCode: 401,
        statusMessage: "Unauthorized",
      });
    }
    if (!body.image) {
      throw createError({
        statusCode: 400,
        statusMessage: "Workspace image is required!",
      });
    }
    if (!body.name) {
      throw createError({
        statusCode: 400,
        statusMessage: "Workspace name is required!",
      });
    }
    const inviteCode = generateUniqueCode(6);
    const [workspace] = await db
      .insert(tables.workspace)
      .values({
        image_url: body.image,
        invite_code: inviteCode,
        name: body.name,
        user_id: session.user.id,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    if (!workspace) {
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to create workspace!",
      });
    }

    const [member] = await db
      .insert(tables.workspace_members)
      .values({
        role: USER_ROLE.OWNER,
        workspace_id: workspace.id,
        user_id: session.user.id,
        created_at: new Date(),
        updated_at: new Date(),
      })
      .returning();

    if (!member) {
      throw createError({
        statusCode: 500,
        statusMessage: "Failed to create workspace member!",
      });
    }

    const newWorkspace = {
      user_role: member.role,
      id: workspace.id,
      updated_at: workspace.updated_at,
      created_at: workspace.created_at,
      image_url: workspace.image_url,
      invite_code: workspace.invite_code,
      name: workspace.name,
    };
    return { workspace: newWorkspace };
  } catch (error: any) {
    const errorMessage = error.error ? error.error.message : error.message;
    throw createError({
      statusCode: error.statusCode ? error.statusCode : 500,
      statusMessage: `Failed to create workspace: ${errorMessage}!`,
    });
  }
});
