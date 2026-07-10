import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PresenceEntry = {
  id: string;
  userId: string;
  map: string;
  name: string;
  job: string;
  level: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  luck: number;
  skillLevels: Record<string, number>;
  cardinalLevels: Partial<Record<"bread" | "batrump" | "interstellar" | "elizabeth" | "mushroom", number>>;
  equippedCardinal: "bread" | "batrump" | "interstellar" | "elizabeth" | "mushroom" | null;
  equippedWeapon: string | null;
  equippedArmor: string | null;
  equippedWeaponHighQuality: boolean;
  equippedArmorHighQuality: boolean;
  icon: string | null;
  updatedAt: number;
};

const PRESENCE_TTL_MS = 15_000;
const presenceGlobal = globalThis as typeof globalThis & { crocsiansPresence?: Map<string, PresenceEntry> };
const presence = presenceGlobal.crocsiansPresence ?? new Map<string, PresenceEntry>();
presenceGlobal.crocsiansPresence = presence;

function prunePresence() {
  const expiredBefore = Date.now() - PRESENCE_TTL_MS;
  for (const [id, player] of presence) {
    if (player.updatedAt < expiredBefore) presence.delete(id);
  }
}

function playersOnMap(map: string) {
  prunePresence();
  return [...presence.values()]
    .filter((player) => player.map === map)
    .sort((left, right) => left.updatedAt - right.updatedAt)
    .map(({ id, name, job, level, hp, maxHp, atk, def, luck, skillLevels, cardinalLevels, equippedCardinal, equippedWeapon, equippedArmor, equippedWeaponHighQuality, equippedArmorHighQuality, icon }) => ({ id, name, job, level, hp, maxHp, atk, def, luck, skillLevels, cardinalLevels, equippedCardinal, equippedWeapon, equippedArmor, equippedWeaponHighQuality, equippedArmorHighQuality, icon }));
}

function profileSkillLevels(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 30).flatMap(([key, level]) => typeof level === "number" && Number.isFinite(level) ? [[key.slice(0, 40), Math.max(0, Math.min(5, Math.floor(level)))]] : []));
}

function equipmentName(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : null;
}

function cardinalLevels(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return Object.fromEntries((["bread", "batrump", "interstellar", "elizabeth", "mushroom"] as const).flatMap((id) => {
    const level = source[id];
    return typeof level === "number" && Number.isFinite(level) && level > 0 ? [[id, Math.max(1, Math.min(5, Math.floor(level)))]] : [];
  }));
}

function cardinalId(value: unknown) {
  return value === "bread" || value === "batrump" || value === "interstellar" || value === "elizabeth" || value === "mushroom" ? value : null;
}

function isMapKey(value: unknown): value is string {
  return value === "town" || (typeof value === "string" && value.startsWith("explore:") && value.length <= 80);
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const map = new URL(request.url).searchParams.get("map");
  if (!isMapKey(map)) return Response.json({ error: "マップ指定が不正です" }, { status: 400 });
  return Response.json({ players: playersOnMap(map) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.clientId !== "string" || body.clientId.length > 100) {
    return Response.json({ error: "接続情報が不正です" }, { status: 400 });
  }
  const current = presence.get(body.clientId);
  if (current && current.userId !== user.id) return Response.json({ error: "接続情報の所有者が一致しません" }, { status: 403 });
  if (body.leave === true) {
    if (presence.get(body.clientId)?.userId === user.id) presence.delete(body.clientId);
    return Response.json({ ok: true });
  }
  if (!isMapKey(body.map) || typeof body.name !== "string" || !body.name.trim()) {
    return Response.json({ error: "プレイヤー情報が不正です" }, { status: 400 });
  }
  const iconRecord = await prisma.crocsiansCharacterIcon.findUnique({ where: { userId: user.id }, select: { updatedAt: true } });
  const icon = iconRecord ? `/api/crocsians/icon?userId=${encodeURIComponent(user.id)}&v=${iconRecord.updatedAt.getTime()}` : null;
  presence.set(body.clientId, {
    id: body.clientId,
    userId: user.id,
    map: body.map,
    name: body.name.trim().slice(0, 16),
    job: typeof body.job === "string" ? body.job.slice(0, 12) : "冒険者",
    level: typeof body.level === "number" ? Math.max(1, Math.min(100, Math.floor(body.level))) : 1,
    hp: typeof body.hp === "number" ? Math.max(0, Math.min(1_000_000, Math.floor(body.hp))) : 100,
    maxHp: typeof body.maxHp === "number" ? Math.max(1, Math.min(1_000_000, Math.floor(body.maxHp))) : 100,
    atk: typeof body.atk === "number" ? Math.max(1, Math.min(1_000_000, Math.floor(body.atk))) : 1,
    def: typeof body.def === "number" ? Math.max(0, Math.min(1_000_000, Math.floor(body.def))) : 0,
    luck: typeof body.luck === "number" ? Math.max(1, Math.min(1_000_000, Math.floor(body.luck))) : 1,
    skillLevels: profileSkillLevels(body.skillLevels),
    cardinalLevels: cardinalLevels(body.cardinalLevels),
    equippedCardinal: cardinalId(body.equippedCardinal),
    equippedWeapon: equipmentName(body.equippedWeapon),
    equippedArmor: equipmentName(body.equippedArmor),
    equippedWeaponHighQuality: body.equippedWeaponHighQuality === true,
    equippedArmorHighQuality: body.equippedArmorHighQuality === true,
    icon,
    updatedAt: Date.now(),
  });
  return Response.json({ players: playersOnMap(body.map) });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const body = await request.json().catch(() => null) as { clientId?: unknown } | null;
  if (typeof body?.clientId === "string" && presence.get(body.clientId)?.userId === user.id) presence.delete(body.clientId);
  return Response.json({ ok: true });
}
