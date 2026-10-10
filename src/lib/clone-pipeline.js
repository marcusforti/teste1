import { prisma } from "@/lib/prisma";
import config from "@/lib/config";
import { submit, keyForUser, isFailed, isCompleted } from "@/lib/muapi";

const { endpoints } = config.clone;

export const PORTRAIT_PROMPT =
  "Create one photorealistic vertical 9:16 portrait of the exact same person shown in the reference photos. " +
  "Preserve identity precisely: face shape, skin tone, eyes, nose, lips, hairline, hairstyle, facial hair, marks and age. " +
  "Front-facing, looking straight at the camera, neutral relaxed expression with mouth closed, shoulders visible, " +
  "soft natural window light, clean softly blurred indoor background, sharp focus on the face, " +
  "smartphone-quality UGC selfie look. No text, no watermark, no extra people.";

function scenePrompt(scene) {
  return (
    "Place the exact same person from the reference image into this scene, keeping their identity, face and hair identical: " +
    `${scene}. Vertical 9:16, photorealistic, person facing the camera with mouth closed, upper body in frame, ` +
    "natural light, UGC smartphone look. No text, no watermark."
  );
}

// pipeline JSON stored on Creation.pipeline:
// { steps: ["scene"?, "tts"?, "talk"], index, portraitUrl, scene?, script, voiceId, emotion, speed, language, resolution,
//   imageUrl?, audioUrl? }
// When audioUrl is given (speech produced elsewhere, e.g. a local voice-clone model), the tts step is skipped.
export function buildPipeline({ portraitUrl, scene, script, voiceId, emotion, speed, language, resolution, audioUrl }) {
  const steps = [...(scene ? ["scene"] : []), ...(audioUrl ? [] : ["tts"]), "talk"];
  return {
    steps,
    index: 0,
    portraitUrl,
    scene: scene || null,
    script,
    voiceId,
    emotion,
    speed,
    language,
    resolution,
    imageUrl: scene ? null : portraitUrl,
    audioUrl: audioUrl || null,
  };
}

export function currentStep(pipeline) {
  return pipeline.steps[pipeline.index];
}

export async function startStep(pipeline, apiKey) {
  const step = currentStep(pipeline);
  switch (step) {
    case "scene":
      return submit(
        endpoints.scene,
        { prompt: scenePrompt(pipeline.scene), images_list: [pipeline.portraitUrl], aspect_ratio: "9:16" },
        apiKey
      );
    case "tts":
      return submit(
        endpoints.tts,
        {
          prompt: pipeline.script,
          voice_id: pipeline.voiceId,
          emotion: pipeline.emotion,
          speed: pipeline.speed ?? 1,
          language_boost: pipeline.language,
          format: "mp3",
          sample_rate: 44100,
          bitrate: 128000,
          channel: 1,
        },
        apiKey
      );
    case "talk":
      return submit(
        endpoints.talk,
        {
          prompt:
            "The person talks naturally to the camera like a UGC creator, subtle head movements, natural blinking, " +
            "light hand gestures, expressive but authentic.",
          image_url: pipeline.imageUrl,
          audio_url: pipeline.audioUrl,
          resolution: pipeline.resolution,
        },
        apiKey
      );
    default:
      throw new Error(`Unknown pipeline step: ${step}`);
  }
}

async function advanceCreation(creation, data) {
  const pipeline = JSON.parse(creation.pipeline);
  const output = data.outputs?.[0] || null;
  const step = currentStep(pipeline);

  if (step === "scene") pipeline.imageUrl = output;
  if (step === "tts") pipeline.audioUrl = output;

  if (!output) {
    await prisma.creation.update({
      where: { id: creation.id },
      data: { status: "failed", error: `Step "${step}" finished without output` },
    });
    return;
  }

  if (pipeline.index >= pipeline.steps.length - 1) {
    await prisma.creation.update({
      where: { id: creation.id },
      data: { status: "completed", url: output, pipeline: JSON.stringify(pipeline) },
    });
    return;
  }

  // Claim this transition so a webhook and a manual refresh can't both start the next step.
  const claimed = await prisma.creation.updateMany({
    where: { id: creation.id, requestId: creation.requestId },
    data: { requestId: `${creation.requestId}:advancing` },
  });
  if (claimed.count === 0) return;

  pipeline.index += 1;
  try {
    const apiKey = await keyForUser(creation.userId);
    const nextRequestId = await startStep(pipeline, apiKey);
    await prisma.creation.update({
      where: { id: creation.id },
      data: { requestId: nextRequestId, status: "processing", pipeline: JSON.stringify(pipeline) },
    });
  } catch (error) {
    await prisma.creation.update({
      where: { id: creation.id },
      data: { status: "failed", error: error.message, pipeline: JSON.stringify(pipeline) },
    });
  }
}

// Applies a MuAPI status payload (from the webhook or from polling) to whatever record owns the request id.
// Returns false when no record matches.
export async function applyJobUpdate(data) {
  const requestId = data.id || data.request_id;
  if (!requestId) return false;

  const creation = await prisma.creation.findUnique({ where: { requestId } });
  if (creation) {
    if (isFailed(data)) {
      await prisma.creation.update({
        where: { id: creation.id },
        data: { status: "failed", error: data.error || "Generation failed" },
      });
    } else if (isCompleted(data)) {
      if (creation.pipeline) {
        await advanceCreation(creation, data);
      } else {
        await prisma.creation.update({
          where: { id: creation.id },
          data: { status: "completed", url: data.outputs?.[0] || null },
        });
      }
    } else {
      await prisma.creation.update({
        where: { id: creation.id },
        data: { status: data.status || "processing" },
      });
    }
    return true;
  }

  const portraitClone = await prisma.clone.findUnique({ where: { portraitRequestId: requestId } });
  if (portraitClone) {
    if (isFailed(data)) {
      await prisma.clone.update({
        where: { id: portraitClone.id },
        data: { portraitStatus: "failed", portraitError: data.error || "Portrait generation failed" },
      });
    } else if (isCompleted(data)) {
      await prisma.clone.update({
        where: { id: portraitClone.id },
        data: { portraitStatus: "completed", portraitUrl: data.outputs?.[0] || null },
      });
    }
    return true;
  }

  const voiceClone = await prisma.clone.findUnique({ where: { voiceRequestId: requestId } });
  if (voiceClone) {
    if (isFailed(data)) {
      await prisma.clone.update({
        where: { id: voiceClone.id },
        data: { voiceStatus: "failed", voiceError: data.error || "Voice cloning failed" },
      });
    } else if (isCompleted(data)) {
      await prisma.clone.update({ where: { id: voiceClone.id }, data: { voiceStatus: "ready" } });
    }
    return true;
  }

  return false;
}
