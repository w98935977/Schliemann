import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createId,
  sortThreads,
  workspaceThreadSchema,
  type WorkspaceThread
} from "@/lib/workspace";
import {
  isDatabaseConfigured,
  listStoredThreads,
  removeThread,
  saveThread
} from "@/lib/server/workspace-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  thread: workspaceThreadSchema
});

export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({
        ok: true,
        source: "local",
        threads: [],
        reason: "DATABASE_URL is not configured on this deployment."
      });
    }

    const threads = await listStoredThreads();

    return NextResponse.json({
      ok: true,
      source: "database",
      threads: sortThreads(threads)
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected workspace load error.";

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({
        ok: true,
        persisted: false,
        threadId: null,
        reason: "DATABASE_URL is not configured on this deployment."
      });
    }

    const body = await request.json();
    const parsed = requestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid thread payload."
        },
        { status: 400 }
      );
    }

    await saveThread(parsed.data.thread);

    return NextResponse.json({
      ok: true,
      persisted: true,
      threadId: parsed.data.thread.id
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected workspace save error.";

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({
        ok: true,
        deleted: false,
        reason: "DATABASE_URL is not configured on this deployment."
      });
    }

    const threadId = request.nextUrl.searchParams.get("threadId") ?? "";

    if (!threadId) {
      return NextResponse.json(
        {
          ok: false,
          error: "threadId is required."
        },
        { status: 400 }
      );
    }

    await removeThread(threadId);

    return NextResponse.json({
      ok: true,
      deleted: true,
      requestId: createId()
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected workspace delete error.";

    return NextResponse.json(
      {
        ok: false,
        error: message
      },
      { status: 500 }
    );
  }
}
