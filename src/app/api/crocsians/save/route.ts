import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { decodeCharacterIconDataUrl } from "@/server/services/crocsians-icon";
import type { Prisma } from "@/generated/prisma/client";
import materialCatalog from "@/features/crocsians/materials.json";
import { getPlayerProgress, papalBadgesEarnedFromExperience, PLAYER_PROGRESSION_VERSION } from "@/features/crocsians/progression";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_SAVE_BYTES = 2_000_000;
const PRODUCTION_INTERVAL_MS = 30 * 60 * 1000;
const SMELTING_INTERVAL_MS = 5 * 60 * 1000;
const MAX_STOCK_COUNT = 24;
const CRAFTING_BUILDINGS = new Set(["weapon", "armor", "apothecary", "furnace", "fountain", "garden", "gazebo", "clockTower", "monument", "pond", "marketStall", "campfire", "flowerArch", "streetLamp", "storageShed", "courtyard"]);
const JOBS = ["戦士", "商人", "職人", "盗賊", "僧侶"] as const;
const DELETE_CONFIRMATION_PHRASE = "らすたーしょくぱんまん";
const MERCHANT_SKILL_RESET_VERSION = 1;
const PC_UI_LAYOUT_VERSION = 1;
const MERCHANT_SKILL_IDS = ["bargain", "negotiation", "regularCustomer", "marketResearch", "extortion"] as const;
function createMerchantStock(data: Record<string, unknown>) {
  const skillLevels = data.skillLevels && typeof data.skillLevels === "object" && !Array.isArray(data.skillLevels) ? data.skillLevels as Record<string, unknown> : {};
  const regularCustomerLevel = typeof skillLevels.regularCustomer === "number" ? Math.max(0, skillLevels.regularCustomer) : 0;
  const secretTradeLevel = typeof skillLevels.marketResearch === "number" ? Math.max(0, skillLevels.marketResearch) : 0;
  const stockMultiplier = 1 + regularCustomerLevel * 0.04;
  return Object.fromEntries(materialCatalog.filter((material) => material.rarity === "N" || material.rarity === "R" || (material.rarity === "SR" && secretTradeLevel >= 1)).map((material) => {
    const standardStock = material.rarity === "N" ? 20 + (material.id * 17) % 41 : material.rarity === "R" ? 4 + (material.id * 7) % 12 : material.rarity === "SR" ? 2 + (material.id * 5) % 5 : 1 + (material.id * 3) % 3;
    const baseStock = material.category === "魔物素材" ? Math.max(1, Math.ceil(standardStock / 3)) : standardStock;
    const stock = Math.ceil(baseStock * stockMultiplier);
    return [material.name, material.rarity === "SR" ? Math.min(2, stock) : stock];
  }));
}

function merchantRestockKey(serverTime: number) {
  const jstBusinessDate = new Date(serverTime + 9 * 60 * 60 * 1000 - 4 * 60 * 60 * 1000);
  return jstBusinessDate.toISOString().slice(0, 10);
}

