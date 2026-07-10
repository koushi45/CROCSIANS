import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { getPlayerProgress } from "@/features/crocsians/progression";
import sharp from "sharp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAT_LIMIT = 100;
const GLOBAL_CHAT_MAP = "global";
const IMAGE_LIFETIME_MS = 72 * 60 * 60 * 1000;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

async function pruneExpiredImages() {
  await prisma.crocsiansChatMessage.updateMany({
    where: { imageData: { not: null }, imageExpiresAt: { lte: new Date() } },
    data: { imageData: null, imageContentType: null },
  });
}

async function pruneOldMessages() {
  const oldMessages = await prisma.crocsiansChatMessage.findMany({
    where: { map: GLOBAL_CHAT_MAP },
    orderBy: { createdAt: "desc" },
    skip: CHAT_LIMIT,
    select: { id: true },
  });
  if (oldMessages.length > 0) {
    await prisma.crocsiansChatMessage.deleteMany({ where: { id: { in: oldMessages.map(({ id }) => id) } } });
  }
}

function characterIdentity(data: unknown, fallbackName: string) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return { name: fallbackName, job: "冒険者", level: 1 };
  const save = data as Record<string, unknown>;
  const name = typeof save.characterName === "string" && save.characterName.trim() ? save.characterName.trim().slice(0, 16) : fallbackName;
  const job = typeof save.job === "string" && save.job.trim() ? save.job.trim().slice(0, 12) : "冒険者";
  const progress = save.jobProgress && typeof save.jobProgress === "object" && !Array.isArray(save.jobProgress) ? (save.jobProgress as Record<string, unknown>)[job] : null;
  const experience = progress && typeof progress === "object" && !Array.isArray(progress) && typeof (progress as Record<string, unknown>).experience === "number" ? (progress as Record<string, number>).experience : 0;
  return { name, job, level: getPlayerProgress(experience).level };
}

function serializeMessage(message: { id: string; userId: string; characterName: string; job: string; level: number; text: string; imageData: Uint8Array<ArrayBuffer> | null; imageExpiresAt: Date | null; createdAt: Date; user: { crocsiansCharacterIcon: { updatedAt: Date } | null } }) {
  const imageExpired = Boolean(message.imageExpiresAt && message.imageExpiresAt.getTime() <= Date.now());
  return {
    id: message.id,
    name: message.characterName,
    job: `${message.job} Lv.${message.level}`,
    text: message.text,
    imageUrl: message.imageData && !imageExpired ? `/api/crocsians/chat/image?id=${encodeURIComponent(message.id)}` : null,
    imageExpired: Boolean(message.imageExpiresAt && (imageExpired || !message.imageData)),
    createdAt: message.createdAt.toISOString(),
    icon: message.user.crocsiansCharacterIcon ? `/api/crocsians/icon?userId=${encodeURIComponent(message.userId)}&v=${message.user.crocsiansCharacterIcon.updatedAt.getTime()}` : null,
  };
}

const messageSelection = {
  id: true,
  userId: true,
  characterName: true,
  job: true,
  level: true,
  text: true,
  imageData: true,
  imageExpiresAt: true,
  createdAt: true,
  user: { select: { crocsiansCharacterIcon: { select: { updatedAt: true } } } },
} as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  await pruneExpiredImages();
  const messages = await prisma.crocsiansChatMessage.findMany({ where: { map: GLOBAL_CHAT_MAP }, orderBy: { createdAt: "desc" }, take: CHAT_LIMIT, select: messageSelection });
  return Response.json({ messages: messages.reverse().map(serializeMessage) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const contentType = request.headers.get("content-type") ?? "";
  let textValue: unknown;
  let image: File | null = null;
  if (contentType.startsWith("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    textValue = form?.get("text");
    const imageValue = form?.get("image");
    image = imageValue instanceof File && imageValue.size > 0 ? imageValue : null;
  } else {
    const body = await request.json().catch(() => null) as { text?: unknown } | null;
    textValue = body?.text;
  }
  const text = typeof textValue === "string" ? textValue.trim().slice(0, 300) : "";
  if (!text && !image) return Response.json({ error: "メッセージまたは画像を指定してください" }, { status: 400 });
  if (image && image.size > MAX_IMAGE_BYTES) return Response.json({ error: "画像は15MB以下にしてください" }, { status: 413 });
  const recent = await prisma.crocsiansChatMessage.findFirst({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 800) } }, select: { id: true } });
  if (recent) return Response.json({ error: "送信間隔が短すぎます" }, { status: 429 });
  const save = await prisma.crocsiansSave.findUnique({ where: { userId: user.id }, select: { data: true } });
  const identity = characterIdentity(save?.data, user.accountName);
  let imageData: Uint8Array<ArrayBuffer> | undefined;
  if (image) {
    try {
      const processedImage = await sharp(new Uint8Array(await image.arrayBuffer()), { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
      imageData = new Uint8Array(processedImage);
    } catch {
      return Response.json({ error: "画像を処理できませんでした" }, { status: 400 });
    }
  }
  const message = await prisma.crocsiansChatMessage.create({ data: { userId: user.id, map: GLOBAL_CHAT_MAP, characterName: identity.name, job: identity.job, level: identity.level, text, imageData, imageContentType: imageData ? "image/webp" : undefined, imageExpiresAt: imageData ? new Date(Date.now() + IMAGE_LIFETIME_MS) : undefined }, select: messageSelection });
  void pruneOldMessages().catch(() => {});
  return Response.json({ message: serializeMessage(message) });
}
