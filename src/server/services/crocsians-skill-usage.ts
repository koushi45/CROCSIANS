import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";

export const MANAGED_SKILL_IDS = [
  "powerStrike",
  "sweepingBlow",
  "rageStrike",
  "flurry",
  "strongDuty",
  "moneyStrike",
  "brightenUp",
  "trapDisarm",
  "dangerSense",
  "safeFlee",
  "falsePraise",
  "heal",
  "groupHeal",
  "cure",
  "divineDevotion",
  "autoResurrect",
  "bloodWine",
  "holyBread",
  "starCrown",
  "eternalMercy",
  "borrowPower",
] as const;
export type ManagedSkillId = (typeof MANAGED_SKILL_IDS)[number];
export type SkillUses = Partial<Record<ManagedSkillId, number>>;
export type SkillUsageSnapshot = { skillUses: SkillUses; skillUsesResetAt: number | null; serverTime: number };

const RECOVERY_INTERVAL_MS = 15 * 60 * 1000;

export function getNextSkillResetAt(now = new Date()) {
  return new Date(Math.floor(now.getTime() / RECOVERY_INTERVAL_MS) * RECOVERY_INTERVAL_MS + RECOVERY_INTERVAL_MS);
}

function normalizeUses(value: Prisma.JsonValue): SkillUses {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(MANAGED_SKILL_IDS.flatMap((skillId) => {
    const count = value[skillId];
    return typeof count === "number" && Number.isFinite(count) && count > 0 ? [[skillId, Math.floor(count)]] : [];
  })) as SkillUses;
}

function skillLevelFromSave(data: Prisma.JsonValue, skillId: ManagedSkillId) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return 0;
  const cardinalSkillMap: Partial<Record<ManagedSkillId, string>> = {
    bloodWine: "batrump",
    holyBread: "bread",
    starCrown: "interstellar",
    eternalMercy: "elizabeth",
    borrowPower: "mushroom",
  };
  const cardinalId = cardinalSkillMap[skillId];
  if (cardinalId) {
    const equippedCardinal = data.equippedCardinal;
    if (equippedCardinal !== cardinalId) return 0;
    const cardinalLevels = data.cardinalLevels;
    if (!cardinalLevels || typeof cardinalLevels !== "object" || Array.isArray(cardinalLevels)) return 0;
    const level = cardinalLevels[cardinalId];
    return typeof level === "number" && Number.isFinite(level) ? Math.max(0, Math.min(5, Math.floor(level))) : 0;
  }
  const skillLevels = data.skillLevels;
  if (!skillLevels || typeof skillLevels !== "object" || Array.isArray(skillLevels)) return 0;
  const level = skillLevels[skillId];
  return typeof level === "number" && Number.isFinite(level) ? Math.max(0, Math.min(5, Math.floor(level))) : 0;
}

function snapshot(uses: SkillUses, resetAt: Date | null, now: Date): SkillUsageSnapshot {
  return { skillUses: uses, skillUsesResetAt: resetAt?.getTime() ?? null, serverTime: now.getTime() };
}

export async function getSkillUsage(userId: string): Promise<SkillUsageSnapshot> {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const nextResetAt = getNextSkillResetAt(now);
    const row = await tx.crocsiansSkillUsage.upsert({
      where: { userId },
      create: { userId, uses: {} },
      update: {},
      select: { uses: true, resetAt: true },
    });
    const expired = Boolean(row.resetAt && row.resetAt.getTime() <= now.getTime());
    const uses = expired ? {} : normalizeUses(row.uses);
    if (expired || row.resetAt?.getTime() !== nextResetAt.getTime()) {
      await tx.crocsiansSkillUsage.update({ where: { userId }, data: { uses: uses as Prisma.InputJsonObject, resetAt: nextResetAt } });
    }
    return snapshot(uses, nextResetAt, now);
  });
}