function normalizeAccountData(value: unknown, serverTime = Date.now()) {
  const data = JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
  let changed = false;
  const restockKey = merchantRestockKey(serverTime);
  if (data.playerProgressionVersion !== PLAYER_PROGRESSION_VERSION) {
    const savedProgress = data.jobProgress && typeof data.jobProgress === "object" && !Array.isArray(data.jobProgress) ? data.jobProgress as Record<string, unknown> : {};
    const activeJob = typeof data.job === "string" ? data.job : "戦士";
    const legacyExperience = typeof data.experience === "number" ? data.experience : 0;
    data.jobProgress = Object.fromEntries(JOBS.map((job) => {
      const progress = savedProgress[job];
      const progressData = progress && typeof progress === "object" && !Array.isArray(progress) ? progress as Record<string, unknown> : {};
      const experience = Math.max(0, Math.floor(typeof progressData.experience === "number" ? progressData.experience : job === activeJob ? legacyExperience : 0));
      return [job, { experience, skillPoints: getPlayerProgress(experience).level - 1 }];
    }));
    data.skillLevels = {};
    data.playerProgressionVersion = PLAYER_PROGRESSION_VERSION;
    changed = true;
  }
  if (data.merchantSkillResetVersion !== MERCHANT_SKILL_RESET_VERSION) {
    const skillLevels = data.skillLevels && typeof data.skillLevels === "object" && !Array.isArray(data.skillLevels) ? data.skillLevels as Record<string, unknown> : {};
    for (const skillId of MERCHANT_SKILL_IDS) delete skillLevels[skillId];
    data.skillLevels = skillLevels;

    const jobProgress = data.jobProgress && typeof data.jobProgress === "object" && !Array.isArray(data.jobProgress) ? data.jobProgress as Record<string, unknown> : {};
    const merchantProgressValue = jobProgress["商人"];
    const merchantProgress = merchantProgressValue && typeof merchantProgressValue === "object" && !Array.isArray(merchantProgressValue) ? merchantProgressValue as Record<string, unknown> : {};
    const merchantExperience = Math.max(0, Math.floor(typeof merchantProgress.experience === "number" ? merchantProgress.experience : 0));
    jobProgress["商人"] = { ...merchantProgress, experience: merchantExperience, skillPoints: getPlayerProgress(merchantExperience).level - 1 };
    data.jobProgress = jobProgress;

    const merchantStock = data.merchantStock && typeof data.merchantStock === "object" && !Array.isArray(data.merchantStock) ? data.merchantStock as Record<string, unknown> : {};
    for (const material of materialCatalog) {
      if (material.rarity === "SR" || material.rarity === "SSR") delete merchantStock[material.name];
    }
    data.merchantStock = merchantStock;
    data.merchantSkillResetVersion = MERCHANT_SKILL_RESET_VERSION;
    changed = true;
  }
  // 全アカウントへ一度だけ標準配置をDB側から適用する。適用後はクライアントの選択を保持する。
  if (data.pcUiLayoutVersion !== PC_UI_LAYOUT_VERSION) {
    data.expeditionPanelSide = "right";
    data.chatPanelSide = "left";
    data.pcUiLayoutVersion = PC_UI_LAYOUT_VERSION;
    changed = true;
  }
  if (data.merchantStockRestockKey !== restockKey) {
    data.merchantStock = createMerchantStock(data);
    data.merchantStockRestockKey = restockKey;
    changed = true;
  }

  const savedJobProgress = data.jobProgress && typeof data.jobProgress === "object" && !Array.isArray(data.jobProgress) ? data.jobProgress as Record<string, unknown> : {};
  const savedPapalBonuses = data.papalSpBonuses && typeof data.papalSpBonuses === "object" && !Array.isArray(data.papalSpBonuses) ? data.papalSpBonuses as Record<string, unknown> : {};
  let remainingPapalBadges = JOBS.reduce((total, job) => {
    const progress = savedJobProgress[job];
    const progressData = progress && typeof progress === "object" && !Array.isArray(progress) ? progress as Record<string, unknown> : {};
    const experience = typeof progressData.experience === "number" && Number.isFinite(progressData.experience) ? Math.max(0, Math.floor(progressData.experience)) : 0;
    return total + papalBadgesEarnedFromExperience(experience);
  }, 0);
  const normalizedPapalBonuses = Object.fromEntries(JOBS.map((job) => {
    const requested = typeof savedPapalBonuses[job] === "number" && Number.isFinite(savedPapalBonuses[job]) ? Math.max(0, Math.min(5, Math.floor(savedPapalBonuses[job] as number))) : 0;
    const accepted = Math.min(requested, remainingPapalBadges);
    remainingPapalBadges -= accepted;
    return [job, accepted];
  }));
  if (JSON.stringify(data.papalSpBonuses ?? {}) !== JSON.stringify(normalizedPapalBonuses)) changed = true;
  data.papalSpBonuses = normalizedPapalBonuses;
  const craftedItems = data.craftedItems && typeof data.craftedItems === "object" && !Array.isArray(data.craftedItems) ? data.craftedItems as Record<string, unknown> : {};
  if (craftedItems.papalBadge !== remainingPapalBadges) changed = true;
  craftedItems.papalBadge = remainingPapalBadges;
  data.craftedItems = craftedItems;

  if (data.merchantStock && typeof data.merchantStock === "object" && !Array.isArray(data.merchantStock)) {
    const stock = data.merchantStock as Record<string, unknown>;
    for (const material of materialCatalog) {
      if (material.rarity !== "SR" && material.rarity !== "SSR") continue;
      const current = stock[material.name];
      if (typeof current === "number") {
        const normalized = Math.max(0, Math.min(2, Math.floor(current)));
        if (normalized === current) continue;
        stock[material.name] = normalized;
        changed = true;
      }
    }
  }

  if (data.materialInventory && typeof data.materialInventory === "object" && !Array.isArray(data.materialInventory)) {
    const inventory = data.materialInventory as Record<string, unknown>;
    for (const [name, quantity] of Object.entries(inventory)) {
      const normalized = typeof quantity === "number" && Number.isFinite(quantity) ? Math.max(0, Math.floor(quantity)) : 0;
      if (!name.trim() || normalized < 1) {
        delete inventory[name];
        changed = true;
      } else if (normalized !== quantity) {
        inventory[name] = normalized;
        changed = true;
      }
    }
  }

  if (data.buildings && typeof data.buildings === "object" && !Array.isArray(data.buildings)) {
    for (const buildingValue of Object.values(data.buildings)) {
      if (!buildingValue || typeof buildingValue !== "object" || Array.isArray(buildingValue)) continue;
      const building = buildingValue as Record<string, unknown>;
      if (building.kind === "furnace") {
        const job = building.smeltingJob && typeof building.smeltingJob === "object" && !Array.isArray(building.smeltingJob) ? building.smeltingJob as Record<string, unknown> : null;
        if (!job || typeof job.oreName !== "string" || typeof job.ingotName !== "string") {
          if (building.ready === true || building.smeltingJob !== null) {
            building.ready = false;
            building.smeltingJob = null;
            changed = true;
          }
          continue;
        }
        const quantity = Math.max(1, Math.floor(typeof job.quantity === "number" ? job.quantity : 1));
        const startedAt = typeof job.startedAt === "number" ? job.startedAt : serverTime;
        const completedAt = typeof job.completedAt === "number" ? job.completedAt : startedAt + quantity * SMELTING_INTERVAL_MS;
        job.quantity = quantity;
        job.startedAt = startedAt;
        job.completedAt = completedAt;
        const ready = completedAt <= serverTime;
        if (building.ready !== ready) {
          building.ready = ready;
          changed = true;
        }
        continue;
      }
      if (typeof building.kind !== "string" || CRAFTING_BUILDINGS.has(building.kind) || building.ready === true) continue;
      const stockCount = typeof building.stockCount === "number" ? Math.max(0, Math.floor(building.stockCount)) : 0;
      const lastProductionAt = typeof building.lastProductionAt === "number" ? building.lastProductionAt : serverTime;
      const producedCount = Math.floor(Math.max(0, serverTime - lastProductionAt) / PRODUCTION_INTERVAL_MS);
      if (producedCount < 1) continue;
      const nextStock = Math.min(MAX_STOCK_COUNT, stockCount + producedCount);
      building.stockCount = nextStock;
      building.ready = nextStock === MAX_STOCK_COUNT;
      building.lastProductionAt = nextStock === MAX_STOCK_COUNT ? serverTime : lastProductionAt + producedCount * PRODUCTION_INTERVAL_MS;
      changed = true;
    }
  }
  return { data, changed };
}

