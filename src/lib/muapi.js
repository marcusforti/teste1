import { prisma } from "@/lib/prisma";

const MUAPI_BASE = process.env.MUAPI_BASE_URL || "https://api.muapi.ai/api/v1";

// Same key resolution as /api/generate: a user-supplied key wins and makes the job free of app credits.
export function resolveApiKey(req, body, session) {
  const headerApiKey = req.headers.get("x-custom-api-key");
  const customApiKey = headerApiKey || body?.customApiKey || session?.user?.customApiKey || null;
  const isUsingCustomKey = Boolean(customApiKey && customApiKey.trim().length > 0);
  return {
    apiKey: isUsingCustomKey ? customApiKey.trim() : process.env.UGC_API_KEY,
    isUsingCustomKey,
  };
}

// Webhook callbacks (WEBHOOK_URL may be unset in local dev; jobs are then advanced by /api/jobs/[requestId]/refresh).
export async function keyForUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { customApiKey: true } });
  return user?.customApiKey?.trim() || process.env.UGC_API_KEY;
}

export async function submit(endpoint, payload, apiKey) {
  if (!apiKey) throw new Error("API Key not configured");

  const body = { ...payload };
  if (process.env.WEBHOOK_URL) {
    body.webhook_url = `${process.env.WEBHOOK_URL}/api/webhook/muapi`;
  }

  const response = await fetch(`${MUAPI_BASE}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MUAPI ${endpoint} failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const requestId = data.request_id || data.id;
  if (!requestId) throw new Error(`MUAPI ${endpoint} returned no request id`);
  return requestId;
}

export async function fetchResult(requestId, apiKey) {
  const response = await fetch(`${MUAPI_BASE}/predictions/${requestId}/result`, {
    headers: { "Content-Type": "application/json", "x-api-key": apiKey },
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MUAPI result failed: ${response.status} ${errorText}`);
  }
  const data = await response.json();
  return { id: requestId, ...data };
}

export function isFailed(data) {
  return data.status === "failed" || Boolean(data.error && data.error !== "");
}

export function isCompleted(data) {
  return data.status === "completed" || (Array.isArray(data.outputs) && data.outputs.length > 0);
}

// Returns an error response body, or null when the user can afford `amount`.
export async function checkCredits(userId, amount, isUsingCustomKey) {
  if (isUsingCustomKey || amount <= 0) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { credits: true } });
  if (!user || user.credits < amount) {
    return `Insufficient credits. This requires ${amount} credits but you only have ${user?.credits || 0}.`;
  }
  return null;
}

export async function chargeCredits(userId, amount, isUsingCustomKey) {
  if (isUsingCustomKey || amount <= 0) return;
  await prisma.user.update({ where: { id: userId }, data: { credits: { decrement: amount } } });
}
