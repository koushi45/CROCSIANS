import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { getPlayerProgress } from "@/features/crocsians/progression";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHAT_LIMIT = 100;
const GLOBAL_CHAT_MAP = "global";

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

function serializeMessage(message: { id: string; userId: string; characterName: string; job: string; level: number; text: string; createdAt: Date; user: { crocsiansCharacterIcon: { updatedAt: Date } | null } }) {
  return {
    id: message.id,
    name: message.characterName,
    job: `${message.job} Lv.${message.level}`,
    text: message.text,
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
  createdAt: true,
  user: { select: { crocsiansCharacterIcon: { select: { updatedAt: true } } } },
} as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const messages = await prisma.crocsiansChatMessage.findMany({ where: { map: GLOBAL_CHAT_MAP }, orderBy: { createdAt: "desc" }, take: CHAT_LIMIT, select: messageSelection });
  return Response.json({ messages: messages.reverse().map(serializeMessage) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const body = await request.json().catch(() => null) as { text?: unknown } | null;
  if (!body || typeof body.text !== "string" || !body.text.trim()) return Response.json({ error: "メッセージが不正です" }, { status: 400 });
  const text = body.text.trim().slice(0, 300);
  const recent = await prisma.crocsiansChatMessage.findFirst({ where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 800) } }, select: { id: true } });
  if (recent) return Response.json({ error: "送信間隔が短すぎます" }, { status: 429 });
  const save = await prisma.crocsiansSave.findUnique({ where: { userId: user.id }, select: { data: true } });
  const identity = characterIdentity(save?.data, user.accountName);
  const message = await prisma.crocsiansChatMessage.create({ data: { userId: user.id, map: GLOBAL_CHAT_MAP, characterName: identity.name, job: identity.job, level: identity.level, text }, select: messageSelection });
  void pruneOldMessages().catch(() => {});
  return Response.json({ message: serializeMessage(message) });
}
