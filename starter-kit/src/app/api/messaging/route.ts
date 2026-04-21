import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * CHALLENGE: MESSAGING SYSTEM
 * 
 * Your goal is to build a basic communication channel between the Patient and Dentist.
 * 1. Implement the POST handler to save a new message into a Thread.
 * 2. Implement the GET handler to retrieve message history for a given thread.
 * 3. Focus on data integrity and proper relations.
 */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get("threadId");

  if (!threadId) {
    return NextResponse.json({ error: "Missing threadId" }, { status: 400 });
  }

  try {
    const messages = await prisma.message.findMany({
      where: { threadId },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ messages });
  } catch (err) {
    console.error("Messaging GET Error:", err);
    return NextResponse.json({ error: "Database Error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { threadId, content, sender } = body;

    if (!threadId || !content || !sender) {
      return NextResponse.json({ error: "Missing threadId, content, or sender" }, { status: 400 });
    }

    if (!["patient", "dentist"].includes(sender)) {
      return NextResponse.json({ error: "sender must be 'patient' or 'dentist'" }, { status: 400 });
    }

    // Ensure thread exists
    let thread = await prisma.thread.findUnique({ where: { id: threadId } });
    if (!thread) {
      thread = await prisma.thread.create({
        data: { id: threadId, patientId: "placeholder-patient-id" }, // In production, derive from auth/scan
      });
    }

    // Create message
    await prisma.message.create({
      data: { threadId, content, sender },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Messaging POST Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
