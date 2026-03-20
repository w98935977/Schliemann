import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createId, sortThreads, type WorkspaceThread } from "@/lib/workspace";
import {
  isDatabaseConfigured,
  listStoredThreads,
  removeThread,
  saveThread
} from "@/lib/server/workspace-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const entrySchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  kind: z.enum(["student-draft", "assistant-feedback"]),
  label: z.string().min(1),
  mode: z.enum(["day-a", "day-b"]),
  content: z.string(),
  createdAt: z.string().datetime()
});

const draftSchema = z.object({
  mode: z.enum(["day-a", "day-b"]),
  essay: z.string(),
  phrasesInput: z.string(),
  keywords: z.string(),
  lastSavedAt: z.string().datetime()
});

const threadSchema: z.ZodType<WorkspaceThread> = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  currentStage: z.string().min(1),
  isPlaceholder: z.boolean().optional(),
  entries: z.array(entrySchema),
  draft: draftSchema
});

const requestSchema = z.object({
  thread: threadSchema
});

export async function GET() {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({
        ok: true,
        source: "local",
        threads: []
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
        threadId: null
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
        deleted: false
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
