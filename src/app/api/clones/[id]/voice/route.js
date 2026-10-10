import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import config from "@/lib/config";
import { resolveApiKey, submit, checkCredits, chargeCredits } from "@/lib/muapi";

// MiniMax requires >= 8 chars, letters and digits, starting with a letter.
function newVoiceId() {
  return `v${randomBytes(6).toString("hex")}a1`;
}

// Clones the user's own voice from a sample. Requires explicit consent that the voice belongs to the user.
export async function POST(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

    const { id } = await params;
    const body = await req.json();

    if (body.consent !== true) {
      return NextResponse.json(
        { error: "Confirme que a voz é sua e que você autoriza a clonagem." },
        { status: 400 }
      );
    }
    if (!body.sampleUrl) {
      return NextResponse.json({ error: "Envie uma amostra de áudio." }, { status: 400 });
    }

    const clone = await prisma.clone.findFirst({ where: { id, userId: session.user.id } });
    if (!clone) return new NextResponse("Not found", { status: 404 });
    if (clone.voiceStatus === "processing") {
      return NextResponse.json({ error: "A clonagem de voz já está em andamento." }, { status: 409 });
    }

    const { apiKey, isUsingCustomKey } = resolveApiKey(req, body, session);
    if (!apiKey) return new NextResponse("API Key not configured", { status: 500 });

    const cost = config.clone.costs.voiceClone;
    const creditError = await checkCredits(session.user.id, cost, isUsingCustomKey);
    if (creditError) return NextResponse.json({ error: creditError }, { status: 403 });

    const voiceId = newVoiceId();
    const requestId = await submit(
      config.clone.endpoints.voiceClone,
      {
        audio_url: body.sampleUrl,
        custom_voice_id: voiceId,
        model: "speech-2.6-hd",
        need_noise_reduction: true,
        need_volume_normalization: true,
      },
      apiKey
    );

    await prisma.clone.update({
      where: { id: clone.id },
      data: {
        voiceId,
        voiceSampleUrl: body.sampleUrl,
        voiceStatus: "processing",
        voiceRequestId: requestId,
        voiceError: null,
        voiceConsentAt: new Date(),
      },
    });

    await chargeCredits(session.user.id, cost, isUsingCustomKey);

    return NextResponse.json({ success: true, requestId });
  } catch (error) {
    console.error("[CLONE_VOICE_ERROR]", error);
    return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 });
  }
}
