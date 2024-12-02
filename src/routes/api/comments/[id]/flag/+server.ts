import { json } from "@sveltejs/kit";
import type { RequestEvent } from "@sveltejs/kit";
import { prisma } from "$lib/server/prisma";
import { getSession } from "$lib/server/auth";

export async function POST({ params, request, cookies }: RequestEvent) {
  try {
    const session = await getSession(cookies);
    if (!session?.userId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = params.id;
    if (!id) {
      return json({ error: "Comment ID is required" }, { status: 400 });
    }

    const commentId = parseInt(id);
    if (isNaN(commentId)) {
      return json({ error: "Invalid comment ID" }, { status: 400 });
    }

    const body = await request.json();
    const { reason } = body as { reason?: string };


    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId }
    });

    if (!existingComment) {
      return json({ error: "Comment not found" }, { status: 404 });
    }

    if (existingComment.flagged) {
      return json({ error: "Comment is already flagged" }, { status: 400 });
    }


    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        flagged: true,
        flagReason: reason || "No reason provided",
        flaggedAt: new Date()
      }
    });

    return json({
      success: true,
      comment: updatedComment
    });
  } catch (error) {
    console.error("Error flagging comment:", error);
    return json(
      { error: "Failed to flag comment", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE({ params, cookies }: RequestEvent) {
  try {
    const session = await getSession(cookies);
    if (!session?.userId) {
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId }
    });

    if (!user?.isAdmin) {
      return json({ error: "Unauthorized" }, { status: 403 });
    }

    const id = params.id;
    if (!id) {
      return json({ error: "Comment ID is required" }, { status: 400 });
    }

    const commentId = parseInt(id);
    if (isNaN(commentId)) {
      return json({ error: "Invalid comment ID" }, { status: 400 });
    }


    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        flagged: false,
        flagReason: null,
        flaggedAt: null
      }
    });

    return json({
      success: true,
      comment: updatedComment
    });
  } catch (error) {
    console.error("Error unflagging comment:", error);
    return json(
      { error: "Failed to unflag comment", details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
