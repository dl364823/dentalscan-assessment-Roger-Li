import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET /api/notify?userId=clinic-user
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "clinic-user";

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const unreadCount = notifications.filter((n) => !n.read).length;
    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    console.error("GET /api/notify error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST /api/notify  — triggered when a scan completes
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { scanId, status } = body;

    if (!scanId || !status) {
      return NextResponse.json({ error: "Missing scanId or status" }, { status: 400 });
    }

    if (status !== "completed") {
      return NextResponse.json({ ok: true });
    }

    // Atomically create both the Scan record and the clinic Notification
    await prisma.$transaction([
      prisma.scan.create({
        data: { id: scanId, status: "completed" },
      }),
      prisma.notification.create({
        data: {
          userId: "clinic-user",
          title: "New Scan Ready for Review",
          message: `Patient scan ${scanId} has been submitted and is ready for your review.`,
        },
      }),
    ]);

    return NextResponse.json({ ok: true, message: "Notification created" });
  } catch (err) {
    console.error("POST /api/notify error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH /api/notify  — mark one or all notifications as read
// Body: { id: string } to mark one, or { userId: string } to mark all
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, userId } = body;

    if (!id && !userId) {
      return NextResponse.json({ error: "Provide id or userId" }, { status: 400 });
    }

    if (id) {
      await prisma.notification.update({
        where: { id },
        data: { read: true },
      });
    } else {
      await prisma.notification.updateMany({
        where: { userId, read: false },
        data: { read: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/notify error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
