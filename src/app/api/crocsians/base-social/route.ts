import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { getPlayerProgress } from "@/features/crocsians/progression";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_STOCK_COUNT = 24;
const CRAFTING_BUILDINGS = new Set(["weapon", "armor", "apothecary", "furnace", "fountain", "garden", "gazebo", "clockTower", "monument", "pond", "marketStall", "campfire", "flowerArch", "streetLamp", "storageShed", "courtyard"]);

function unauthorized() {
  return Response.json({ error: "ログインが必要です。" }, { status: 401 });
}

function jstDateKey(date = new Date()) {
  return new Date(date.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function characterSummary(userId: string, dataValue: unknown, iconUpdatedAt?: Date | null) {
  const data = objectValue(dataValue);
  const job = typeof data.job === "string" ? data.job : "戦士";
  const jobProgress = objectValue(data.jobProgress);
  const progress = objectValue(jobProgress[job]);
  const experience = typeof progress.experience === "number" ? progress.experience : 0;
  return {
    ownerId: userId,
    name: typeof data.characterName === "string" ? data.characterName.slice(0, 16) : "冒険者",
    job,
    level: getPlayerProgress(experience).level,
    icon: iconUpdatedAt ? `/api/crocsians/icon?userId=${encodeURIComponent(userId)}&v=${iconUpdatedAt.getTime()}` : null,
  };
}

function publicLayout(dataValue: unknown) {
  const data = objectValue(dataValue);
  const buildings = objectValue(data.buildings);
  const baseTiles = Array.isArray(data.baseTiles) ? data.baseTiles : [];
  return { buildings, baseTiles };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const url = new URL(request.url);
  const requestedOwnerId = url.searchParams.get("ownerId") || user.id;
  const saves = await prisma.crocsiansSave.findMany({
    where: { userId: { not: user.id } },
    orderBy: { updatedAt: "desc" },
    take: 40,
    select: { userId: true, data: true, updatedAt: true, user: { select: { crocsiansCharacterIcon: { select: { updatedAt: true } } } } },
  });
  const ownerIds = saves.map((save) => save.userId);
  const interactions = ownerIds.length ? await prisma.crocsiansBaseInteraction.findMany({ where: { ownerId: { in: ownerIds } }, select: { ownerId: true, visitorId: true, liked: true, favorited: true } }) : [];
  const directory = saves.map((save) => {
    const rows = interactions.filter((entry) => entry.ownerId === save.userId);
    const mine = rows.find((entry) => entry.visitorId === user.id);
    return {
      ...characterSummary(save.userId, save.data, save.user.crocsiansCharacterIcon?.updatedAt),
      likes: rows.filter((entry) => entry.liked).length,
      favorited: Boolean(mine?.favorited),
      liked: Boolean(mine?.liked),
      updatedAt: save.updatedAt.toISOString(),
    };
  }).sort((a, b) => Number(b.favorited) - Number(a.favorited) || b.likes - a.likes || b.updatedAt.localeCompare(a.updatedAt));

  const selectedSave = await prisma.crocsiansSave.findUnique({
    where: { userId: requestedOwnerId },
    select: { userId: true, data: true, updatedAt: true, user: { select: { crocsiansCharacterIcon: { select: { updatedAt: true } } } } },
  });
  if (!selectedSave) return Response.json({ error: "拠点が見つかりません。" }, { status: 404 });

  const [selectedInteractions, relationship, visitorRows] = await Promise.all([
    prisma.crocsiansBaseInteraction.findMany({ where: { ownerId: requestedOwnerId }, select: { liked: true } }),
    requestedOwnerId === user.id ? null : prisma.crocsiansBaseInteraction.findUnique({ where: { ownerId_visitorId: { ownerId: requestedOwnerId, visitorId: user.id } } }),
    prisma.crocsiansBaseInteraction.findMany({
      where: { ownerId: requestedOwnerId, lastVisitedAt: { not: null } },
      orderBy: { lastVisitedAt: "desc" },
      take: 8,
      select: {
        visitorId: true,
        lastVisitedAt: true,
        visitor: { select: { crocsiansSave: { select: { data: true } }, crocsiansCharacterIcon: { select: { updatedAt: true } } } },
      },
    }),
  ]);
  const visitors = visitorRows.map((entry) => ({
    ...characterSummary(entry.visitorId, entry.visitor.crocsiansSave?.data, entry.visitor.crocsiansCharacterIcon?.updatedAt),
    visitedAt: entry.lastVisitedAt?.toISOString() ?? null,
  }));

  return Response.json({
    viewerId: user.id,
    directory,
    base: {
      ...characterSummary(selectedSave.userId, selectedSave.data, selectedSave.user.crocsiansCharacterIcon?.updatedAt),
      ...publicLayout(selectedSave.data),
      likes: selectedInteractions.filter((entry) => entry.liked).length,
      liked: Boolean(relationship?.liked),
      favorited: Boolean(relationship?.favorited),
      helpedToday: relationship?.lastHelpDate === jstDateKey(),
      visitors,
      updatedAt: selectedSave.updatedAt.toISOString(),
    },
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";
  const ownerId = typeof body?.ownerId === "string" ? body.ownerId : "";
  if (!ownerId || ownerId === user.id) return Response.json({ error: "対象の拠点を指定してください。" }, { status: 400 });
  const ownerSave = await prisma.crocsiansSave.findUnique({ where: { userId: ownerId }, select: { userId: true } });
  if (!ownerSave) return Response.json({ error: "拠点が見つかりません。" }, { status: 404 });

  if (action === "visit") {
    await prisma.crocsiansBaseInteraction.upsert({
      where: { ownerId_visitorId: { ownerId, visitorId: user.id } },
      create: { ownerId, visitorId: user.id, lastVisitedAt: new Date() },
      update: { lastVisitedAt: new Date() },
    });
    return Response.json({ ok: true });
  }

  if (action === "like" || action === "favorite") {
    const value = body?.value === true;
    await prisma.crocsiansBaseInteraction.upsert({
      where: { ownerId_visitorId: { ownerId, visitorId: user.id } },
      create: { ownerId, visitorId: user.id, ...(action === "like" ? { liked: value } : { favorited: value }) },
      update: action === "like" ? { liked: value } : { favorited: value },
    });
    return Response.json({ ok: true });
  }

  if (action === "help") {
    const buildingCell = typeof body?.buildingCell === "number" ? Math.floor(body.buildingCell) : -1;
    const today = jstDateKey();
    const result = await prisma.$transaction(async (tx) => {
      const interaction = await tx.crocsiansBaseInteraction.findUnique({ where: { ownerId_visitorId: { ownerId, visitorId: user.id } } });
      if (interaction?.lastHelpDate === today) return { error: "この拠点は本日すでに支援しています。" };
      const save = await tx.crocsiansSave.findUnique({ where: { userId: ownerId }, select: { data: true } });
      if (!save) return { error: "拠点が見つかりません。" };
      const data = objectValue(JSON.parse(JSON.stringify(save.data)));
      const buildings = objectValue(data.buildings);
      const building = objectValue(buildings[String(buildingCell)]);
      const kind = typeof building.kind === "string" ? building.kind : "";
      if (!kind || CRAFTING_BUILDINGS.has(kind)) return { error: "この施設は生産支援の対象外です。" };
      const stockCount = typeof building.stockCount === "number" ? Math.max(0, Math.floor(building.stockCount)) : 0;
      if (stockCount >= MAX_STOCK_COUNT) return { error: "この施設のストックは満杯です。" };
      const nextStockCount = stockCount + 1;
      building.stockCount = nextStockCount;
      building.ready = nextStockCount >= MAX_STOCK_COUNT;
      buildings[String(buildingCell)] = building;
      data.buildings = buildings;
      await tx.crocsiansSave.update({ where: { userId: ownerId }, data: { data: data as Prisma.InputJsonObject } });
      await tx.crocsiansBaseInteraction.upsert({
        where: { ownerId_visitorId: { ownerId, visitorId: user.id } },
        create: { ownerId, visitorId: user.id, lastVisitedAt: new Date(), lastHelpDate: today },
        update: { lastVisitedAt: new Date(), lastHelpDate: today },
      });
      return { ok: true, stockCount: nextStockCount };
    });
    if ("error" in result) return Response.json(result, { status: 409 });
    return Response.json(result);
  }

  return Response.json({ error: "操作が不正です。" }, { status: 400 });
}