export async function consumeSkillUse(userId: string, skillId: ManagedSkillId) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const nextResetAt = getNextSkillResetAt(now);
    await tx.crocsiansSkillUsage.upsert({ where: { userId }, create: { userId, uses: {} }, update: {} });
    const rows = await tx.$queryRaw<{ uses: Prisma.JsonValue; resetAt: Date | null }[]>`
      SELECT "uses", "resetAt" FROM "CrocsiansSkillUsage" WHERE "userId" = ${userId} FOR UPDATE
    `;
    const save = await tx.crocsiansSave.findUnique({ where: { userId }, select: { data: true } });
    const skillLevel = skillLevelFromSave(save?.data ?? null, skillId);
    const limit = skillLevel > 0
      ? skillId === "falsePraise" || skillId === "autoResurrect" || skillId === "eternalMercy" || skillId === "borrowPower" || skillId === "starCrown"
        ? skillLevel
        : skillId === "bloodWine" || skillId === "holyBread"
          ? skillLevel + 2
        : skillId === "strongDuty" || skillId === "divineDevotion" || skillId === "safeFlee"
          ? 5
          : skillLevel + 2
      : 0;
    const row = rows[0];
    const expired = Boolean(row?.resetAt && row.resetAt.getTime() <= now.getTime());
    const uses = expired ? {} : normalizeUses(row?.uses ?? {});
    const resetAt = nextResetAt;
    const used = uses[skillId] ?? 0;
    const allowed = limit > 0 && used < limit;

    if (allowed) {
      uses[skillId] = used + 1;
    }
    if (allowed || expired || row?.resetAt?.getTime() !== nextResetAt.getTime()) {
      await tx.crocsiansSkillUsage.update({
        where: { userId },
        data: { uses: uses as Prisma.InputJsonObject, resetAt },
      });
    }

    return { ...snapshot(uses, resetAt, now), allowed, skillLevel, limit };
  });
}

export async function consumeSkillUseWithLimit(userId: string, skillId: ManagedSkillId, skillLevel: number, limit: number) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const nextResetAt = getNextSkillResetAt(now);
    await tx.crocsiansSkillUsage.upsert({ where: { userId }, create: { userId, uses: {} }, update: {} });
    const rows = await tx.$queryRaw<{ uses: Prisma.JsonValue; resetAt: Date | null }[]>`
      SELECT "uses", "resetAt" FROM "CrocsiansSkillUsage" WHERE "userId" = ${userId} FOR UPDATE
    `;
    const row = rows[0];
    const expired = Boolean(row?.resetAt && row.resetAt.getTime() <= now.getTime());
    const uses = expired ? {} : normalizeUses(row?.uses ?? {});
    const resetAt = nextResetAt;
    const safeSkillLevel = Math.max(0, Math.min(5, Math.floor(skillLevel)));
    const safeLimit = Math.max(0, Math.floor(limit));
    const used = uses[skillId] ?? 0;
    const allowed = safeLimit > 0 && used < safeLimit;

    if (allowed) uses[skillId] = used + 1;
    if (allowed || expired || row?.resetAt?.getTime() !== nextResetAt.getTime()) {
      await tx.crocsiansSkillUsage.update({
        where: { userId },
        data: { uses: uses as Prisma.InputJsonObject, resetAt },
      });
    }

    return { ...snapshot(uses, resetAt, now), allowed, skillLevel: safeSkillLevel, limit: safeLimit };
  });
}

export async function refundSkillUses(userId: string, exceptSkillIds: ManagedSkillId[]) {
  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const nextResetAt = getNextSkillResetAt(now);
    await tx.crocsiansSkillUsage.upsert({ where: { userId }, create: { userId, uses: {} }, update: {} });
    const rows = await tx.$queryRaw<{ uses: Prisma.JsonValue; resetAt: Date | null }[]>`
      SELECT "uses", "resetAt" FROM "CrocsiansSkillUsage" WHERE "userId" = ${userId} FOR UPDATE
    `;
    const row = rows[0];
    const expired = Boolean(row?.resetAt && row.resetAt.getTime() <= now.getTime());
    const uses = expired ? {} : normalizeUses(row?.uses ?? {});
    const except = new Set(exceptSkillIds);
    for (const skillId of MANAGED_SKILL_IDS) {
      if (except.has(skillId)) continue;
      const used = uses[skillId] ?? 0;
      if (used > 0) uses[skillId] = used - 1;
      if (uses[skillId] === 0) delete uses[skillId];
    }
    await tx.crocsiansSkillUsage.update({ where: { userId }, data: { uses: uses as Prisma.InputJsonObject, resetAt: nextResetAt } });
    return snapshot(uses, nextResetAt, now);
  });
}
