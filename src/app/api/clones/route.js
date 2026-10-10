import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import config from "@/lib/config";
import { resolveApiKey, submit, checkCredits, chargeCredits } from "@/lib/muapi";
import { PORTRAIT_PROMPT } from "@/lib/clone-pipeline";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const clones = await prisma.clone.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { creations: { orderBy: { createdAt: "desc" } } },
  });

  return NextResponse.json(clones.map((c) => ({ ...c, photos: JSON.parse(c.photos) })));
}

// Creates a clone from reference photos and starts generating its base portrait.
export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const body = await req.json();
    const name = (body.name || "").trim() || "Meu clone";
    const photos = Array.isArray(body.photos) ? body.photos.filter(Boolean) : [];

    if (photos.length === 0) {
      return NextResponse.json({ error: "Envie pelo menos uma foto." }, { status: 400 });
    }
    if (photos.length > config.clone.maxPhotos) {
      return NextResponse.json({ error: `Máximo de ${config.clone.maxPhotos} fotos.` }, { status: 400 });
    }

    const { apiKey, isUsingCustomKey } = resolveApiKey(req, body, session);
    if (!apiKey) return new NextResponse("API Key not configured", { status: 500 });

    const cost = config.clone.costs.portrait;
    const creditError = await checkCredits(session.user.id, cost, isUsingCustomKey);
    if (creditError) return NextResponse.json({ error: creditError }, { status: 403 });

    const requestId = await submit(
      config.clone.endpoints.portrait,
      { prompt: PORTRAIT_PROMPT, images_list: photos, aspect_ratio: "9:16" },
      apiKey
    );

    const clone = await prisma.clone.create({
      data: {
        userId: session.user.id,
        name,
        photos: JSON.stringify(photos),
        portraitRequestId: requestId,
        portraitStatus: "processing",
      },
    });

    await chargeCredits(session.user.id, cost, isUsingCustomKey);

    return NextResponse.json({ success: true, cloneId: clone.id, requestId });
  } catch (error) {
    console.error("[CLONE_CREATE_ERROR]", error);
    return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 });
  }
}
