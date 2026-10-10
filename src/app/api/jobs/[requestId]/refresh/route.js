import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchResult, keyForUser } from "@/lib/muapi";
import { applyJobUpdate } from "@/lib/clone-pipeline";

// Polls MuAPI for a job the caller owns and applies the result. Lets the app work without a public WEBHOOK_URL.
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const { requestId } = await params;
    const userId = session.user.id;

    const owned =
      (await prisma.creation.findFirst({ where: { requestId, userId }, select: { id: true } })) ||
      (await prisma.clone.findFirst({
        where: { userId, OR: [{ portraitRequestId: requestId }, { voiceRequestId: requestId }] },
        select: { id: true },
      }));
    if (!owned) return new NextResponse("Not found", { status: 404 });

    const apiKey = await keyForUser(userId);
    const data = await fetchResult(requestId, apiKey);
    await applyJobUpdate(data);

    return NextResponse.json({ success: true, status: data.status });
  } catch (error) {
    console.error("[JOB_REFRESH_ERROR]", error);
    return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 });
  }
}