function unauthorized() {
  return Response.json({ error: "ログインが必要です。" }, { status: 401 });
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const [storedSave, icon] = await Promise.all([
    prisma.crocsiansSave.findUnique({ where: { userId: user.id }, select: { data: true, version: true, updatedAt: true } }),
    prisma.crocsiansCharacterIcon.findUnique({ where: { userId: user.id }, select: { updatedAt: true } }),
  ]);

  let save = storedSave;
  if (storedSave) {
    const normalized = normalizeAccountData(storedSave.data);
    if (normalized.changed) {
      save = await prisma.crocsiansSave.update({ where: { userId: user.id }, data: { data: normalized.data as Prisma.InputJsonObject }, select: { data: true, version: true, updatedAt: true } });
    }
  }

  return Response.json({ save, characterIcon: icon ? `/api/crocsians/icon?userId=${encodeURIComponent(user.id)}&v=${icon.updatedAt.getTime()}` : null });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("data" in body) || !body.data || typeof body.data !== "object" || Array.isArray(body.data)) {
    return Response.json({ error: "セーブデータが不正です。" }, { status: 400 });
  }

  const iconDataUrl = "iconDataUrl" in body ? body.iconDataUrl : undefined;
  const decodedIcon = iconDataUrl === undefined || iconDataUrl === null ? null : decodeCharacterIconDataUrl(iconDataUrl);
  if (iconDataUrl !== undefined && iconDataUrl !== null && !decodedIcon) {
    return Response.json({ error: "アイコンは256×256px、1MB以下の画像にしてください。" }, { status: 400 });
  }

  const serialized = JSON.stringify(body.data);
  if (new TextEncoder().encode(serialized).byteLength > MAX_SAVE_BYTES) {
    return Response.json({ error: "セーブデータのサイズが上限を超えています。" }, { status: 413 });
  }
  const dataObject = normalizeAccountData(JSON.parse(serialized)).data;
  if (iconDataUrl !== undefined) dataObject.characterIcon = decodedIcon ? "/api/crocsians/icon" : null;
  else dataObject.characterIcon = typeof dataObject.characterIcon === "string" && dataObject.characterIcon.startsWith("/api/crocsians/icon") ? "/api/crocsians/icon" : null;
  const data = dataObject as Prisma.InputJsonObject;

  const save = await prisma.$transaction(async (tx) => {
    const saved = await tx.crocsiansSave.upsert({
      where: { userId: user.id },
      create: { userId: user.id, version: 1, data },
      update: { version: 1, data },
      select: { version: true, updatedAt: true },
    });
    if (iconDataUrl === null) await tx.crocsiansCharacterIcon.deleteMany({ where: { userId: user.id } });
    else if (decodedIcon) {
      await tx.crocsiansCharacterIcon.upsert({
        where: { userId: user.id },
        create: { userId: user.id, contentType: decodedIcon.contentType, data: decodedIcon.bytes },
        update: { contentType: decodedIcon.contentType, data: decodedIcon.bytes },
      });
    }
    return saved;
  });

  return Response.json({ save, characterIcon: decodedIcon ? `/api/crocsians/icon?userId=${encodeURIComponent(user.id)}&v=${Date.now()}` : undefined, merchantStock: dataObject.merchantStock, merchantStockRestockKey: dataObject.merchantStockRestockKey });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || (body as Record<string, unknown>).confirmationText !== DELETE_CONFIRMATION_PHRASE) {
    return Response.json({ error: "指定された確認テキストを入力してください。" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.crocsiansCharacterIcon.deleteMany({ where: { userId: user.id } }),
    prisma.crocsiansSave.deleteMany({ where: { userId: user.id } }),
  ]);
  return Response.json({ deleted: true });
}
