import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import config from "@/lib/config";
import { resolveApiKey, checkCredits, chargeCredits } from "@/lib/muapi";
import { buildPipeline, startStep } from "@/lib/clone-pipeline";

// Script -> (optional scene image) -> speech in the clone's voice -> talking video.
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const body = await req.json();
    const script = (body.script || "").trim();
    const scene = (body.scene || "").trim();
    const { clone: cloneConfig } = config;

    if (!script) return NextResponse.json({ error: "Escreva o roteiro." }, { status: 400 });
    if (script.length > cloneConfig.maxScriptChars) {
      return NextResponse.json(
        { error: `Roteiro muito longo (máx. ${cloneConfig.maxScriptChars} caracteres).` },
        { status: 400 }
      );
    }

    const clone = await prisma.clone.findFirst({ where: { id, userId: session.user.id } });
    if (!clone) return new NextResponse("Not found", { status: 404 });
    if (clone.portraitStatus !== "completed" || !clone.portraitUrl) {
      return NextResponse.json({ error: "O retrato base ainda não está pronto." }, { status: 409 });
    }

    let voiceId;
    if (body.voice === "clone") {
      if (clone.voiceStatus !== "ready") {
        return NextResponse.json({ error: "A voz clonada ainda não está pronta." }, { status: 409 });
      }
      voiceId = clone.voiceId;
    } else if (cloneConfig.presetVoices.includes(body.voice)) {
      voiceId = body.voice;
    } else {
      return NextResponse.json({ error: "Voz inválida." }, { status: 400 });
    }

    const emotion = cloneConfig.emotions.includes(body.emotion) ? body.emotion : "neutral";
    const resolution = body.resolution === "720p" ? "720p" : "480p";
    const language = body.language === "auto" ? "auto" : "Portuguese";

    const { apiKey, isUsingCustomKey } = resolveApiKey(req, body, session);
    if (!apiKey) return new NextResponse("API Key not configured", { status: 500 });

    const { costs } = cloneConfig;
    const cost = (scene ? costs.scene : 0) + costs.tts + costs.talk;
    const creditError = await checkCredits(session.user.id, cost, isUsingCustomKey);
    if (creditError) return NextResponse.json({ error: creditError }, { status: 403 });

    const pipeline = buildPipeline({
      portraitUrl: clone.portraitUrl,
      scene,
      script,
      voiceId,
      emotion,
      language,
      resolution,
    });
    const requestId = await startStep(pipeline, apiKey);

    const creation = await prisma.creation.create({
      data: {
        userId: session.user.id,
        cloneId: clone.id,
        kind: "clone-video",
        type: "video",
        title: script.substring(0, 50) + (script.length > 50 ? "..." : ""),
        prompt: script,
        requestId,
        status: "processing",
        modelId: cloneConfig.endpoints.talk,
        aspectRatio: "9:16",
        resolution,
        inputImages: JSON.stringify([clone.portraitUrl]),
        pipeline: JSON.stringify(pipeline),
      },
    });

    await chargeCredits(session.user.id, cost, isUsingCustomKey);

    return NextResponse.json({ success: true, creationId: creation.id, requestId });
  } catch (error) {
    console.error("[CLONE_VIDEO_ERROR]", error);
    return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 });
  }
}
