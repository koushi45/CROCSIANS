"use client";
/* eslint-disable @next/next/no-img-element */

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import NextImage from "next/image";
import styles from "./crocsians.module.css";
import materialCatalog from "./materials.json";
import weaponCatalog from "./weapons.json";
import armorCatalog from "./armors.json";
import buildingUpgradeCatalog from "./building-upgrades.json";
import { getPlayerProgress, PLAYER_PROGRESSION_VERSION } from "./progression";

type View = "base" | "town" | "explore";
type TextSize = "small" | "medium" | "large";
type DesktopPanelSide = "left" | "right";
type InventoryTab = "materials" | "favorites" | "weapons" | "armors" | "supplies";
type ItemSort = "number" | "owned" | "rarity";
type ItemRarity = "N" | "R" | "SR" | "SSR";
type TempleTab = "exploration" | "dungeon" | "party";
type BasePanelTab = "building" | "tile";
type TileKind = "stone" | "water" | "grassland" | "stoneTile" | "carpet" | "soil" | "mosaic";
type StartScreenMode = "menu" | "create" | "delete";
type JobName = "戦士" | "商人" | "職人" | "盗賊" | "僧侶";
type BuildingKind = "farm" | "mine" | "forestry" | "weapon" | "armor" | "apothecary" | "inn" | "furnace";
type MaterialProductionKind = "farm" | "mine" | "forestry";
type SmeltingJob = { oreName: string; ingotName: string; quantity: number; startedAt: number; completedAt: number };
type Building = { id: number; kind: BuildingKind; level: number; stockCount: number; lastProductionAt: number; ready: boolean; investedMaterials: MaterialCost[]; smeltingJob?: SmeltingJob | null };
type SavedBuilding = Partial<Building> & Pick<Building, "id" | "kind" | "level"> & { progress?: number; stockHours?: number };
type Resources = { gold: number };
type LegacyResources = Resources & Partial<Record<"wood" | "stone" | "herb", number>>;
type CraftedItems = { potion: number; indulgence: number };
type MapDefinition = { name: string; code: string; level: number; enemyFrom: number; enemyTo: number; dungeon?: { color: PortalColor; storageLevel: PortalLevel } };
type PortalColor = "blue" | "red" | "yellow" | "green" | "purple";
type PortalLevel = 20 | 40 | 60 | 80 | 100;
type DungeonLevel = 30 | 60 | 90 | 120 | 150;
type PortalRates = Record<string, number>;
type PortalKeyInventory = Partial<Record<PortalColor, Partial<Record<PortalLevel, number>>>>;
type CardinalId = "bread" | "batrump" | "interstellar" | "elizabeth" | "mushroom";
type CardinalLevels = Partial<Record<CardinalId, number>>;
type ConnectedPlayer = { id: string; name: string; job: string; level: number; hp: number; maxHp?: number; statusEffect?: string | null; icon: string | null; atk?: number; def?: number; luck?: number; skillLevels?: Record<string, number>; cardinalLevels?: CardinalLevels; equippedCardinal?: CardinalId | null; equippedWeapon?: string | null; equippedArmor?: string | null; equippedWeaponHighQuality?: boolean; equippedArmorHighQuality?: boolean; treasureHunt?: number; autoHealLevel?: number; autoHealRecovery?: number; autoResurrectLevel?: number; autoResurrectUses?: number; divineDevotionLevel?: number; divineDevotionAtkBonus?: number; strongDutyLevel?: number; strongDutyThreatMultiplier?: number; strongDutyDamageReduction?: number; counterAttackRate?: number; evasionRate?: number; safeFleeLevel?: number; falsePraiseLevel?: number; falsePraiseUses?: number; rareDropBonus?: number; joinedAt?: number; waiting?: boolean };
type ChatMessage = { id: string; name: string; job: string; text: string; imageUrl: string | null; imageExpired: boolean; createdAt: string; icon: string | null };
type EnemySkill = { name: string; rarity: "N" | "R"; maxUses: number; effect: string };
type EnemyDefinition = { id: number; name: string; hp: number; atk: number; def: number; exp: number; drop: string; rareDrop: string; gold: number; skills?: EnemySkill[] };
type EnemyInstance = EnemyDefinition & { currentHp: number; skillUses?: number[] };
type MaterialDefinition = { id: number; name: string; category: string; rarity: ItemRarity; sellPrice: number; uses: string; description: string };
type MaterialInventory = Record<string, number>;
type LootEntry = { name: string; quantity: number; rare: boolean };
type WeaponSe = "blow" | "slash" | "slash2" | "strike" | "magic" | "dark-magic" | "dark-magic2";
type WeaponDefinition = { id: number; name: string; rarity: ItemRarity; atk: number; se: WeaponSe; sellPrice: number; requiredLevel: number; materials: { name: string; quantity: number }[] };
type WeaponInventory = Record<string, number>;
type ArmorDefinition = { id: number; name: string; rarity: ItemRarity; def: number; sellPrice: number; requiredLevel: number; materials: MaterialCost[] };
type ArmorInventory = Record<string, number>;
type MaterialCost = { name: string; quantity: number };
type SkillId = "powerStrike" | "sweepingBlow" | "defensiveStance" | "strongDuty" | "counterAttack" | "rageStrike" | "flurry" | "bargain" | "negotiation" | "regularCustomer" | "marketResearch" | "extortion" | "moneyStrike" | "brightenUp" | "weaponCraft" | "armorCraft" | "alchemy" | "highQuality" | "dismantler" | "weaponMaster" | "dualWield" | "treasureHunt" | "lockpicking" | "trapDisarm" | "dangerSense" | "falsePraise" | "evasion" | "safeFlee" | "heal" | "groupHeal" | "cure" | "blessing" | "autoHeal" | "divineDevotion" | "autoResurrect" | "bloodWine" | "holyBread" | "starCrown" | "eternalMercy" | "borrowPower";
type SkillLevels = Partial<Record<SkillId, number>>;
type SkillDefinition = { id: SkillId; job: JobName; name: string; description: string; maxLevel: number; spCost?: number; active?: boolean; advanced?: boolean; automatic?: boolean };
type JobProgress = Record<JobName, { experience: number; skillPoints: number }>;
type MerchantTab = "materials" | "weapons" | "armor" | "supplies";
type ItemTextureKind = "materials" | "weapons" | "armors";
type MarketItemType = "MATERIAL" | "WEAPON" | "ARMOR" | "SUPPLY";
type MarketTab = "browse" | "mine" | "logs";
type DesktopChatTab = "chat" | "logs";
type MarketListing = { id: string; sellerId: string; sellerName: string; itemType: MarketItemType; itemId: number; itemName: string; quantity: number; price: number; npcPrice: number; status: "ACTIVE" | "SOLD" | "WITHDRAWN"; buyerId?: string | null; buyerName?: string | null; buyerPaid?: number | null; taxRate?: number | null; sellerClaimed: boolean; createdAt: string; soldAt?: string | null };
type MarketTradeLog = { id: string; sellerId: string; sellerName: string; buyerId: string; buyerName: string; itemName: string; quantity: number; price: number; buyerPaid: number; taxAmount: number; createdAt: string };
type MarketSnapshot = { level: number; taxRate: number; listings: MarketListing[]; ownListings: MarketListing[]; logs: MarketTradeLog[]; pendingGold: number };
type ExplorationLogEntry = { id: string; message: string; createdAt: number };
type MarketInventoryOption = { key: string; type: MarketItemType; id: number; name: string; owned: number; npcPrice: number };
type SupplyCatalogItem = { id: number; name: string; owned: number; price: number; rarity: ItemRarity; description: string; action: "" | "open" | "locked" | "sell" | "sellIndulgence"; kindLabel?: string };
type ExplorationEventId = "herbGrove" | "abandonedCamp" | "ancientShrine" | "sealedChest" | "caveIn" | `map:${string}`;
type ExplorationEventDefinition = { id: ExplorationEventId; icon: string; title: string; description: string; action: string };
type SharedExplorationResult = { id: string; createdAt: number; message: string; recipientIds: string[]; gold?: number; goldByRecipient?: Record<string, number>; exp?: number; materials?: MaterialCost[]; materialsByRecipient?: Record<string, MaterialCost[]>; potion?: number; clearStatus?: boolean; setStatus?: string };
type SharedCombatAction = { id: number; createdAt: number; attackerId: string; targetEnemyIds: number[]; targetPlayerIds?: string[]; participantIds: string[]; weaponSe: WeaponSe | "enemy" };
type SharedExplorationSnapshot = {
  sessionId: string;
  countdown: number;
  eventCount: number;
  battleActive: boolean;
  enemies: EnemyInstance[];
  event: ExplorationEventDefinition | null;
  log: string;
  players: ConnectedPlayer[];
  result: SharedExplorationResult | null;
  combatActions: SharedCombatAction[];
  forcedReturnPlayerIds?: string[];
  skillUses?: Partial<Record<SkillId, number>>;
  skillUsesResetAt?: number | null;
  serverTime?: number;
  skillActionApplied?: boolean;
  skillActionError?: string;
  portalRates?: PortalRates;
  portalKeyInventory?: PortalKeyInventory;
  dungeon?: { color: PortalColor; level: DungeonLevel; hostClientId: string; started: boolean; bossActive: boolean; returnRemaining: number | null } | null;
};
type DungeonPartyListing = { map: string; color: PortalColor; level: DungeonLevel; hostName: string; memberCount: number; maxMembers: number };
type BuildingUpgradeCatalog = Partial<Record<BuildingKind, Record<string, MaterialCost[]>>>;
type BuildingDefinition = { name: string; icon: string; cost: { gold: number; materials: MaterialCost[] }; product: string; color: string };
type TileDefinition = { name: string; image: string; materials: MaterialCost[] };
type CrocsiansSaveData = {
  playerProgressionVersion?: number;
  merchantSkillResetVersion?: number;
  resources?: LegacyResources;
  buildings?: Record<number, SavedBuilding>;
  mapLayoutVersion?: number;
  craftedItems?: CraftedItems;
  job?: JobName;
  materialInventory?: MaterialInventory;
  materialFavorites?: string[];
  weaponInventory?: WeaponInventory;
  armorInventory?: ArmorInventory;
  highQualityWeaponInventory?: WeaponInventory;
  highQualityArmorInventory?: ArmorInventory;
  merchantStock?: Record<string, number>;
  merchantStockVersion?: number;
  merchantStockRestockKey?: string;
  characterName?: string;
  characterIcon?: string | null;
  skillPoints?: number;
  skillLevels?: SkillLevels;
  cardinalLevels?: CardinalLevels;
  equippedCardinal?: CardinalId | null;
  equippedWeapon?: string | null;
  equippedOffhandWeapon?: string | null;
  equippedArmor?: string | null;
  equippedWeaponHighQuality?: boolean;
  equippedOffhandWeaponHighQuality?: boolean;
  equippedArmorHighQuality?: boolean;
  experience?: number;
  jobProgress?: JobProgress;
  bgmVolume?: number;
  seVolume?: number;
  textSize?: TextSize;
  expeditionPanelSide?: DesktopPanelSide;
  chatPanelSide?: DesktopPanelSide;
  baseTiles?: TileKind[];
  portalRates?: PortalRates;
  portalKeyInventory?: PortalKeyInventory;
};

const BUILDINGS: Record<BuildingKind, BuildingDefinition> = {
  farm: { name: "畑", icon: "♨", cost: { gold: 80, materials: [{ name: "木材", quantity: 40 }] }, product: "薬草", color: "green" },
  mine: { name: "鉱山", icon: "◆", cost: { gold: 120, materials: [{ name: "木材", quantity: 25 }] }, product: "鉄鉱石", color: "stone" },
  forestry: { name: "植林所", icon: "♣", cost: { gold: 100, materials: [{ name: "石材", quantity: 20 }] }, product: "木材", color: "forest" },
  weapon: { name: "武器工房", icon: "⚒", cost: { gold: 180, materials: [{ name: "木材", quantity: 55 }, { name: "石材", quantity: 35 }] }, product: "武器クロックス", color: "rust" },
  armor: { name: "防具工房", icon: "⬟", cost: { gold: 180, materials: [{ name: "木材", quantity: 45 }, { name: "石材", quantity: 45 }] }, product: "防具クロックス", color: "blue" },
  apothecary: { name: "調合所", icon: "✚", cost: { gold: 140, materials: [{ name: "木材", quantity: 60 }, { name: "薬草", quantity: 15 }] }, product: "回復薬", color: "violet" },
  inn: { name: "宿屋", icon: "⌂", cost: { gold: 220, materials: [{ name: "木材", quantity: 80 }, { name: "石材", quantity: 20 }] }, product: "旅人の訪問", color: "gold" },
  furnace: { name: "溶鉱炉", icon: "♨", cost: { gold: 0, materials: [{ name: "石材", quantity: 200 }] }, product: "インゴット", color: "rust" },
};

const TILES: Record<TileKind, TileDefinition> = {
  stone: { name: "石", image: "stone.png", materials: [{ name: "石材", quantity: 1 }] },
  water: { name: "水", image: "water.png", materials: [] },
  grassland: { name: "草原", image: "glass.png", materials: [] },
  stoneTile: { name: "岩タイル", image: "stone-tile.png", materials: [{ name: "石材", quantity: 2 }] },
  carpet: { name: "絨毯", image: "carpet.png", materials: [{ name: "糸", quantity: 1 }, { name: "布", quantity: 2 }] },
  soil: { name: "土", image: "soil.png", materials: [] },
  mosaic: { name: "モザイクタイル", image: "mosic-tile.png", materials: [{ name: "石材", quantity: 2 }, { name: "レンガ", quantity: 2 }] },
};

const TILE_KINDS = Object.keys(TILES) as TileKind[];

function createInitialTiles(): TileKind[] {
  return Array.from({ length: MAP_CELL_COUNT }, () => "soil" as const);
}

function tileRectangleCells(start: number, end: number) {
  const startColumn = start % MAP_SIZE;
  const endColumn = end % MAP_SIZE;
  const startRow = Math.floor(start / MAP_SIZE);
  const endRow = Math.floor(end / MAP_SIZE);
  const left = Math.min(startColumn, endColumn);
  const right = Math.max(startColumn, endColumn);
  const top = Math.min(startRow, endRow);
  const bottom = Math.max(startRow, endRow);
  const cells: number[] = [];
  for (let row = top; row <= bottom; row += 1) {
    for (let column = left; column <= right; column += 1) cells.push(row * MAP_SIZE + column);
  }
  return { cells, width: right - left + 1, height: bottom - top + 1 };
}

function buildingImagePath(kind: BuildingKind, level: number) {
  const safeLevel = Math.max(1, Math.min(MAX_BUILDING_LEVEL, Math.floor(level)));
  if (kind === "furnace") return "/crocsians/base/building/furnace.png";
  if (kind === "mine") return `/crocsians/base/building/mine/${safeLevel}_256px-Photoroom.png`;
  if (kind === "forestry") return `/crocsians/base/building/plantation/${safeLevel}-Photoroom.png`;
  const directory: Record<Exclude<BuildingKind, "mine" | "forestry" | "furnace">, string> = { farm: "farm", weapon: "weapon-forge", armor: "armor-forge", apothecary: "lab", inn: "inn" };
  return `/crocsians/base/building/${directory[kind]}/${safeLevel}.png`;
}

const TOWN_BUILDINGS = [
  { name: "交易所", icon: "♜", sub: "プレイヤー市場", tone: "market" },
  { name: "教会", icon: "✙", sub: "ジョブ変更", tone: "guild" },
  { name: "商人街", icon: "◇", sub: "NPC取引", tone: "shops" },
  { name: "訓練所", icon: "⚔", sub: "EXP購入", tone: "training" },
  { name: "教皇庁", icon: "✙", sub: "枢機卿の獲得・育成", tone: "holySee" },
];

const CARDINALS: Record<CardinalId, { id: CardinalId; name: string; badge: string; color: PortalColor; image: string; skillId: SkillId; skillName: string; description: string; hp: number; atk: number; def: number; luck: number; statusResist: number; accuracy: number }> = {
  bread: { id: "bread", name: "食パン枢機卿", badge: "青のバッジ", color: "blue", image: "/crocsians/cardinal/blue.png", skillId: "holyBread", skillName: "パンを神の子の肉に", description: "探索者全員に1度のみ有効なバリアを貼る", hp: 0.05, atk: 0.05, def: 0.1, luck: 0, statusResist: 0, accuracy: 0 },
  batrump: { id: "batrump", name: "バトランプ枢機卿", badge: "黄のバッジ", color: "yellow", image: "/crocsians/cardinal/yellow.png", skillId: "bloodWine", skillName: "返り血をワインに", description: "ATK倍率攻撃を行い、与えたダメージの3割を回復", hp: 0.1, atk: 0.05, def: 0.05, luck: 0, statusResist: 0, accuracy: 0.05 },
  interstellar: { id: "interstellar", name: "インターステラー枢機卿", badge: "赤のバッジ", color: "red", image: "/crocsians/cardinal/red.png", skillId: "starCrown", skillName: "宇宙からの宝冠", description: "戦闘中の味方スキル使用回数で威力が上がる攻撃", hp: 0.05, atk: 0.1, def: 0.05, luck: 0, statusResist: 0, accuracy: 0 },
  elizabeth: { id: "elizabeth", name: "エリザベス枢機卿", badge: "緑のバッジ", color: "green", image: "/crocsians/cardinal/green.png", skillId: "eternalMercy", skillName: "慈悲よ永久に", description: "戦闘後、自分の他スキル使用回数を1回復", hp: 0.05, atk: 0, def: 0.05, luck: 0, statusResist: 0.1, accuracy: 0 },
  mushroom: { id: "mushroom", name: "マッシュルーム枢機卿", badge: "紫のバッジ", color: "purple", image: "/crocsians/cardinal/purple.png", skillId: "borrowPower", skillName: "少し力を貸せ", description: "戦闘中、自分以外の味方探索者のステータスになる", hp: 0.05, atk: 0, def: 0.05, luck: 0.05, statusResist: 0, accuracy: 0 },
};
const CARDINAL_IDS = Object.keys(CARDINALS) as CardinalId[];
const CARDINAL_ACQUIRE_COST = 500;
const CARDINAL_MAX_LEVEL = 5;

const MAP_SIZE = 30;
const MAP_CELL_SIZE = 46;
const MAP_BORDER_SIZE = 8;
const MAP_PIXEL_SIZE = MAP_SIZE * MAP_CELL_SIZE + MAP_BORDER_SIZE * 2;
const MAP_CELL_COUNT = MAP_SIZE * MAP_SIZE;
const MIN_MAP_ZOOM = 0.3;
const MAX_MAP_ZOOM = 2.5;
const FACILITY_SIZE = 2;
const MAP_LAYOUT_VERSION = 3;
const MERCHANT_SKILL_RESET_VERSION = 1;
const POTION_HEAL_AMOUNT = 28;
const PRIEST_HEAL_INITIAL_RECOVERY = 24;
const PRIEST_GROUP_HEAL_INITIAL_RECOVERY = 14;
const PRIEST_AUTO_HEAL_RECOVERY_MULTIPLIER = 0.1;
const WARRIOR_STRONG_DUTY_THREAT_MULTIPLIER = 2;
const WARRIOR_STRONG_DUTY_DAMAGE_REDUCTION = 0.1;
const WARRIOR_COUNTER_RATE_PER_LEVEL = 0.12;
const THIEF_EVASION_RATE_PER_LEVEL = 0.04;
const CRAFTING_KINDS = new Set<BuildingKind>(["weapon", "armor", "apothecary", "furnace"]);
const PRODUCTION_INTERVAL_MS = 30 * 60 * 1000;
const SMELTING_INTERVAL_MS = 5 * 60 * 1000;
const ORE_PER_INGOT = 4;
const MAX_STOCK_COUNT = 24;
const MAX_MATERIAL_PRODUCTION_QUANTITY = 8;
const BUILDING_MATERIAL_COST_MULTIPLIER = 0.25;
const BUILDING_UPGRADE_COST_MULTIPLIER = 2;
const DELETE_CONFIRMATION_PHRASE = "らすたーしょくぱんまん";
const TRAINING_GOLD_OPTIONS = [1919, 143000, 364364] as const;
const JOBS: JobName[] = ["戦士", "商人", "職人", "盗賊", "僧侶"];
const JOB_MODIFIERS: Record<JobName, { hp: number; atk: number; def: number; luck: number }> = {
  戦士: { hp: 1.2, atk: 1.4, def: 1.2, luck: 0.6 },
  商人: { hp: 0.8, atk: 0.7, def: 0.8, luck: 1.3 },
  職人: { hp: 1, atk: 0.9, def: 1, luck: 0.8 },
  盗賊: { hp: 0.9, atk: 1.1, def: 0.9, luck: 1.6 },
  僧侶: { hp: 1, atk: 1, def: 1.1, luck: 1 },
};
const BUILDING_LIMITS: Record<BuildingKind, number> = { farm: 3, mine: 3, forestry: 3, weapon: 1, armor: 1, apothecary: 1, inn: 1, furnace: 3 };
const MATERIAL_PRODUCTION: Record<MaterialProductionKind, { base: MaterialCost; unlocks: { level: number; material: MaterialCost }[] }> = {
  farm: {
    base: { name: "薬草", quantity: 6 },
    unlocks: [
      { level: 2, material: { name: "上薬草", quantity: 2 } },
      { level: 3, material: { name: "癒し草", quantity: 1 } },
      { level: 4, material: { name: "生命草", quantity: 1 } },
      { level: 5, material: { name: "霊薬の花", quantity: 1 } },
    ],
  },
  mine: {
    base: { name: "鉄鉱石", quantity: 8 },
    unlocks: [
      { level: 2, material: { name: "銀鉱石", quantity: 2 } },
      { level: 3, material: { name: "金鉱石", quantity: 1 } },
      { level: 4, material: { name: "ミスリル鉱石", quantity: 1 } },
      { level: 5, material: { name: "星鋼石", quantity: 1 } },
    ],
  },
  forestry: {
    base: { name: "木材", quantity: 8 },
    unlocks: [
      { level: 2, material: { name: "丈夫な木材", quantity: 2 } },
      { level: 3, material: { name: "硬木", quantity: 1 } },
      { level: 4, material: { name: "古木材", quantity: 1 } },
      { level: 5, material: { name: "世界樹材", quantity: 1 } },
    ],
  },
};

function isMaterialProductionKind(kind: BuildingKind): kind is MaterialProductionKind {
  return kind === "farm" || kind === "mine" || kind === "forestry";
}

function getProductionMaterials(building: Building): MaterialCost[] {
  if (!isMaterialProductionKind(building.kind)) return [];
  const production = MATERIAL_PRODUCTION[building.kind];
  const baseQuantity = production.base.quantity * building.level;
  return [
    { ...production.base, quantity: baseQuantity },
    ...(building.kind === "mine" ? [{ name: "石材", quantity: baseQuantity }] : []),
    ...production.unlocks
      .filter((unlock) => unlock.level <= building.level)
      .map((unlock) => ({ ...unlock.material, quantity: unlock.material.quantity * (building.level - unlock.level + 1) })),
  ].map((material) => ({ ...material, quantity: Math.min(MAX_MATERIAL_PRODUCTION_QUANTITY, material.quantity) }));
}

function normalizeSmeltingJob(value: unknown, serverTime: number): SmeltingJob | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const job = value as Record<string, unknown>;
  if (typeof job.oreName !== "string" || typeof job.ingotName !== "string") return null;
  const quantity = Math.max(1, Math.floor(typeof job.quantity === "number" ? job.quantity : 1));
  const startedAt = typeof job.startedAt === "number" ? job.startedAt : serverTime;
  const completedAt = typeof job.completedAt === "number" ? job.completedAt : startedAt + quantity * SMELTING_INTERVAL_MS;
  return { oreName: job.oreName, ingotName: job.ingotName, quantity, startedAt, completedAt };
}

function normalizeBuilding(building: SavedBuilding, serverTime = Date.now()): Building {
  const migratedStock = building.stockHours !== undefined
    ? building.stockHours * 2 + ((building.progress ?? 0) >= 50 ? 1 : 0)
    : building.ready ? MAX_STOCK_COUNT : 0;
  const stockCount = Math.min(MAX_STOCK_COUNT, Math.max(0, Math.floor(building.stockCount ?? migratedStock)));
  const smeltingJob = normalizeSmeltingJob(building.smeltingJob, serverTime);
  return { id: building.id, kind: building.kind, level: building.level, stockCount, lastProductionAt: building.lastProductionAt ?? serverTime, ready: building.kind === "furnace" ? Boolean(smeltingJob && smeltingJob.completedAt <= serverTime) : stockCount === MAX_STOCK_COUNT, investedMaterials: building.investedMaterials ?? getBuildingMaterialInvestment(building.kind, building.level), smeltingJob };
}

function stockProgress(building: Building) {
  return Math.min(100, building.stockCount / MAX_STOCK_COUNT * 100);
}

function buildingCost(kind: BuildingKind) {
  const cost = BUILDINGS[kind].cost;
  return { ...cost, materials: cost.materials.map((material) => ({ ...material, quantity: Math.max(1, Math.ceil(material.quantity * BUILDING_MATERIAL_COST_MULTIPLIER)) })) };
}

function buildingUpgradeCost(kind: BuildingKind, targetLevel: number) {
  const recipe = BUILDING_UPGRADES[kind]?.[String(targetLevel)] ?? [];
  return recipe.map((material) => ({ ...material, quantity: Math.max(1, Math.ceil(material.quantity * BUILDING_UPGRADE_COST_MULTIPLIER)) }));
}

function mergeMaterialCosts(...groups: MaterialCost[][]) {
  const totals = new Map<string, number>();
  groups.flat().forEach((material) => totals.set(material.name, (totals.get(material.name) ?? 0) + material.quantity));
  return [...totals].map(([name, quantity]) => ({ name, quantity }));
}

function getBuildingMaterialInvestment(kind: BuildingKind, level: number) {
  const costs = [buildingCost(kind).materials];
  for (let targetLevel = 2; targetLevel <= level; targetLevel += 1) {
    const recipe = buildingUpgradeCost(kind, targetLevel);
    if (recipe) costs.push(recipe);
  }
  return mergeMaterialCosts(...costs);
}

function createInitialBuildings(serverTime = Date.now()): Record<number, Building> {
  return Object.fromEntries(([[64, "farm"], [72, "forestry"], [80, "mine"]] as const).map(([id, kind]) => [id, { id, kind, level: 1, stockCount: 0, lastProductionAt: serverTime, ready: false, investedMaterials: [] }]));
}

function facilityFootprint(anchor: number) {
  const row = Math.floor(anchor / MAP_SIZE);
  const column = anchor % MAP_SIZE;
  if (row + FACILITY_SIZE > MAP_SIZE || column + FACILITY_SIZE > MAP_SIZE) return [];
  return [anchor, anchor + 1, anchor + MAP_SIZE, anchor + MAP_SIZE + 1];
}

function buildingAnchorAtCell(buildings: Record<number, Building>, cell: number) {
  return Object.keys(buildings).map(Number).find((anchor) => facilityFootprint(anchor).includes(cell));
}

function canPlaceFacility(buildings: Record<number, Building>, anchor: number) {
  const footprint = facilityFootprint(anchor);
  if (footprint.length !== FACILITY_SIZE * FACILITY_SIZE) return false;
  return footprint.every((cell) => buildingAnchorAtCell(buildings, cell) === undefined);
}
const EXPLORATION_MAPS: MapDefinition[] = [
  { name: "風鳴りの森", code: "GALE WOOD · A1", level: 1, enemyFrom: 1, enemyTo: 20 },
  { name: "赤砂の荒野", code: "RED WASTE · B1", level: 10, enemyFrom: 21, enemyTo: 40 },
  { name: "白霜雪原", code: "FROST FIELD · C1", level: 20, enemyFrom: 41, enemyTo: 60 },
  { name: "灰火山", code: "ASH VOLCANO · D1", level: 30, enemyFrom: 61, enemyTo: 80 },
  { name: "月影古城", code: "MOON CASTLE · E1", level: 40, enemyFrom: 81, enemyTo: 100 },
  { name: "海底の聖堂", code: "SUNKEN NAVE · F1", level: 50, enemyFrom: 101, enemyTo: 120 },
  { name: "天空要塞", code: "SKY CITADEL · G1", level: 60, enemyFrom: 121, enemyTo: 140 },
  { name: "魔界境界", code: "DEMON FRONT · H1", level: 70, enemyFrom: 141, enemyTo: 160 },
  { name: "終末回廊", code: "END CORRIDOR · I1", level: 80, enemyFrom: 161, enemyTo: 180 },
  { name: "魔王城", code: "DEMON CASTLE · J1", level: 90, enemyFrom: 181, enemyTo: 200 },
];
const PORTAL_BASE_RATE = 0.1;
const PORTAL_LEVELS: PortalLevel[] = [20, 40, 60, 80, 100];
const DUNGEON_LEVELS: DungeonLevel[] = [30, 60, 90, 120, 150];
const DUNGEON_STORAGE_LEVELS: PortalLevel[] = [20, 40, 60, 80, 100];
const DISPLAY_PORTAL_LEVELS: Record<PortalLevel, DungeonLevel> = { 20: 30, 40: 60, 60: 90, 80: 120, 100: 150 };
const PORTAL_COLORS: { id: PortalColor; name: string; tone: string }[] = [
  { id: "blue", name: "青の転移キー", tone: "blue" },
  { id: "red", name: "赤の転移キー", tone: "red" },
  { id: "yellow", name: "黄の転移キー", tone: "yellow" },
  { id: "green", name: "緑の転移キー", tone: "green" },
  { id: "purple", name: "紫の転移キー", tone: "purple" },
];
const DUNGEON_BADGES: Record<PortalColor, string> = { blue: "青のバッジ", red: "赤のバッジ", yellow: "黄のバッジ", green: "緑のバッジ", purple: "紫のバッジ" };
const MAP_PORTAL_LEVELS: Record<string, PortalLevel> = Object.fromEntries(EXPLORATION_MAPS.map((map, index) => [map.code, (index < 2 ? 20 : index < 4 ? 40 : index < 6 ? 60 : index < 8 ? 80 : 100) as PortalLevel]));
const DUNGEON_ENVIRONMENTS: Record<PortalColor, { name: string; code: string; bgm: string }> = {
  blue: { name: "白霜雪原", code: "FROST FIELD · C1", bgm: "/crocsians/bgm/3.mp3" },
  red: { name: "灰火山", code: "ASH VOLCANO · D1", bgm: "/crocsians/bgm/4.mp3" },
  yellow: { name: "天空要塞", code: "SKY CITADEL · G1", bgm: "/crocsians/bgm/7.mp3" },
  purple: { name: "月影古城", code: "MOON CASTLE · E1", bgm: "/crocsians/bgm/5.mp3" },
  green: { name: "赤砂の荒野", code: "RED WASTE · B1", bgm: "/crocsians/bgm/2.mp3" },
};
const INITIAL_PORTAL_RATES: PortalRates = Object.fromEntries(EXPLORATION_MAPS.map((map) => [map.code, PORTAL_BASE_RATE]));
const INITIAL_PORTAL_KEY_INVENTORY: PortalKeyInventory = Object.fromEntries(PORTAL_COLORS.map((color) => [color.id, Object.fromEntries(PORTAL_LEVELS.map((level) => [level, 0]))]));
const EXPLORATION_BGM: Record<string, string> = {
  [EXPLORATION_MAPS[0].code]: "/crocsians/bgm/The-Forest-of-Sighing-Winds.mp3",
  [EXPLORATION_MAPS[1].code]: "/crocsians/bgm/2.mp3",
  [EXPLORATION_MAPS[2].code]: "/crocsians/bgm/3.mp3",
  [EXPLORATION_MAPS[3].code]: "/crocsians/bgm/4.mp3",
  [EXPLORATION_MAPS[4].code]: "/crocsians/bgm/5.mp3",
  [EXPLORATION_MAPS[5].code]: "/crocsians/bgm/6.mp3",
  [EXPLORATION_MAPS[6].code]: "/crocsians/bgm/7.mp3",
  [EXPLORATION_MAPS[7].code]: "/crocsians/bgm/8.mp3",
  [EXPLORATION_MAPS[8].code]: "/crocsians/bgm/9.mp3",
  [EXPLORATION_MAPS[9].code]: "/crocsians/bgm/10.mp3",
};

const MATERIALS: MaterialDefinition[] = materialCatalog as MaterialDefinition[];
const SMELTING_RECIPES = MATERIALS
  .filter((material) => material.category === "鉱石")
  .map((ore) => {
    const ingotName = ore.name === "星鋼石" ? "星鋼インゴット" : ore.name.replace(/鉱石$/, "インゴット");
    const ingot = MATERIALS.find((material) => material.name === ingotName && material.category === "金属");
    return ingot ? { ore, ingot } : null;
  })
  .filter((recipe): recipe is { ore: MaterialDefinition; ingot: MaterialDefinition } => recipe !== null);
const MATERIAL_CATEGORIES = [...new Set(MATERIALS.map((material) => material.category))];
const WEAPONS: WeaponDefinition[] = weaponCatalog as WeaponDefinition[];
const ARMORS: ArmorDefinition[] = armorCatalog as ArmorDefinition[];
const BUILDING_UPGRADES: BuildingUpgradeCatalog = buildingUpgradeCatalog as BuildingUpgradeCatalog;
const MAX_BUILDING_LEVEL = 5;
const MERCHANT_STOCK_VERSION = 4;
const RARITY_SORT_RANK: Record<ItemRarity, number> = { N: 1, R: 2, SR: 3, SSR: 4 };

function merchantBaseStock(material: MaterialDefinition) {
  const standardStock = material.rarity === "N" ? 20 + (material.id * 17) % 41 : material.rarity === "R" ? 4 + (material.id * 7) % 12 : material.rarity === "SR" ? 2 + (material.id * 5) % 5 : 1 + (material.id * 3) % 3;
  return material.category === "魔物素材" ? Math.max(1, Math.ceil(standardStock / 3)) : standardStock;
}

function createMerchantStock(regularCustomerLevel = 0, secretTradeLevel = 0): Record<string, number> {
  const stockMultiplier = 1 + Math.max(0, regularCustomerLevel) * 0.04;
  return Object.fromEntries(MATERIALS.filter((material) => material.rarity === "N" || material.rarity === "R" || (material.rarity === "SR" && secretTradeLevel >= 1)).map((material) => {
    const stock = Math.ceil(merchantBaseStock(material) * stockMultiplier);
    return [material.name, material.rarity === "SR" ? Math.min(2, stock) : stock];
  }));
}

function skillPointCost(skill: SkillDefinition, currentLevel: number) {
  return skill.spCost ?? (currentLevel + 1) * (skill.advanced ? 3 : 1);
}

function adjustMerchantStockForSkills(currentStock: Record<string, number>, oldRegularLevel: number, oldSecretLevel: number, newRegularLevel: number, newSecretLevel: number) {
  const oldCapacity = createMerchantStock(oldRegularLevel, oldSecretLevel);
  const newCapacity = createMerchantStock(newRegularLevel, newSecretLevel);
  const materialNames = new Set([...Object.keys(currentStock), ...Object.keys(oldCapacity), ...Object.keys(newCapacity)]);
  return Object.fromEntries([...materialNames].map((name) => {
    const previousCapacity = oldCapacity[name] ?? 0;
    const capacity = newCapacity[name] ?? 0;
    const hasStockHistory = Object.hasOwn(currentStock, name);
    const current = currentStock[name] ?? 0;
    // Preserve hidden-item depletion so resetting and relearning an unlock cannot restock it.
    if (previousCapacity === 0 || capacity === 0) return [name, hasStockHistory ? current : capacity];
    // Negative stock records purchases beyond a temporarily reduced capacity.
    // It becomes available again only when capacity returns or at the daily restock.
    return [name, Math.min(capacity, current + capacity - previousCapacity)];
  }));
}

function sortItemList<T extends { id: number; rarity: ItemRarity }>(items: T[], sort: ItemSort, ownedCount: (item: T) => number) {
  return [...items].sort((a, b) => {
    if (sort === "owned") return ownedCount(b) - ownedCount(a) || a.id - b.id;
    if (sort === "rarity") return RARITY_SORT_RANK[b.rarity] - RARITY_SORT_RANK[a.rarity] || a.id - b.id;
    return a.id - b.id;
  });
}

const INITIAL_MERCHANT_STOCK = createMerchantStock();
const SKILLS: SkillDefinition[] = [
  { id: "powerStrike", job: "戦士", name: "強撃", description: "敵1体へ通常攻撃より高いダメージ", maxLevel: 5, active: true },
  { id: "sweepingBlow", job: "戦士", name: "薙ぎ払い", description: "敵全体へダメージ", maxLevel: 5, active: true },
  { id: "defensiveStance", job: "戦士", name: "防御構え", description: "DEFをレベルごとに3上昇", maxLevel: 5 },
  { id: "strongDuty", job: "戦士", name: "強者の務め", description: "発動中、全体攻撃以外の攻撃対象に選ばれやすくなり、被ダメージを10%軽減", maxLevel: 1, spCost: 10, active: true },
  { id: "counterAttack", job: "戦士", name: "反撃", description: "攻撃を受けた際、レベルごとに12%の確率で通常攻撃相当の反撃", maxLevel: 5 },
  { id: "rageStrike", job: "戦士", name: "怒りの一撃", description: "HPが低いほど威力が上がる単体攻撃", maxLevel: 5, active: true },
  { id: "flurry", job: "戦士", name: "無双乱撃", description: "ランダムな敵へ4回攻撃。レベルごとに1撃の威力が上昇", maxLevel: 5, active: true, advanced: true },
  { id: "bargain", job: "商人", name: "値切り", description: "NPC購入価格をレベルごとに3%低下", maxLevel: 5 },
  { id: "negotiation", job: "商人", name: "交渉術", description: "NPCへの売却価格をレベルごとに3%上昇", maxLevel: 5 },
  { id: "regularCustomer", job: "商人", name: "常連対応", description: "商人街の商人在庫数をレベルごとに4%増加（小数点切り上げ）", maxLevel: 5 },
  { id: "marketResearch", job: "商人", name: "秘蔵品取引", description: "SR素材を取引可能にする", maxLevel: 1, spCost: 10 },
  { id: "extortion", job: "商人", name: "まだ搾り取れる", description: "モンスター獲得Gをレベルごとに20%上昇。すべてのジョブで有効", maxLevel: 5, advanced: true },
  { id: "moneyStrike", job: "商人", name: "札束で殴る", description: "所持GOLDに応じて威力が上がる単体攻撃（GOLD消費なし）", maxLevel: 5, active: true },
  { id: "brightenUp", job: "商人", name: "どうだ明るくなったろう", description: "GOLDを消費し、味方全員を商人Lv×スキルLv×0.5回復", maxLevel: 5, active: true },
  { id: "weaponCraft", job: "職人", name: "武器加工術", description: "武器制作成功率をレベルごとに5%上昇", maxLevel: 5 },
  { id: "armorCraft", job: "職人", name: "防具加工術", description: "防具制作成功率をレベルごとに5%上昇", maxLevel: 5 },
  { id: "alchemy", job: "職人", name: "素材軽減", description: "アイテム制作時、素材消費量をレベルごとに4%軽減（小数点切り上げ）", maxLevel: 5 },
  { id: "highQuality", job: "職人", name: "高品質化", description: "武器・防具制作時、レベルごとに4%の確率で性能+25%の高品質品を制作", maxLevel: 5 },
  { id: "dismantler", job: "職人", name: "解体職人", description: "モンスターのレアドロップ率をレベルごとに2ポイント上昇。すべてのジョブで有効", maxLevel: 5, advanced: true },
  { id: "weaponMaster", job: "職人", name: "ウェポンマスター", description: "武器ATKをステータスへ加算する際、レベルごとに6%のボーナス", maxLevel: 5 },
  { id: "dualWield", job: "職人", name: "二刀流", description: "通常攻撃時、ATK50～100%の二回目の攻撃を行う", maxLevel: 5 },
  { id: "treasureHunt", job: "盗賊", name: "宝探し", description: "宝箱の出現率をレベルごとに2%上昇", maxLevel: 5 },
  { id: "lockpicking", job: "盗賊", name: "鍵開け", description: "宝箱解錠成功率をレベルごとに3%上昇", maxLevel: 5 },
  { id: "trapDisarm", job: "盗賊", name: "盗人の眼力", description: "発動中、戦闘中のメンバー全員のレアドロップ率をスキルレベル×4%上昇", maxLevel: 5, active: true },
  { id: "dangerSense", job: "盗賊", name: "クリティカルフット", description: "スキルレベル×15%の確率で、与えるダメージが3倍になる攻撃。失敗時は1ダメージ", maxLevel: 5, active: true },
  { id: "evasion", job: "盗賊", name: "逃げも隠れもする", description: "レベルごとに4%の確率で敵の攻撃を回避。全攻撃が対象", maxLevel: 5 },
  { id: "safeFlee", job: "盗賊", name: "逃げるがマシ", description: "同じ場にいる探索者全員を敵から逃走させる。ダンジョンボスには無効", maxLevel: 1, spCost: 10, active: true },
  { id: "falsePraise", job: "盗賊", name: "嘘っぱちの賛歌", description: "宝箱の素材報酬を現在地より1段階上の探索マップ相当に変更", maxLevel: 5, active: true, advanced: true },
  { id: "heal", job: "僧侶", name: "ヒール", description: "味方1人を選んでHPを回復", maxLevel: 5, active: true },
  { id: "groupHeal", job: "僧侶", name: "グループヒール", description: "同じマップにいる味方全員のHPを回復", maxLevel: 5, active: true },
  { id: "cure", job: "僧侶", name: "キュア", description: "同じ探索マップにいる味方全員の状態異常を回復", maxLevel: 5, active: true },
  { id: "blessing", job: "僧侶", name: "加護", description: "同じ探索マップにいる味方全員の被ダメージをレベルごとに4%軽減", maxLevel: 5 },
  { id: "autoHeal", job: "僧侶", name: "オートヒール", description: "戦闘後、全員を僧侶のレベル×スキルレベル×0.1回復。複数人分重複", maxLevel: 5, automatic: true },
  { id: "divineDevotion", job: "僧侶", name: "御心による献身", description: "自身のATKを1にし、自分以外で最もATKが高い探索者に自身のATKを上乗せ", maxLevel: 1, spCost: 10, active: true },
  { id: "autoResurrect", job: "僧侶", name: "オートリザレクト", description: "戦闘不能になった自身または味方をHP満タンで自動復活。レベルと同じ回数まで発動", maxLevel: 5, advanced: true, automatic: true },
];
const EXPLORATION_BACKGROUNDS: Record<string, string> = {
  [EXPLORATION_MAPS[0].code]: "/crocsians/other/1.png",
  [EXPLORATION_MAPS[1].code]: "/crocsians/other/2.png",
  [EXPLORATION_MAPS[2].code]: "/crocsians/other/3.png",
  [EXPLORATION_MAPS[3].code]: "/crocsians/other/4.png",
  [EXPLORATION_MAPS[4].code]: "/crocsians/other/5.png",
  [EXPLORATION_MAPS[5].code]: "/crocsians/other/6.png",
  [EXPLORATION_MAPS[6].code]: "/crocsians/other/7.png",
  [EXPLORATION_MAPS[7].code]: "/crocsians/other/8.png",
  [EXPLORATION_MAPS[8].code]: "/crocsians/other/9.png",
  [EXPLORATION_MAPS[9].code]: "/crocsians/other/10.png",
};
const INITIAL_SKILL_LEVELS: SkillLevels = {};
const INITIAL_JOB_PROGRESS: JobProgress = {
  戦士: { experience: 0, skillPoints: 0 }, 商人: { experience: 0, skillPoints: 0 }, 職人: { experience: 0, skillPoints: 0 }, 盗賊: { experience: 0, skillPoints: 0 }, 僧侶: { experience: 0, skillPoints: 0 },
};
const INITIAL_RESOURCES: Resources = { gold: 1919 };
const INITIAL_CRAFTED_ITEMS: CraftedItems = { potion: 0, indulgence: 0 };
const INITIAL_MATERIAL_INVENTORY: MaterialInventory = {};
const INDULGENCE_GOLD = 1_000_000;
type ReleaseNote = {
  version: string;
  items: Array<{
    title: string;
    details: string[];
  }>;
};



const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "ver 0.3.7",
    items: [
      { title: "全体チャットでGIFアニメーションに対応しました", details: ["GIFファイルと、メッセージ内に投稿されたGIF URLをチャット上で再生できるようにしました", "アップロードされたGIFはアニメーションと縦横比を維持し、最大256×256pxへ圧縮して保存します", "GIFも通常画像と同様、アップロードから72時間後にサーバーから削除されます"] },
      { title: "サイドパネルの単独表示を改善しました", details: ["全体チャットまたは探索状況を単独配置した場合、配置側の領域全体を使用するようにしました", "探索状況を単独配置した場合は、文字サイズに応じてパネル幅をコンパクトに調整します"] },
      { title: "探索状況とログ表示を整理しました", details: ["ゲームログを全体チャット側のログタブへ移動しました", "接続プレイヤー数とスキル回復時間を、現在HPなどと同じステータス一覧へ統合しました", "探索画面の帰還ボタンを「離脱」表記へ変更しました"] },
    ],
  },
  {
    version: "ver 0.3.6",
    items: [
      { title: "全体チャットの画像機能を追加しました", details: ["ファイル選択とクリップボード貼り付けから画像を送信できるようにしました", "画像は縦横比を保ったまま最大1024pxへ圧縮し、アップロードから72時間後に削除されます", "チャット内の画像をクリックすると拡大表示できます"] },
      { title: "PC版のサイドUIを調整できるようにしました", details: ["全体チャットの高さを変更し、探索状況・ログとの表示領域を調整できるようにしました", "探索・ログと全体チャットを、それぞれ画面の左側または右側へ配置できます", "配置設定はキャラクター画面のPC版 UI配置から変更できます"] },
      { title: "枢機卿の表示を改善しました", details: ["装備中の枢機卿をプレイヤーの装備品欄へ表示するようにしました", "枢機卿の装備変更は、従来どおり教皇庁でのみ行えます", "教皇庁の枢機卿カードを対応するバッジの色に合わせて調整しました"] },
    ],
  },
  {
    version: "ver 0.3.5",
    items: [
      {
        title: "商人・職人の追加スキルを実装しました",
        details: [
          "商人の発動スキル「札束で殴る」「どうだ明るくなったろう」を追加しました",
          "職人のパッシブスキル「ウェポンマスター」「二刀流」を追加しました",
          "札束で殴るは所持GOLDに応じて威力が上昇し、GOLDを消費しません",
          "どうだ明るくなったろうはGOLDを消費して味方全員を回復します",
        ],
      },
      {
        title: "探索画面とゲームヘッダーを調整しました",
        details: [
          "二刀流の順手・逆手へ別々の武器ATKとウェポンマスター補正を反映しました",
          "探索通知を戦場下部へ最大3件表示し、古い通知ほど薄く表示するようにしました",
          "探索上部バーを削除し、接続人数とスキル回復時間を探索状況へ移動しました",
          "PC版の共通ヘッダーとヘッダー内設定を整理し、設定をユーザーアイコン内へ集約しました",
        ],
      },
    ],
  },
  {
    version: "ver 0.3.4",
    items: [
      {
        title: "究極クロックスエンドの効果音を変更しました",
        details: [
          "究極クロックスエンドの攻撃SEを専用のdark-magic2に変更しました",
        ],
      },
    ],
  },
  {
    version: "ver 0.3.3",
    items: [
      {
        title: "取引画面と教会のスマホ表示を調整しました",
        details: [
          "商人街の購入・売却操作を、range UIと実行ボタンの横並びに変更しました",
          "スマホ版の教会で、ジョブ変更前にHP・ATK・DEF・LUCを横並びで確認できるようにしました",
          "交易所の出品フォームに、アイテム名検索を追加しました",
        ],
      },
    ],
  },
  {
    version: "ver 0.3.2",
    items: [
      {
        title: "商人街の売買数量指定を改善しました",
        details: [
          "商人街でアイテムを購入・売却する際、range UIで個数を選べるようにしました",
          "購入時の最大個数は商人在庫と所持金から購入できる最大数に、売却時の最大個数は実際に売却できる所持数に合わせました",
          "装備中の武器・防具は売却可能数から除外されます",
        ],
      },
    ],
  },
  {
    version: "ver 0.3.1",
    items: [
      {
        title: "街を整理し、教皇庁を追加しました",
        details: [
          "街から旅人の広場、中央公園、星渡りの神殿を削除しました",
          "探索タブから探索マップ選択機能は引き続き利用できます",
          "教皇庁で色別バッジを使い、枢機卿の獲得とレベルアップができるようになりました",
        ],
      },
      {
        title: "枢機卿システムを実装しました",
        details: [
          "青・黄・赤・緑・紫のバッジに対応する5人の枢機卿を追加しました",
          "獲得済みの枢機卿は教皇庁から装備品として装備できます",
          "枢機卿は所持品には表示されず、教皇庁で取得状況を確認できます",
          "枢機卿のステータス補正と固有スキルを戦闘へ反映しました",
        ],
      },
      {
        title: "枢機卿スキルの使用回数管理を追加しました",
        details: [
          "枢機卿スキルは職業スキルと同じく15分回復の対象になりました",
          "枢機卿の付け替えではスキル使用回数が回復しないようにしました",
          "ダンジョンアタック中の枢機卿スキル使用回数は、職業スキルと同じく通常探索とは別枠で管理されます",
        ],
      },
      {
        title: "探索マップの接続維持と表示を調整しました",
        details: [
          "通常探索で接続切れ扱いになるまでの猶予時間を15秒から30秒に延長しました",
          "敵のドロップ品表示にかかっていた白い文字影を削除しました",
        ],
      },
    ],
  },
  {
    version: "ver 0.3.0",
    items: [
      {
        title: "ダンジョンアタックを実装しました",
        details: [
          "転移キーのLvとダンジョン推奨Lvを1.5倍に変更しました",
          "同じ色・Lvの転移キーを4本持つプレイヤーが、最大4人のPT募集を作成できるようになりました",
          "ホストは任意のタイミングでダンジョンアタックを開始でき、開始時に転移キーを4本消費します",
          "ホストは開始前のみPTメンバーを除外できます",
        ],
      },
      {
        title: "パーティ参加タブを追加しました",
        details: [
          "神殿の探索メニューにパーティ参加タブを追加しました",
          "参加プレイヤーは転移キーなしで募集中のPTに参加できます",
          "ホストが開始するとPTメンバー全員が同時にダンジョンアタックへ移行します",
        ],
      },
      {
        title: "ダンジョン専用ルールを追加しました",
        details: [
          "ダンジョンアタック中は回復薬を使用できません",
          "ダンジョン中のスキル使用回数は通常探索とは別枠になり、最大使用回数が2倍になります",
          "ダンジョンアタック開始ごとにダンジョン用のスキル使用回数がリセットされます",
          "ダンジョンアタック中は途中参加と離脱ができません",
          "セッション切れ後は30秒間だけ再接続できます",
        ],
      },
      {
        title: "ダンジョン戦闘と報酬を追加しました",
        details: [
          "ダンジョンの敵をdangeon_enemies.jsonから取得するようにしました",
          "30イベント目にboss_enemies.jsonを参照した固有ボス戦が発生するようになりました",
          "ボス戦ではstart.mp3を再生し、ボスは毎回2回行動します",
          "ボス戦では盗賊スキル「逃げるがマシ」を使用できません",
          "宝箱開封成功時、ダンジョンの色に応じたバッジを推奨Lv分だけ追加報酬として獲得できます",
          "ボス撃破時、各プレイヤーが推奨Lv×5個の色別バッジを追加報酬として獲得できます",
          "ボス撃破後は10秒カウント後にPTメンバー全員が街へ帰還します",
        ],
      },
      {
        title: "ダンジョン環境と状態異常を調整しました",
        details: [
          "青・赤・黄・紫・緑のダンジョンに背景、BGM、イベント環境を紐付けました",
          "イベント発生時のダメージと回復量がダンジョンLvに応じて変動するようになりました",
          "既存イベントによる状態異常を削除し、状態異常はボス攻撃でのみ発生するようにしました",
          "凍結、火傷、魅了、麻痺の状態異常効果を追加しました",
        ],
      },
    ],
  },
  {
  version: "ver 0.2.0",
  items: [
  {
    title: "終末回廊,魔王城を実装しました。",
    details: [],
  },
    {
      "title": "戦士・盗賊・僧侶の追加スキルを実装しました",
      "details": [
        "僧侶スキル「オートヒール」を追加しました。戦闘後、全員を僧侶のレベル×スキルレベル×0.1回復します。複数の僧侶がいる場合は効果が重複します",
        "僧侶スキル「御心による献身」を追加しました。自身のATKを1にし、自分を除いてマップにいる最もATKが高いプレイヤーへ自身のATKを上乗せします",
        "戦士スキル「強者の務め」を追加しました。発動中、全体攻撃以外の攻撃を受けやすくなり、受けるダメージを10%軽減します",
        "戦士スキル「反撃」を追加しました。攻撃を受けた際、スキルレベル×12%の確率で通常攻撃と同じダメージの反撃を行います",
        "盗賊スキル「逃げも隠れもする」を追加しました。敵の攻撃をスキルレベル×4%の確率で回避します",
        "盗賊スキル「逃げるがマシ」を追加しました。その場にいる探索者全員を敵から逃走させます"
      ]
    },
    {
      title: "盗賊スキルを差し替えました",
      details: [
        "罠外しを盗人の眼力に変更しました。発動中、戦闘メンバー全員のレアドロップ率が上昇します",
        "気配察知をクリティカルフットに変更しました。成功すると3倍ダメージ、失敗すると1ダメージになります",
        "既存のスキルレベルは新スキルへ引き継がれます"
      ],
    },

    {
      "title": "商人街・所持品にソート機能を追加しました",
      "details": [
        "商人街を開いた際、商品一覧を並び替えできるようにしました",
        "所持品を開いた際、アイテム一覧を並び替えできるようにしました",
        "No順、所持数順、レアリティ順でソートできます"
      ]
    },

    {
      "title": "素材のお気に入り機能を追加しました",
      "details": [
        "所持品から素材をお気に入り登録できるようにしました",
        "所持品にお気に入りタブを追加しました",
        "お気に入り登録した素材は、お気に入りタブで確認できるようにしました"
      ]
    },

    {
      "title": "戦闘画面・探索中表示の視認性を改善しました",
      "details": [
        "敵名、ステータス、HP表示の文字色を白に変更し、黒い文字影を追加しました",
        "敵のNo、ATK、DEF、EXP表示を白文字と黒い文字影で見やすくしました",
        "ドロップアイテム表示の文字色を黄色に変更し、白い文字影を追加しました",
        "探索中に表示される直近の戦利品テキストを白文字に変更し、黒い文字影を追加しました"
      ]
    },
    {
      title: "敵スキル発動システムを実装しました",
      details: [
        "敵がenemies.jsonに設定されたスキルを戦闘中に使用するようになりました",
        "スキルを持たない敵は通常攻撃のみ、スキルを持つ敵は所持スキル数に応じた確率でスキルを発動します",
        "敵がスキルの最大使用回数を使い切った場合、そのスキル発動判定は通常攻撃として扱われます",
        "敵スキルとして、なぎ払い・強撃・怒りの一撃・グループヒールの効果を実装しました"
      ],
    },
    {
      title: "敵のスキル表示を追加しました",
      details: [
        "戦闘画面の敵HPバー下に、敵が所持しているスキルを表示するようにしました",
        "Nスキルは黒文字に白い影、Rスキルは赤文字に白い影で表示されます",
        "使用回数を使い切った敵スキルは灰色で表示されるようになりました"
      ],
    },
  ],
  },
  {
    version: "ver 0.1.1",
    items: [
      { title: "溶鉱炉を追加しました", details: ["鉱石をインゴットに変換る溶鉱炉を拠点に建設できます"] },
      { title: "天空要塞と魔界境界を実装しました", details: [] },
      { title: "探索中の他プレイヤーHP同期ずれを修正しました", details: ["パーティ帯、プレイヤー詳細、僧侶のヒール対象表示で実HPが同期されるようにしました"] },
      { title: "ダンジョンの転移ポータルを追加しました", details: ["探索イベント発生時に、各アカウント・各探索マップごとにポータル出現率が上昇するようになりました"] },
      { title: "転移キーを追加しました", details: ["青・赤・黄・緑・紫の転移キーを道具として追加しました", "転移キーは売却不可です"] },
      { title: "探索マップ選択画面を拡張しました", details: ["各探索マップに現在のポータル出現率と出現キーLvを表示しました", "神殿に探索・ダンジョンの切り替え表示を追加しました"] },
    ],
  },
  {
    version: "ver 0.1.0",
    items: [
      { title: "キャラクター誤削除防止処理を実装しました", details: ["キャラクター削除時、\"らすたーしょくぱんまん\"と入力しないと削除が実行できないようにしました"] },
      { title: "訓練所を有効化しました", details: ["goldを消費して、同じ値のexpを取得できます"] },
      { title: "補填用アイテムとして免罪符を追加しました", details: ["特に何の効力も効果もありませんが、商店街で売却することで多額の富を得ることができます"] },
      { title: "商人のスキルを一部弱体化しました", details: ["秘蔵品取引: 最大レベル5 → 1, SSRの素材は購入不可に"] },
    ],
  },
  { version: "ver 0.0.9", items: [{ title: "探索マップ月影古城・海底の聖堂実装", details: [] }, { title: "商人スキルバグ修正", details: [] }] },
  { version: "ver 0.0.8", items: [{ title: "スマホ版UI修正", details: [] }, { title: "嘘っぱちの賛歌・オートリザレクト」バグ修正", details: [] }] },
];

function createInitialJobProgress(): JobProgress {
  return Object.fromEntries(JOBS.map((job) => [job, { ...INITIAL_JOB_PROGRESS[job] }])) as JobProgress;
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function normalizeRewardMaterials(materials: MaterialCost[] | undefined) {
  return materials
    ?.map((material) => ({ name: material.name.trim(), quantity: Math.max(0, Math.floor(material.quantity)) }))
    .filter((material) => material.name && material.quantity > 0);
}

function formatRecoveryTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function nextSkillResetAt(now: number) {
  const interval = 15 * 60 * 1000;
  return Math.floor(now / interval) * interval + interval;
}

function formatMarketDate(value: string) {
  return new Date(value).toLocaleString("ja-JP");
}

function getMerchantRestockKey(serverTime: number) {
  return new Date(serverTime + 9 * 60 * 60 * 1000 - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function randomChance(percent: number) {
  return Math.random() * 100 < percent;
}

function getLevelStats(level: number) {
  const gainedLevels = Math.max(0, level - 1);
  return { hp: 45 + gainedLevels * 6, atk: 15 + gainedLevels * 2, def: 15 + gainedLevels * 2, luck: 15 + gainedLevels * 2 };
}

function getTreasureDisarmRate(luck: number, recommendedLevel: number, skillBonus = 0) {
  return Math.max(1, Math.min(99, Math.floor(70 + luck - recommendedLevel * 2 + skillBonus)));
}

function resizeCharacterIcon(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("画像を読み込めませんでした"));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("対応していない画像形式です"));
      image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 256;
        canvas.height = 256;
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("画像を処理できませんでした"));
          return;
        }
        const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
        const sourceX = (image.naturalWidth - sourceSize) / 2;
        const sourceY = (image.naturalHeight - sourceSize) / 2;
        context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, 256, 256);
        resolve(canvas.toDataURL("image/webp", 0.88));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function ItemTexture({ kind, id, name }: { kind: ItemTextureKind; id: number; name: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  return <span className={styles.itemTexture}><NextImage src={`/crocsians/items/${kind}/${id}.png`} alt={`${name}のテクスチャ`} width={128} height={128} unoptimized onError={() => setMissing(true)} /></span>;
}

export function CrocsiansGame() {
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);
  const seVolumeRef = useRef(0.5);
  const activeSeRef = useRef<Set<HTMLAudioElement>>(new Set());
  const buildingSeRef = useRef<HTMLAudioElement | null>(null);
  const saveLoadedRef = useRef(false);
  const presenceClientIdRef = useRef<string | null>(null);
  const appliedSharedResultsRef = useRef<Set<string>>(new Set());
  const appliedCombatActionsRef = useRef<Set<string>>(new Set());
  const hitFlashTimerRef = useRef<number | null>(null);
  const tileDragStartRef = useRef<number | null>(null);
  const tileDragEndRef = useRef<number | null>(null);
  const craftOutcomeTimerRef = useRef<number | null>(null);
  const serverTimeOffsetRef = useRef(0);
  const merchantStockRestockKeyRef = useRef("");
  const desktopChatMessagesRef = useRef<HTMLDivElement | null>(null);
  const mobileChatMessagesRef = useRef<HTMLDivElement | null>(null);
  const desktopLogMessagesRef = useRef<HTMLDivElement | null>(null);
  const mobileLogMessagesRef = useRef<HTMLDivElement | null>(null);
  const partyStripRef = useRef<HTMLDivElement | null>(null);
  const chatWasAtBottomRef = useRef(true);
  const chatReadInitializedRef = useRef(false);
  const lastReadChatMessageIdRef = useRef<string | null>(null);
  const mapInitialFitDoneRef = useRef(false);
  const mapPinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [startScreenMode, setStartScreenMode] = useState<StartScreenMode>("menu");
  const [saveReady, setSaveReady] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [releaseNotesOpen, setReleaseNotesOpen] = useState(false);
  const [newCharacterName, setNewCharacterName] = useState("");
  const [newCharacterJob, setNewCharacterJob] = useState<JobName>("戦士");
  const [newCharacterIcon, setNewCharacterIcon] = useState<string | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [startScreenMessage, setStartScreenMessage] = useState("セーブデータを確認しています…");
  const [bgmVolume, setBgmVolume] = useState(0.35);
  const [seVolume, setSeVolume] = useState(0.5);
  const [textSize, setTextSize] = useState<TextSize>("small");
  const [expeditionPanelSide, setExpeditionPanelSide] = useState<DesktopPanelSide>("right");
  const [chatPanelSide, setChatPanelSide] = useState<DesktopPanelSide>("right");
  const [view, setView] = useState<View>("base");
  const [resources, setResources] = useState<Resources>(INITIAL_RESOURCES);
  const [buildings, setBuildings] = useState<Record<number, Building>>(() => createInitialBuildings());
  const [baseTiles, setBaseTiles] = useState<TileKind[]>(() => createInitialTiles());
  const [basePanelTab, setBasePanelTab] = useState<BasePanelTab>("building");
  const [buildMode, setBuildMode] = useState<BuildingKind | null>(null);
  const [tileMode, setTileMode] = useState<TileKind | null>(null);
  const [tileDragSelection, setTileDragSelection] = useState<{ start: number; end: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState(0);
  const [zoom, setZoom] = useState(0.5);
  const [, setSystemMessageState] = useState("30×30の拠点に施設を建築できます");
  const [craftedItems, setCraftedItems] = useState<CraftedItems>(INITIAL_CRAFTED_ITEMS);
  const [hp, setHp] = useState(() => Math.floor(getLevelStats(1).hp * JOB_MODIFIERS["戦士"].hp));
  const hpRef = useRef(hp);
  const [jobProgress, setJobProgress] = useState<JobProgress>(() => createInitialJobProgress());
  const [missingEnemyArt, setMissingEnemyArt] = useState<Set<number>>(() => new Set());
  const [currentMap, setCurrentMap] = useState(EXPLORATION_MAPS[0]);
  const [mapPopulations, setMapPopulations] = useState<Record<string, number>>({});
  const [dungeonParties, setDungeonParties] = useState<DungeonPartyListing[]>([]);
  const [connectedPlayers, setConnectedPlayers] = useState<ConnectedPlayer[]>([]);
  const [connectedPlayersMapKey, setConnectedPlayersMapKey] = useState<string | null>(null);
  const [currentDungeon, setCurrentDungeon] = useState<SharedExplorationSnapshot["dungeon"]>(null);
  const [inspectedPlayer, setInspectedPlayer] = useState<ConnectedPlayer | null>(null);
  const [templeOpen, setTempleOpen] = useState(false);
  const [templeTab, setTempleTab] = useState<TempleTab>("exploration");
  const [churchOpen, setChurchOpen] = useState(false);
  const [holySeeOpen, setHolySeeOpen] = useState(false);
  const [portalRates, setPortalRates] = useState<PortalRates>({ ...INITIAL_PORTAL_RATES });
  const [portalKeyInventory, setPortalKeyInventory] = useState<PortalKeyInventory>({ ...INITIAL_PORTAL_KEY_INVENTORY });
  const [eventCountdown, setEventCountdown] = useState(8);
  const [battleActive, setBattleActive] = useState(false);
  const [enemies, setEnemies] = useState<EnemyInstance[]>([]);
  const [flashingEnemyIds, setFlashingEnemyIds] = useState<Set<number>>(() => new Set());
  const [flashingPlayerIds, setFlashingPlayerIds] = useState<Set<string>>(() => new Set());
  const [battleLog, setBattleLog] = useState("神殿から探索マップを選択してください");
  const [desktopChatTab, setDesktopChatTab] = useState<DesktopChatTab>("chat");
  const [explorationLogs, setExplorationLogs] = useState<ExplorationLogEntry[]>([]);
  const lastExplorationLogRef = useRef("");
  const [eventCount, setEventCount] = useState(0);
  const [explorationEvent, setExplorationEvent] = useState<ExplorationEventDefinition | null>(null);
  const [skillUses, setSkillUses] = useState<Partial<Record<SkillId, number>>>({});
  const [skillUsesResetAt, setSkillUsesResetAt] = useState<number | null>(null);
  const [skillRecoveryNow, setSkillRecoveryNow] = useState(Date.now());
  const [healTargetId, setHealTargetId] = useState("");
  const [statusEffect, setStatusEffect] = useState<string | null>(null);
  const [returnNotice, setReturnNotice] = useState<string | null>(null);
  const [partyStripScrollable, setPartyStripScrollable] = useState(false);

  function setSystemMessage(message: string) {
    setSystemMessageState(message);
  }

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesMapKey, setMessagesMapKey] = useState("");
  const [chat, setChat] = useState("");
  const [chatImage, setChatImage] = useState<File | null>(null);
  const [expandedChatImage, setExpandedChatImage] = useState<string | null>(null);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [job, setJob] = useState<JobName>("戦士");
  const [characterName, setCharacterName] = useState("アルマ");
  const [characterIcon, setCharacterIcon] = useState<string | null>(null);
  const [characterPanelOpen, setCharacterPanelOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("アルマ");
  const [skillLevels, setSkillLevels] = useState<SkillLevels>({ ...INITIAL_SKILL_LEVELS });
  const [cardinalLevels, setCardinalLevels] = useState<CardinalLevels>({});
  const [equippedCardinal, setEquippedCardinal] = useState<CardinalId | null>(null);
  const [equippedWeapon, setEquippedWeapon] = useState<string | null>(null);
  const [equippedOffhandWeapon, setEquippedOffhandWeapon] = useState<string | null>(null);
  const [equippedArmor, setEquippedArmor] = useState<string | null>(null);
  const [equippedWeaponHighQuality, setEquippedWeaponHighQuality] = useState(false);
  const [equippedOffhandWeaponHighQuality, setEquippedOffhandWeaponHighQuality] = useState(false);
  const [equippedArmorHighQuality, setEquippedArmorHighQuality] = useState(false);
  const [materialCatalogOpen, setMaterialCatalogOpen] = useState(false);
  const [inventoryTab, setInventoryTab] = useState<InventoryTab>("materials");
  const [inventorySort, setInventorySort] = useState<ItemSort>("number");
  const [materialFavorites, setMaterialFavorites] = useState<string[]>([]);
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialCategory, setMaterialCategory] = useState("すべて");
  const [materialRarity, setMaterialRarity] = useState("すべて");
  const [ownedMaterialsOnly, setOwnedMaterialsOnly] = useState(false);
  const [materialInventory, setMaterialInventory] = useState<MaterialInventory>(INITIAL_MATERIAL_INVENTORY);
  const [lastLoot, setLastLoot] = useState<LootEntry[]>([]);
  const [weaponWorkshopOpen, setWeaponWorkshopOpen] = useState(false);
  const [weaponInventory, setWeaponInventory] = useState<WeaponInventory>({});
  const [highQualityWeaponInventory, setHighQualityWeaponInventory] = useState<WeaponInventory>({});
  const [armorWorkshopOpen, setArmorWorkshopOpen] = useState(false);
  const [armorInventory, setArmorInventory] = useState<ArmorInventory>({});
  const [highQualityArmorInventory, setHighQualityArmorInventory] = useState<ArmorInventory>({});
  const [craftOutcome, setCraftOutcome] = useState<{ success: boolean; message: string } | null>(null);
  const [smeltingRecipeName, setSmeltingRecipeName] = useState(SMELTING_RECIPES[0]?.ore.name ?? "");
  const [smeltingAmount, setSmeltingAmount] = useState(1);
  const [merchantOpen, setMerchantOpen] = useState(false);
  const [merchantTab, setMerchantTab] = useState<MerchantTab>("materials");
  const [merchantSort, setMerchantSort] = useState<ItemSort>("number");
  const [merchantSearch, setMerchantSearch] = useState("");
  const [merchantOwnedOnly, setMerchantOwnedOnly] = useState(false);
  const [merchantStock, setMerchantStock] = useState<Record<string, number>>(INITIAL_MERCHANT_STOCK);
  const [merchantStockRestockKey, setMerchantStockRestockKey] = useState("");
  const [merchantTradeAmounts, setMerchantTradeAmounts] = useState<Record<string, number>>({});
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [marketTab, setMarketTab] = useState<MarketTab>("browse");
  const [marketSnapshot, setMarketSnapshot] = useState<MarketSnapshot | null>(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketItemKey, setMarketItemKey] = useState("");
  const [marketItemSearch, setMarketItemSearch] = useState("");
  const [marketQuantity, setMarketQuantity] = useState(1);
  const [marketPrice, setMarketPrice] = useState(0);
  const [marketPlayerKey, setMarketPlayerKey] = useState("");
  const activeJobProgress = jobProgress[job];
  const playerProgress = getPlayerProgress(activeJobProgress.experience);
  const skillPoints = activeJobProgress.skillPoints;
  const equippedWeaponDefinition = equippedWeapon ? WEAPONS.find((weapon) => weapon.name === equippedWeapon) : undefined;
  const offhandInventory = equippedOffhandWeaponHighQuality ? highQualityWeaponInventory : weaponInventory;
  const offhandConflictsWithMain = equippedOffhandWeapon === equippedWeapon && equippedOffhandWeaponHighQuality === equippedWeaponHighQuality;
  const hasEquippedOffhandWeapon = Boolean(equippedOffhandWeapon && (offhandInventory[equippedOffhandWeapon] ?? 0) > (offhandConflictsWithMain ? 1 : 0));
  const equippedOffhandWeaponDefinition = hasEquippedOffhandWeapon ? WEAPONS.find((weapon) => weapon.name === equippedOffhandWeapon) : undefined;
  const equippedArmorDefinition = equippedArmor ? ARMORS.find((armor) => armor.name === equippedArmor) : undefined;
  const equippedCardinalDefinition = equippedCardinal ? CARDINALS[equippedCardinal] : undefined;
  const equippedCardinalLevel = equippedCardinal ? cardinalLevels[equippedCardinal] ?? 0 : 0;
  const levelStats = getLevelStats(playerProgress.level);
  const jobModifier = JOB_MODIFIERS[job];
  const cardinalHpMultiplier = equippedCardinalDefinition && equippedCardinalLevel > 0 ? 1 + equippedCardinalDefinition.hp * equippedCardinalLevel : 1;
  const cardinalAtkMultiplier = equippedCardinalDefinition && equippedCardinalLevel > 0 ? 1 + equippedCardinalDefinition.atk * equippedCardinalLevel : 1;
  const cardinalDefMultiplier = equippedCardinalDefinition && equippedCardinalLevel > 0 ? 1 + equippedCardinalDefinition.def * equippedCardinalLevel : 1;
  const cardinalLuckMultiplier = equippedCardinalDefinition && equippedCardinalLevel > 0 ? 1 + equippedCardinalDefinition.luck * equippedCardinalLevel : 1;
  const cardinalStatusResist = equippedCardinalDefinition && equippedCardinalLevel > 0 ? equippedCardinalDefinition.statusResist * equippedCardinalLevel : 0;
  const cardinalAccuracyBonus = equippedCardinalDefinition && equippedCardinalLevel > 0 ? equippedCardinalDefinition.accuracy * equippedCardinalLevel : 0;
  const maxHp = Math.max(1, Math.floor(levelStats.hp * jobModifier.hp * cardinalHpMultiplier));
  const equippedWeaponAttack = equippedWeaponDefinition ? Math.floor(equippedWeaponDefinition.atk * (equippedWeaponHighQuality ? 1.25 : 1)) : 0;
  const equippedOffhandWeaponAttack = equippedOffhandWeaponDefinition ? Math.floor(equippedOffhandWeaponDefinition.atk * (equippedOffhandWeaponHighQuality ? 1.25 : 1)) : 0;
  const equippedArmorDefense = equippedArmorDefinition ? Math.floor(equippedArmorDefinition.def * (equippedArmorHighQuality ? 1.25 : 1)) : 0;
  const weaponMasterMultiplier = job === "職人" ? 1 + (skillLevels.weaponMaster ?? 0) * 0.06 : 1;
  const totalAttack = Math.max(1, Math.floor((levelStats.atk * jobModifier.atk + equippedWeaponAttack * weaponMasterMultiplier) * cardinalAtkMultiplier));
  const dualWieldMultiplier = 0.4 + (skillLevels.dualWield ?? 0) * 0.1;
  const offhandAttack = job === "職人" && (skillLevels.dualWield ?? 0) > 0
    ? Math.max(1, Math.floor((levelStats.atk * jobModifier.atk + equippedOffhandWeaponAttack * weaponMasterMultiplier) * cardinalAtkMultiplier * dualWieldMultiplier))
    : 0;
  const totalDefense = Math.max(0, Math.floor((levelStats.def * jobModifier.def + equippedArmorDefense + (skillLevels.defensiveStance ?? 0) * 3) * cardinalDefMultiplier));
  const totalLuck = Math.max(1, Math.floor(levelStats.luck * jobModifier.luck * cardinalLuckMultiplier));
  const equippedWeaponSe: WeaponSe = equippedWeaponDefinition?.se ?? "blow";
  const currentDungeonEnvironment = currentMap.dungeon ? DUNGEON_ENVIRONMENTS[currentMap.dungeon.color] : null;
  const currentMapKey = `explore:${currentMap.code}`;
  const activePlayerMapKey = view === "town" ? "town" : view === "explore" ? currentMapKey : null;
  const dungeonStarted = Boolean(currentDungeon?.started);
  const isDungeonHost = Boolean(currentDungeon && presenceClientIdRef.current && currentDungeon.hostClientId === presenceClientIdRef.current);
  const presenceMapKey = view === "town" ? "town" : null;
  const chatMapKey = "global";
  const visibleMessages = messagesMapKey === chatMapKey ? messages : [];
  const latestChatMessageId = visibleMessages.at(-1)?.id;
  const skillRecoveryRemaining = skillUsesResetAt === null ? 0 : Math.max(0, skillUsesResetAt - skillRecoveryNow);
  const localPlayerProfile: ConnectedPlayer = { id: "local", name: characterName, job, level: playerProgress.level, hp, maxHp, statusEffect, icon: characterIcon, atk: totalAttack, def: totalDefense, luck: totalLuck, skillLevels, cardinalLevels, equippedCardinal, equippedWeapon, equippedArmor, equippedWeaponHighQuality, equippedArmorHighQuality, autoHealLevel: job === "僧侶" ? skillLevels.autoHeal ?? 0 : 0, autoHealRecovery: job === "僧侶" ? Math.floor(playerProgress.level * (skillLevels.autoHeal ?? 0) * PRIEST_AUTO_HEAL_RECOVERY_MULTIPLIER) : 0, divineDevotionLevel: job === "僧侶" ? skillLevels.divineDevotion ?? 0 : 0, divineDevotionAtkBonus: job === "僧侶" && (skillLevels.divineDevotion ?? 0) > 0 ? Math.max(0, totalAttack - 1) : 0, strongDutyLevel: job === "戦士" ? skillLevels.strongDuty ?? 0 : 0, strongDutyThreatMultiplier: job === "戦士" && (skillLevels.strongDuty ?? 0) > 0 ? WARRIOR_STRONG_DUTY_THREAT_MULTIPLIER : 1, strongDutyDamageReduction: job === "戦士" && (skillLevels.strongDuty ?? 0) > 0 ? WARRIOR_STRONG_DUTY_DAMAGE_REDUCTION : 0, counterAttackRate: job === "戦士" ? (skillLevels.counterAttack ?? 0) * WARRIOR_COUNTER_RATE_PER_LEVEL : 0, evasionRate: job === "盗賊" ? (skillLevels.evasion ?? 0) * THIEF_EVASION_RATE_PER_LEVEL : 0, safeFleeLevel: job === "盗賊" ? skillLevels.safeFlee ?? 0 : 0, rareDropBonus: (skillLevels.dismantler ?? 0) * 0.02 };
  const mapPlayers: ConnectedPlayer[] = connectedPlayersMapKey === activePlayerMapKey && connectedPlayers.length > 0 ? connectedPlayers : activePlayerMapKey ? [localPlayerProfile] : [];
  const inspectedWeaponDefinition = inspectedPlayer?.equippedWeapon ? WEAPONS.find((weapon) => weapon.name === inspectedPlayer.equippedWeapon) : undefined;
  const inspectedArmorDefinition = inspectedPlayer?.equippedArmor ? ARMORS.find((armor) => armor.name === inspectedPlayer.equippedArmor) : undefined;
  const inspectedCardinalDefinition = inspectedPlayer?.equippedCardinal ? CARDINALS[inspectedPlayer.equippedCardinal] : undefined;
  const inspectedSkills = inspectedPlayer ? SKILLS.filter((skill) => (inspectedPlayer.skillLevels?.[skill.id] ?? 0) > 0) : [];
  const healingTargets = mapPlayers.filter((player) => !player.waiting);
  const selectedHealTarget = healingTargets.find((player) => player.id === healTargetId) ?? healingTargets.find((player) => player.hp < (player.maxHp ?? 100));
  const lowestHpHealTarget = healingTargets.reduce<ConnectedPlayer | undefined>((lowest, player) => {
    if (player.hp >= (player.maxHp ?? 100)) return lowest;
    return !lowest || player.hp < lowest.hp ? player : lowest;
  }, undefined);
  const waitingForNextEvent = view === "explore" && connectedPlayersMapKey === activePlayerMapKey && Boolean(connectedPlayers.find((player) => player.id === presenceClientIdRef.current)?.waiting);
  const statusActionBlocked = statusEffect === "凍結" || statusEffect === "麻痺" || statusEffect === "魅了";
  const bgmTrack = !gameStarted
    ? "/crocsians/bgm/start.mp3"
    : currentDungeon?.bossActive
      ? "/crocsians/bgm/start.mp3"
    : battleActive
      ? "/crocsians/bgm/battle.mp3"
      : view === "base"
        ? "/crocsians/bgm/user-base.mp3"
        : view === "town"
          ? "/crocsians/bgm/town.mp3"
          : currentDungeonEnvironment?.bgm ?? EXPLORATION_BGM[currentMap.code] ?? null;

  const rememberChatAutoScrollIntent = useCallback(() => {
    const isChatMessagesAtBottom = (element: HTMLDivElement) => element.scrollHeight - element.scrollTop - element.clientHeight <= 4;
    const visibleMessageElements = [desktopChatMessagesRef.current, mobileChatMessagesRef.current].filter((element): element is HTMLDivElement => Boolean(element && element.clientHeight > 0));
    chatWasAtBottomRef.current = visibleMessageElements.length === 0 || visibleMessageElements.some(isChatMessagesAtBottom);
  }, []);

  const updatePartyStripScrollable = useCallback(() => {
    const element = partyStripRef.current;
    if (!element) {
      setPartyStripScrollable(false);
      return;
    }
    const scrollable = element.scrollWidth > element.clientWidth + 1;
    setPartyStripScrollable((current) => current === scrollable ? current : scrollable);
  }, []);

  useEffect(() => {
    const element = partyStripRef.current;
    if (!element) {
      setPartyStripScrollable(false);
      return;
    }

    const frame = window.requestAnimationFrame(updatePartyStripScrollable);
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updatePartyStripScrollable);
    resizeObserver?.observe(element);
    window.addEventListener("resize", updatePartyStripScrollable);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePartyStripScrollable);
    };
  }, [currentMap.code, mapPlayers.length, textSize, updatePartyStripScrollable, view]);

  useEffect(() => {
    hpRef.current = hp;
  }, [hp]);

  useEffect(() => {
    const message = battleLog.trim();
    if (!message || message === lastExplorationLogRef.current) return;
    lastExplorationLogRef.current = message;
    setExplorationLogs((current) => [{ id: `${Date.now()}-${current.length}`, message, createdAt: Date.now() }, ...current].slice(0, 100));
  }, [battleLog]);

  useEffect(() => {
    let active = true;
    const applySaveData = (data: CrocsiansSaveData) => {
      if (data.resources) setResources({ gold: data.resources.gold });
      if (data.mapLayoutVersion === MAP_LAYOUT_VERSION && data.buildings) setBuildings(Object.fromEntries(Object.entries(data.buildings).filter(([key]) => Number(key) < MAP_CELL_COUNT && facilityFootprint(Number(key)).length === FACILITY_SIZE * FACILITY_SIZE).map(([key, building]) => [key, normalizeBuilding(building)])));
      if (Array.isArray(data.baseTiles) && data.baseTiles.length === MAP_CELL_COUNT) setBaseTiles(data.baseTiles.map((tile) => TILE_KINDS.includes(tile) ? tile : "soil"));
      if (data.craftedItems) setCraftedItems({ ...INITIAL_CRAFTED_ITEMS, ...data.craftedItems });
      if (data.job && JOBS.includes(data.job)) setJob(data.job);
      if (data.characterName) { setCharacterName(data.characterName); setNameDraft(data.characterName); }
      if (data.characterIcon !== undefined) setCharacterIcon(data.characterIcon);
      if (data.jobProgress) setJobProgress(data.jobProgress);
      else if (typeof data.skillPoints === "number" || typeof data.experience === "number") {
        const migratedJob = data.job && JOBS.includes(data.job) ? data.job : "戦士";
        setJobProgress((current) => ({ ...current, [migratedJob]: { experience: Math.max(0, data.experience ?? 0), skillPoints: Math.max(0, data.skillPoints ?? 0) } }));
      }
      if (data.skillLevels) setSkillLevels({ ...data.skillLevels, marketResearch: Math.min(1, data.skillLevels.marketResearch ?? 0) });
      if (data.cardinalLevels) setCardinalLevels(Object.fromEntries(CARDINAL_IDS.flatMap((id) => {
        const level = data.cardinalLevels?.[id] ?? 0;
        return level > 0 ? [[id, Math.max(1, Math.min(CARDINAL_MAX_LEVEL, Math.floor(level)))]] : [];
      })) as CardinalLevels);
      if (data.equippedCardinal !== undefined) setEquippedCardinal(data.equippedCardinal && CARDINALS[data.equippedCardinal] && (data.cardinalLevels?.[data.equippedCardinal] ?? 0) > 0 ? data.equippedCardinal : null);
      if (data.equippedWeapon !== undefined) setEquippedWeapon(data.equippedWeapon);
      if (data.equippedOffhandWeapon !== undefined) setEquippedOffhandWeapon(data.equippedOffhandWeapon);
      if (data.equippedArmor !== undefined) setEquippedArmor(data.equippedArmor);
      if (typeof data.equippedWeaponHighQuality === "boolean") setEquippedWeaponHighQuality(data.equippedWeaponHighQuality);
      if (typeof data.equippedOffhandWeaponHighQuality === "boolean") setEquippedOffhandWeaponHighQuality(data.equippedOffhandWeaponHighQuality);
      if (typeof data.equippedArmorHighQuality === "boolean") setEquippedArmorHighQuality(data.equippedArmorHighQuality);
      if (data.merchantStock) {
        const migratedStock = { ...INITIAL_MERCHANT_STOCK, ...data.merchantStock };
        const stockVersion = data.merchantStockVersion ?? 1;
        if (stockVersion < 2) {
          MATERIALS.filter((material) => material.category === "魔物素材" && (material.rarity === "N" || material.rarity === "R")).forEach((material) => {
            if (Object.hasOwn(data.merchantStock!, material.name)) migratedStock[material.name] = Math.max(0, Math.ceil(data.merchantStock![material.name] / 3));
          });
        }
        if (stockVersion < 3) {
          const regularLevel = data.skillLevels?.regularCustomer ?? 0;
          const secretLevel = data.skillLevels?.marketResearch ?? 0;
          const oldFullStock = createMerchantStock();
          const upgradedFullStock = createMerchantStock(regularLevel, secretLevel);
          Object.entries(upgradedFullStock).forEach(([name, fullStock]) => {
            const oldCapacity = oldFullStock[name] ?? 0;
            migratedStock[name] = oldCapacity > 0 ? Math.max(0, (migratedStock[name] ?? 0) + fullStock - oldCapacity) : fullStock;
          });
        }
        if (stockVersion < 4) {
          MATERIALS.filter((material) => material.rarity === "SR" || material.rarity === "SSR").forEach((material) => {
            migratedStock[material.name] = Math.min(2, Math.max(0, migratedStock[material.name] ?? 0));
          });
        }
        setMerchantStock(migratedStock);
      }
      if (data.merchantStockRestockKey) {
        merchantStockRestockKeyRef.current = data.merchantStockRestockKey;
        setMerchantStockRestockKey(data.merchantStockRestockKey);
      }
      if (data.materialInventory || data.resources?.wood || data.resources?.stone || data.resources?.herb) {
        const migratedInventory = { ...(data.materialInventory ?? {}) };
        if (data.resources?.wood) migratedInventory["木材"] = (migratedInventory["木材"] ?? 0) + data.resources.wood;
        if (data.resources?.stone) migratedInventory["石材"] = (migratedInventory["石材"] ?? 0) + data.resources.stone;
        if (data.resources?.herb) migratedInventory["薬草"] = (migratedInventory["薬草"] ?? 0) + data.resources.herb;
        setMaterialInventory(migratedInventory);
      }
      if (Array.isArray(data.materialFavorites)) {
        const validMaterialNames = new Set(MATERIALS.map((material) => material.name));
        setMaterialFavorites([...new Set(data.materialFavorites.filter((name): name is string => typeof name === "string" && validMaterialNames.has(name)))]);
      }
      if (data.weaponInventory) setWeaponInventory(data.weaponInventory);
      if (data.armorInventory) setArmorInventory(data.armorInventory);
      if (data.highQualityWeaponInventory) setHighQualityWeaponInventory(data.highQualityWeaponInventory);
      if (data.highQualityArmorInventory) setHighQualityArmorInventory(data.highQualityArmorInventory);
      if (typeof data.bgmVolume === "number" && Number.isFinite(data.bgmVolume)) setBgmVolume(Math.max(0, Math.min(1, data.bgmVolume)));
      if (typeof data.seVolume === "number" && Number.isFinite(data.seVolume)) setSeVolume(Math.max(0, Math.min(1, data.seVolume)));
      if (data.textSize === "small" || data.textSize === "medium" || data.textSize === "large") setTextSize(data.textSize);
      if (data.expeditionPanelSide === "left" || data.expeditionPanelSide === "right") setExpeditionPanelSide(data.expeditionPanelSide);
      if (data.chatPanelSide === "left" || data.chatPanelSide === "right") setChatPanelSide(data.chatPanelSide);
      if (data.portalRates) setPortalRates({ ...INITIAL_PORTAL_RATES, ...data.portalRates });
      if (data.portalKeyInventory) setPortalKeyInventory({ ...INITIAL_PORTAL_KEY_INVENTORY, ...data.portalKeyInventory });
    };
    const loadAccountSave = async () => {
      try {
        const response = await fetch("/api/crocsians/save", { cache: "no-store" });
        if (response.status === 401) {
          window.location.assign(`/login?next=${encodeURIComponent("/crocsians")}`);
          return;
        }
        if (!response.ok) throw new Error("save load failed");
        const result = await response.json() as { save?: { data?: CrocsiansSaveData } | null; characterIcon?: string | null };
        if (!active) return;
        let data = result.save?.data;
        const legacySave = window.localStorage.getItem("crocsians-demo-v2");
        if (!data && legacySave) {
          data = JSON.parse(legacySave) as CrocsiansSaveData;
        }
        let serverIcon = result.characterIcon ?? null;
        const embeddedIcon = typeof data?.characterIcon === "string" && data.characterIcon.startsWith("data:image/webp;base64,") ? data.characterIcon : null;
        if (data && (!result.save || (embeddedIcon && !serverIcon))) {
          const migrationResponse = await fetch("/api/crocsians/save", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data, iconDataUrl: embeddedIcon }) });
          if (!migrationResponse.ok) throw new Error("legacy save migration failed");
          if (embeddedIcon) serverIcon = `/api/crocsians/icon?v=${Date.now()}`;
        }
        if (!active) return;
        if (data) {
          applySaveData({ ...data, characterIcon: serverIcon });
          setHasSave(true);
          setStartScreenMessage(legacySave && !result.save ? "ローカルセーブをアカウントへ移行しました" : "アカウントのセーブデータが見つかりました");
          window.localStorage.removeItem("crocsians-demo-v2");
        } else {
          setStartScreenMessage("このアカウントにはセーブデータがありません");
        }
        saveLoadedRef.current = true;
        setSaveReady(true);
      } catch {
        if (!active) return;
        saveLoadedRef.current = false;
        setSaveReady(false);
        setStartScreenMessage("サーバーからセーブデータを読み込めませんでした");
      }
    };
    void loadAccountSave();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const audio = bgmAudioRef.current ?? new Audio();
    bgmAudioRef.current = audio;
    audio.loop = true;
    if (!bgmTrack) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      return;
    }
    const nextSource = new URL(bgmTrack, window.location.origin).href;
    if (audio.src !== nextSource) {
      audio.src = bgmTrack;
      audio.currentTime = 0;
      audio.load();
    }
    void audio.play().catch(() => { /* The first pointer or key input resumes autoplay-blocked audio. */ });
  }, [bgmTrack]);

  useEffect(() => {
    if (bgmAudioRef.current) bgmAudioRef.current.volume = bgmVolume;
  }, [bgmVolume]);

  useEffect(() => {
    seVolumeRef.current = seVolume;
  }, [seVolume]);

  useEffect(() => {
    const activeSounds = activeSeRef.current;
    const flashTimer = hitFlashTimerRef;
    const handleButtonClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest("button") : null;
      if (!(target instanceof HTMLButtonElement) || target.disabled) return;
      const sound = target.dataset.se;
      if (sound === "none") return;
      playSe(sound === "start" || sound === "building" ? sound : "click");
    };
    document.addEventListener("click", handleButtonClick, true);
    return () => {
      document.removeEventListener("click", handleButtonClick, true);
      activeSounds.forEach((audio) => audio.pause());
      activeSounds.clear();
      buildingSeRef.current = null;
      if (flashTimer.current) window.clearTimeout(flashTimer.current);
    };
  }, []);

  useEffect(() => {
    const resumeBgm = () => {
      if (bgmAudioRef.current?.src) void bgmAudioRef.current.play().catch(() => {});
    };
    window.addEventListener("pointerdown", resumeBgm, { once: true });
    window.addEventListener("keydown", resumeBgm, { once: true });
    return () => {
      window.removeEventListener("pointerdown", resumeBgm);
      window.removeEventListener("keydown", resumeBgm);
      bgmAudioRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    let active = true;
    let clientId = presenceClientIdRef.current;
    if (!clientId) {
      clientId = window.sessionStorage.getItem("crocsians-presence-id") ?? window.crypto.randomUUID();
      window.sessionStorage.setItem("crocsians-presence-id", clientId);
      presenceClientIdRef.current = clientId;
    }
    if (!presenceMapKey) {
      void fetch("/api/crocsians/presence", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ clientId }) });
      return () => { active = false; };
    }
    const syncPresence = async () => {
      try {
        const response = await fetch("/api/crocsians/presence", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ clientId, map: presenceMapKey, name: characterName, job, level: playerProgress.level, hp, maxHp, atk: totalAttack, def: totalDefense, luck: totalLuck, skillLevels, cardinalLevels, equippedCardinal, equippedWeapon, equippedArmor, equippedWeaponHighQuality, equippedArmorHighQuality }),
        });
        if (!response.ok) return;
        const data = await response.json() as { players?: ConnectedPlayer[] };
        if (active && Array.isArray(data.players)) {
          setConnectedPlayers(data.players);
          setConnectedPlayersMapKey(presenceMapKey);
        }
      } catch { /* Presence reconnects on the next heartbeat. */ }
    };
    void syncPresence();
    const timer = window.setInterval(syncPresence, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [cardinalLevels, characterIcon, characterName, equippedArmor, equippedArmorHighQuality, equippedCardinal, equippedWeapon, equippedWeaponHighQuality, hp, job, maxHp, playerProgress.level, presenceMapKey, skillLevels, totalAttack, totalDefense, totalLuck]);

  useEffect(() => {
    const leavePresence = () => {
      const clientId = presenceClientIdRef.current;
      if (clientId) navigator.sendBeacon("/api/crocsians/presence", JSON.stringify({ clientId, leave: true }));
    };
    window.addEventListener("pagehide", leavePresence);
    return () => window.removeEventListener("pagehide", leavePresence);
  }, []);

  useEffect(() => {
    if (!gameStarted) return;
    let active = true;
    const syncChat = async () => {
      try {
        const response = await fetch(`/api/crocsians/chat?map=${encodeURIComponent(chatMapKey)}`, { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { messages?: ChatMessage[] };
        if (active && Array.isArray(data.messages)) {
          const incomingMessages = data.messages;
          const incomingLatestMessageId = incomingMessages.at(-1)?.id ?? null;
          if (!chatReadInitializedRef.current) {
            chatReadInitializedRef.current = true;
            lastReadChatMessageIdRef.current = incomingLatestMessageId;
            setUnreadChatCount(0);
          } else if (mobileChatOpen) {
            lastReadChatMessageIdRef.current = incomingLatestMessageId;
            setUnreadChatCount(0);
          } else if (incomingLatestMessageId) {
            const lastReadIndex = lastReadChatMessageIdRef.current ? incomingMessages.findIndex((message) => message.id === lastReadChatMessageIdRef.current) : -1;
            setUnreadChatCount(lastReadIndex >= 0 ? incomingMessages.length - lastReadIndex - 1 : incomingMessages.length);
          }
          rememberChatAutoScrollIntent();
          setMessages(incomingMessages);
          setMessagesMapKey(chatMapKey);
        }
      } catch { /* Chat reconnects on the next poll. */ }
    };
    void syncChat();
    const timer = window.setInterval(syncChat, 2_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [chatMapKey, gameStarted, mobileChatOpen, rememberChatAutoScrollIntent]);

  useEffect(() => {
    if (!gameStarted) return;
    let active = true;
    const loadSkillUsage = async () => {
      try {
        const response = await fetch("/api/crocsians/skill-usage", { cache: "no-store" });
        if (!response.ok) return;
        const snapshot = await response.json() as SharedExplorationSnapshot;
        if (!active) return;
        if (snapshot.skillUses) setSkillUses(snapshot.skillUses);
        if (snapshot.skillUsesResetAt !== undefined) setSkillUsesResetAt(snapshot.skillUsesResetAt);
        if (typeof snapshot.serverTime === "number") serverTimeOffsetRef.current = snapshot.serverTime - Date.now();
      } catch { /* Skill usage is refreshed again by exploration heartbeats. */ }
    };
    void loadSkillUsage();
    return () => { active = false; };
  }, [gameStarted]);

  useEffect(() => {
    if (skillUsesResetAt === null) return;
    const updateRecoveryTime = () => {
      const now = Date.now() + serverTimeOffsetRef.current;
      setSkillRecoveryNow(now);
      if (now >= skillUsesResetAt) {
        setSkillUses({});
        setSkillUsesResetAt(nextSkillResetAt(now));
      }
    };
    updateRecoveryTime();
    const timer = window.setInterval(updateRecoveryTime, 1_000);
    return () => window.clearInterval(timer);
  }, [skillUsesResetAt]);

  useEffect(() => {
    if (!chatWasAtBottomRef.current) return;
    for (const messagesElement of [desktopChatMessagesRef.current, mobileChatMessagesRef.current]) {
      if (messagesElement) messagesElement.scrollTop = messagesElement.scrollHeight;
    }
  }, [messagesMapKey, latestChatMessageId]);

  useEffect(() => {
    if (!mobileChatOpen) return;
    chatWasAtBottomRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      const messagesElement = mobileChatMessagesRef.current;
      if (messagesElement) messagesElement.scrollTop = messagesElement.scrollHeight;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mobileChatOpen, latestChatMessageId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const targets = desktopChatTab === "chat"
        ? [desktopChatMessagesRef.current, mobileChatMessagesRef.current]
        : [desktopLogMessagesRef.current, mobileLogMessagesRef.current];
      for (const element of targets) {
        if (element) element.scrollTop = element.scrollHeight;
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [desktopChatTab, explorationLogs, mobileChatOpen]);

  useEffect(() => {
    if (view !== "explore") return;
    const leaveExplorationSession = () => {
      const clientId = presenceClientIdRef.current;
      if (clientId) navigator.sendBeacon("/api/crocsians/session", JSON.stringify({ map: currentMapKey, clientId, leave: true }));
    };
    window.addEventListener("pagehide", leaveExplorationSession);
    return () => window.removeEventListener("pagehide", leaveExplorationSession);
  }, [currentMapKey, view]);

  useEffect(() => {
    let active = true;
    const applyProduction = (serverTime: number) => {
      setBuildings((current) => {
        let changed = false;
        const next = { ...current };
        Object.entries(current).forEach(([key, building]) => {
          if (building.kind === "furnace") {
            if (!building.smeltingJob || building.ready || building.smeltingJob.completedAt > serverTime) return;
            next[Number(key)] = { ...building, ready: true };
            changed = true;
            return;
          }
          if (building.ready || CRAFTING_KINDS.has(building.kind)) return;
          const producedCount = Math.floor(Math.max(0, serverTime - building.lastProductionAt) / PRODUCTION_INTERVAL_MS);
          if (producedCount < 1) return;
          const stockCount = Math.min(MAX_STOCK_COUNT, building.stockCount + producedCount);
          const ready = stockCount === MAX_STOCK_COUNT;
          next[Number(key)] = { ...building, stockCount, ready, lastProductionAt: ready ? serverTime : building.lastProductionAt + producedCount * PRODUCTION_INTERVAL_MS };
          changed = true;
        });
        return changed ? next : current;
      });
    };
    const syncProduction = async () => {
      try {
        const response = await fetch("/api/crocsians/time", { cache: "no-store" });
        if (!response.ok) return;
        const { serverTime } = await response.json() as { serverTime: number };
        if (!active || !Number.isFinite(serverTime)) return;
        serverTimeOffsetRef.current = serverTime - Date.now();
        const restockKey = getMerchantRestockKey(serverTime);
        if (merchantStockRestockKeyRef.current && merchantStockRestockKeyRef.current !== restockKey) {
          setMerchantStock(createMerchantStock(skillLevels.regularCustomer ?? 0, skillLevels.marketResearch ?? 0));
          setSystemMessage("日本時間午前4:00の商店街在庫更新が行われました");
        }
        merchantStockRestockKeyRef.current = restockKey;
        setMerchantStockRestockKey(restockKey);
        applyProduction(serverTime);
      } catch { /* Production retries against server time on the next sync. */ }
    };
    void syncProduction();
    const timer = window.setInterval(() => void syncProduction(), 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [skillLevels.marketResearch, skillLevels.regularCustomer]);

  useEffect(() => {
    if (view !== "explore") return;
    let active = true;
    const map = currentMapKey;
    let clientId = presenceClientIdRef.current;
    if (!clientId) {
      clientId = window.sessionStorage.getItem("crocsians-presence-id") ?? window.crypto.randomUUID();
      window.sessionStorage.setItem("crocsians-presence-id", clientId);
      presenceClientIdRef.current = clientId;
    }
    const applySnapshot = (snapshot: SharedExplorationSnapshot) => {
      if (!active) return;
      const player = snapshot.players.find((entry) => entry.id === clientId);
      const result = snapshot.result;
      if (result && player && result.createdAt >= (player.joinedAt ?? 0) && result.recipientIds.includes(clientId) && !appliedSharedResultsRef.current.has(result.id)) {
        const resultStorageKey = `crocsians-shared-result:${result.id}`;
        if (window.sessionStorage.getItem(resultStorageKey)) {
          appliedSharedResultsRef.current.add(result.id);
        } else {
          appliedSharedResultsRef.current.add(result.id);
          window.sessionStorage.setItem(resultStorageKey, "applied");
          const rewardedGold = result.goldByRecipient?.[clientId] ?? result.gold;
          if (rewardedGold) setResources((current) => ({ gold: current.gold + rewardedGold }));
          if (result.exp) {
            setJobProgress((current) => {
              const progress = current[job];
              const previousLevel = getPlayerProgress(progress.experience).level;
              const experience = progress.experience + result.exp!;
              const gainedLevels = Math.max(0, getPlayerProgress(experience).level - previousLevel);
              return { ...current, [job]: { experience, skillPoints: progress.skillPoints + gainedLevels } };
            });
          }
          const rewardedMaterials = normalizeRewardMaterials(result.materialsByRecipient?.[clientId] ?? result.materials);
          if (rewardedMaterials?.length) {
            setMaterialInventory((current) => {
              const next = { ...current };
              rewardedMaterials.forEach((material) => { next[material.name] = (next[material.name] ?? 0) + material.quantity; });
              return next;
            });
            setLastLoot(rewardedMaterials.map((material) => ({ ...material, rare: false })));
          }
          if (result.potion) setCraftedItems((current) => ({ ...current, potion: current.potion + result.potion! }));
          if (result.clearStatus) setStatusEffect(null);
          if (result.setStatus) setStatusEffect(result.setStatus);
          setSystemMessage(result.message);
        }
      }
      if ((snapshot.forcedReturnPlayerIds ?? []).includes(clientId)) {
        active = false;
        void fetch("/api/crocsians/session", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ map, clientId }) });
        setBattleActive(false);
        setEnemies([]);
        setExplorationEvent(null);
        setStatusEffect(null);
        setTempleOpen(false);
        setConnectedPlayers([]);
        setConnectedPlayersMapKey(null);
        setCurrentDungeon(null);
        setView("town");
        setReturnNotice(snapshot.dungeon ? "ダンジョンアタックが完了し、街へ帰還しました" : "宝箱が5分間開けられなかったため、探索隊全員が街へ帰還しました（ペナルティなし）");
        setSystemMessage(snapshot.dungeon ? "ダンジョンアタックが完了しました" : "宝箱の放置時間が5分を超えたため、街へ帰還しました");
        return;
      }
      setEventCountdown(snapshot.countdown);
      setEventCount(snapshot.eventCount);
      setBattleActive(snapshot.battleActive);
      setEnemies(snapshot.enemies);
      setExplorationEvent(snapshot.event);
      setBattleLog(snapshot.log);
      setCurrentDungeon(snapshot.dungeon ?? null);
      setConnectedPlayers(snapshot.players);
      setConnectedPlayersMapKey(map);
      if (snapshot.portalRates) setPortalRates({ ...INITIAL_PORTAL_RATES, ...snapshot.portalRates });
      if (snapshot.portalKeyInventory) setPortalKeyInventory({ ...INITIAL_PORTAL_KEY_INVENTORY, ...snapshot.portalKeyInventory });
      if (snapshot.skillUses) setSkillUses(snapshot.skillUses);
      if (snapshot.skillUsesResetAt !== undefined) setSkillUsesResetAt(snapshot.skillUsesResetAt);
      if (typeof snapshot.serverTime === "number") serverTimeOffsetRef.current = snapshot.serverTime - Date.now();
      const newCombatActions = snapshot.combatActions.filter((action) => {
        const actionKey = `${snapshot.sessionId}:${action.id}`;
        if (appliedCombatActionsRef.current.has(actionKey)) return false;
        appliedCombatActionsRef.current.add(actionKey);
        return action.createdAt >= (player?.joinedAt ?? Number.POSITIVE_INFINITY) && action.participantIds.includes(clientId);
      });
      if (appliedCombatActionsRef.current.size > 512) appliedCombatActionsRef.current = new Set(snapshot.combatActions.map((action) => `${snapshot.sessionId}:${action.id}`));
      if (newCombatActions.length > 0) {
        newCombatActions.forEach((action) => playSe(action.weaponSe));
        if (hitFlashTimerRef.current) window.clearTimeout(hitFlashTimerRef.current);
        setFlashingEnemyIds(new Set(newCombatActions.flatMap((action) => action.targetEnemyIds)));
        setFlashingPlayerIds(new Set(newCombatActions.flatMap((action) => action.targetPlayerIds ?? [])));
        hitFlashTimerRef.current = window.setTimeout(() => {
          setFlashingEnemyIds(new Set());
          setFlashingPlayerIds(new Set());
          hitFlashTimerRef.current = null;
        }, 520);
      }
      if (player) {
        setHp(player.hp);
        setStatusEffect(player.statusEffect ?? null);
      }
    };
    const requestSnapshot = async (heartbeat = false) => {
      try {
        const response = heartbeat
          ? await fetch("/api/crocsians/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
            action: "heartbeat",
            map,
            clientId,
            name: characterName,
            job,
            level: playerProgress.level,
            hp: hpRef.current,
            maxHp,
            icon: characterIcon,
            atk: totalAttack,
            offhandAtk: offhandAttack,
            def: totalDefense,
            luck: totalLuck,
            skillLevels,
            cardinalLevels,
            equippedCardinal,
            equippedWeapon,
            equippedArmor,
            equippedWeaponHighQuality,
            equippedOffhandWeapon,
            equippedOffhandWeaponHighQuality,
            equippedArmorHighQuality,
            weaponSe: equippedWeaponSe,
            treasureHunt: job === "盗賊" ? skillLevels.treasureHunt ?? 0 : 0,
            treasureDisarmBonus: job === "盗賊" ? (skillLevels.lockpicking ?? 0) * 3 : 0,
            damageReduction: job === "僧侶" ? (skillLevels.blessing ?? 0) * 0.04 : 0,
            autoHealLevel: job === "僧侶" ? skillLevels.autoHeal ?? 0 : 0,
            autoHealRecovery: job === "僧侶" ? Math.floor(playerProgress.level * (skillLevels.autoHeal ?? 0) * PRIEST_AUTO_HEAL_RECOVERY_MULTIPLIER) : 0,
            autoResurrectLevel: job === "僧侶" ? skillLevels.autoResurrect ?? 0 : 0,
            divineDevotionLevel: job === "僧侶" ? skillLevels.divineDevotion ?? 0 : 0,
            divineDevotionAtkBonus: job === "僧侶" && (skillLevels.divineDevotion ?? 0) > 0 ? Math.max(0, totalAttack - 1) : 0,
            strongDutyLevel: job === "戦士" ? skillLevels.strongDuty ?? 0 : 0,
            strongDutyThreatMultiplier: job === "戦士" && (skillLevels.strongDuty ?? 0) > 0 ? WARRIOR_STRONG_DUTY_THREAT_MULTIPLIER : 1,
            strongDutyDamageReduction: job === "戦士" && (skillLevels.strongDuty ?? 0) > 0 ? WARRIOR_STRONG_DUTY_DAMAGE_REDUCTION : 0,
            counterAttackRate: job === "戦士" ? (skillLevels.counterAttack ?? 0) * WARRIOR_COUNTER_RATE_PER_LEVEL : 0,
            evasionRate: job === "盗賊" ? (skillLevels.evasion ?? 0) * THIEF_EVASION_RATE_PER_LEVEL : 0,
            safeFleeLevel: job === "盗賊" ? skillLevels.safeFlee ?? 0 : 0,
            falsePraiseLevel: job === "盗賊" ? skillLevels.falsePraise ?? 0 : 0,
            goldBonus: (skillLevels.extortion ?? 0) * 0.2,
            rareDropBonus: (skillLevels.dismantler ?? 0) * 0.02,
            cardinalStatusResist,
            cardinalAccuracyBonus,
          }) })
          : await fetch(`/api/crocsians/session?map=${encodeURIComponent(map)}`, { cache: "no-store" });
        if (response.ok) applySnapshot(await response.json() as SharedExplorationSnapshot);
      } catch { /* The next realtime poll retries automatically. */ }
    };
    void requestSnapshot(true);
    const pollTimer = window.setInterval(() => void requestSnapshot(false), 300);
    const heartbeatTimer = window.setInterval(() => void requestSnapshot(true), 4_000);
    return () => {
      active = false;
      window.clearInterval(pollTimer);
      window.clearInterval(heartbeatTimer);
    };
  }, [cardinalAccuracyBonus, cardinalLevels, cardinalStatusResist, characterIcon, characterName, currentMap.code, currentMapKey, equippedArmor, equippedArmorHighQuality, equippedCardinal, equippedWeapon, equippedWeaponHighQuality, equippedOffhandWeapon, equippedOffhandWeaponHighQuality, equippedWeaponSe, job, maxHp, offhandAttack, playerProgress.level, skillLevels, totalAttack, totalDefense, totalLuck, view]);

  useEffect(() => {
    if (view !== "town" || !templeOpen) return;
    let active = true;
    const refreshPopulations = async () => {
      try {
        const response = await fetch("/api/crocsians/session?populations=1", { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as { populations?: Record<string, number>; dungeonParties?: DungeonPartyListing[]; portalRates?: PortalRates; portalKeyInventory?: PortalKeyInventory };
        if (active && result.populations) setMapPopulations(result.populations);
        if (active && result.dungeonParties) setDungeonParties(result.dungeonParties);
        if (active && result.portalRates) setPortalRates({ ...INITIAL_PORTAL_RATES, ...result.portalRates });
        if (active && result.portalKeyInventory) setPortalKeyInventory({ ...INITIAL_PORTAL_KEY_INVENTORY, ...result.portalKeyInventory });
      } catch { /* The next refresh retries automatically. */ }
    };
    void refreshPopulations();
    const timer = window.setInterval(() => void refreshPopulations(), 4_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [templeOpen, view]);

  useEffect(() => {
    if (view !== "explore" || hp > 0) return;
    const timer = window.setTimeout(() => {
      const clientId = presenceClientIdRef.current;
      if (clientId) {
        void fetch("/api/crocsians/session", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ map: currentMapKey, clientId }),
        });
      }
      setBattleActive(false);
      setEnemies([]);
      setExplorationEvent(null);
      setStatusEffect(null);
      setTempleOpen(false);
      setResources((current) => ({ ...current, gold: Math.floor(current.gold / 2) }));
      setReturnNotice("HPが0になったため強制帰還しました。所持金が半額になりました");
      setSystemMessage("強制帰還ペナルティにより所持金が半額になりました");
      setView("town");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentMapKey, hp, view]);

  useEffect(() => {
    if (view !== "base" || mapInitialFitDoneRef.current || !mapViewportRef.current) return;
    const viewport = mapViewportRef.current;
    let animationFrame = 0;
    const fitMapToViewport = () => {
      if (mapInitialFitDoneRef.current) return;
      window.cancelAnimationFrame(animationFrame);
      animationFrame = window.requestAnimationFrame(() => {
        const style = window.getComputedStyle(viewport);
        const horizontalPadding = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight);
        const verticalPadding = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom);
        const availableWidth = Math.max(0, viewport.clientWidth - horizontalPadding - 2);
        const availableHeight = Math.max(0, viewport.clientHeight - verticalPadding - 2);
        if (availableWidth === 0 || availableHeight === 0) return;
        const fittingZoom = Math.min(availableWidth / MAP_PIXEL_SIZE, availableHeight / MAP_PIXEL_SIZE, 1);
        const nextZoom = Math.max(MIN_MAP_ZOOM, Math.floor(fittingZoom * 1000) / 1000);
        mapInitialFitDoneRef.current = true;
        setZoom((current) => Math.abs(current - nextZoom) < 0.001 ? current : nextZoom);
      });
    };
    fitMapToViewport();
    const resizeObserver = new ResizeObserver(fitMapToViewport);
    resizeObserver.observe(viewport);
    window.addEventListener("resize", fitMapToViewport);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      window.removeEventListener("resize", fitMapToViewport);
    };
  }, [view]);

  useEffect(() => {
    if (view !== "base" || !mapViewportRef.current) return;
    const viewport = mapViewportRef.current;
    window.requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) / 2);
      viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) / 2);
    });
  }, [view]);

  useEffect(() => {
    if (!saveLoadedRef.current || !gameStarted) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const data: CrocsiansSaveData = { playerProgressionVersion: PLAYER_PROGRESSION_VERSION, merchantSkillResetVersion: MERCHANT_SKILL_RESET_VERSION, resources, buildings, baseTiles, mapLayoutVersion: MAP_LAYOUT_VERSION, craftedItems, job, materialInventory, materialFavorites, weaponInventory, armorInventory, highQualityWeaponInventory, highQualityArmorInventory, merchantStock, merchantStockVersion: MERCHANT_STOCK_VERSION, merchantStockRestockKey, characterName, characterIcon, jobProgress, skillLevels, cardinalLevels, equippedCardinal, equippedWeapon, equippedOffhandWeapon, equippedArmor, equippedWeaponHighQuality, equippedOffhandWeaponHighQuality, equippedArmorHighQuality, bgmVolume, seVolume, textSize, expeditionPanelSide, chatPanelSide, portalRates, portalKeyInventory };
        const response = await fetch("/api/crocsians/save", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data }), signal: controller.signal });
        if (response.status === 401) window.location.assign(`/login?next=${encodeURIComponent("/crocsians")}`);
        else if (!response.ok) setSystemMessage("サーバーへのセーブに失敗しました。通信状態を確認してください");
        else {
          const result = await response.json() as { merchantStock?: Record<string, number>; merchantStockRestockKey?: string };
          if (result.merchantStockRestockKey && result.merchantStockRestockKey !== merchantStockRestockKeyRef.current) {
            merchantStockRestockKeyRef.current = result.merchantStockRestockKey;
            setMerchantStockRestockKey(result.merchantStockRestockKey);
            if (result.merchantStock) setMerchantStock(result.merchantStock);
            setSystemMessage("日本時間午前4:00の商店街在庫更新が行われました");
          }
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setSystemMessage("サーバーへのセーブに失敗しました。通信状態を確認してください");
      }
    }, 700);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [gameStarted, resources, buildings, baseTiles, craftedItems, job, materialInventory, materialFavorites, weaponInventory, armorInventory, highQualityWeaponInventory, highQualityArmorInventory, merchantStock, merchantStockRestockKey, characterName, characterIcon, jobProgress, skillLevels, cardinalLevels, equippedCardinal, equippedWeapon, equippedOffhandWeapon, equippedArmor, equippedWeaponHighQuality, equippedOffhandWeaponHighQuality, equippedArmorHighQuality, bgmVolume, seVolume, textSize, expeditionPanelSide, chatPanelSide, portalRates, portalKeyInventory]);

  const selectedBuilding = buildings[selectedCell];
  const selectedTileCells = useMemo(() => new Set(tileDragSelection ? tileRectangleCells(tileDragSelection.start, tileDragSelection.end).cells : []), [tileDragSelection]);
  const completed = useMemo(() => Object.values(buildings).filter((building) => building.ready && !CRAFTING_KINDS.has(building.kind)).length, [buildings]);
  const buildingCounts = useMemo(() => Object.values(buildings).reduce<Partial<Record<BuildingKind, number>>>((counts, building) => {
    counts[building.kind] = (counts[building.kind] ?? 0) + 1;
    return counts;
  }, {}), [buildings]);
  const filteredMaterials = useMemo(() => {
    const query = materialSearch.trim().toLocaleLowerCase("ja-JP");
    const filtered = MATERIALS.filter((material) => {
      const matchesQuery = !query || [material.name, material.category, material.uses, material.description].some((value) => value.toLocaleLowerCase("ja-JP").includes(query));
      return matchesQuery && (!ownedMaterialsOnly || (materialInventory[material.name] ?? 0) > 0) && (materialCategory === "すべて" || material.category === materialCategory) && (materialRarity === "すべて" || material.rarity === materialRarity);
    });
    return sortItemList(filtered, inventorySort, (material) => materialInventory[material.name] ?? 0);
  }, [inventorySort, materialCategory, materialInventory, materialRarity, materialSearch, ownedMaterialsOnly]);
  const materialFavoriteSet = useMemo(() => new Set(materialFavorites), [materialFavorites]);
  const filteredFavoriteMaterials = useMemo(() => {
    const query = materialSearch.trim().toLocaleLowerCase("ja-JP");
    const filtered = MATERIALS.filter((material) => {
      const matchesQuery = !query || [material.name, material.category, material.uses, material.description].some((value) => value.toLocaleLowerCase("ja-JP").includes(query));
      return materialFavoriteSet.has(material.name) && matchesQuery && (!ownedMaterialsOnly || (materialInventory[material.name] ?? 0) > 0) && (materialCategory === "すべて" || material.category === materialCategory) && (materialRarity === "すべて" || material.rarity === materialRarity);
    });
    return sortItemList(filtered, inventorySort, (material) => materialInventory[material.name] ?? 0);
  }, [inventorySort, materialCategory, materialFavoriteSet, materialInventory, materialRarity, materialSearch, ownedMaterialsOnly]);
  const collectedMaterialCount = useMemo(() => MATERIALS.filter((material) => (materialInventory[material.name] ?? 0) > 0).length, [materialInventory]);
  const favoriteMaterialCount = materialFavorites.length;
  const inventoryQuery = materialSearch.trim().toLocaleLowerCase("ja-JP");
  const filteredInventoryWeapons = useMemo(() => sortItemList(WEAPONS.filter((weapon) => (!inventoryQuery || weapon.name.toLocaleLowerCase("ja-JP").includes(inventoryQuery)) && (!ownedMaterialsOnly || (weaponInventory[weapon.name] ?? 0) + (highQualityWeaponInventory[weapon.name] ?? 0) > 0)), inventorySort, (weapon) => (weaponInventory[weapon.name] ?? 0) + (highQualityWeaponInventory[weapon.name] ?? 0)), [highQualityWeaponInventory, inventoryQuery, inventorySort, ownedMaterialsOnly, weaponInventory]);
  const filteredInventoryArmors = useMemo(() => sortItemList(ARMORS.filter((armor) => (!inventoryQuery || armor.name.toLocaleLowerCase("ja-JP").includes(inventoryQuery)) && (!ownedMaterialsOnly || (armorInventory[armor.name] ?? 0) + (highQualityArmorInventory[armor.name] ?? 0) > 0)), inventorySort, (armor) => (armorInventory[armor.name] ?? 0) + (highQualityArmorInventory[armor.name] ?? 0)), [armorInventory, highQualityArmorInventory, inventoryQuery, inventorySort, ownedMaterialsOnly]);
  const unlockedWeaponCount = selectedBuilding?.kind === "weapon" ? WEAPONS.filter((weapon) => weapon.requiredLevel <= selectedBuilding.level).length : 0;
  const unlockedArmorCount = selectedBuilding?.kind === "armor" ? ARMORS.filter((armor) => armor.requiredLevel <= selectedBuilding.level).length : 0;
  const jobSkills = useMemo(() => SKILLS.filter((skill) => skill.job === job), [job]);
  const merchantQuery = merchantSearch.trim().toLocaleLowerCase("ja-JP");
  const merchantMaterials = useMemo(() => sortItemList(MATERIALS.filter((material) => (!merchantOwnedOnly || (materialInventory[material.name] ?? 0) > 0) && (!merchantQuery || [material.name, material.category, material.uses].some((value) => value.toLocaleLowerCase("ja-JP").includes(merchantQuery)))), merchantSort, (material) => materialInventory[material.name] ?? 0), [materialInventory, merchantOwnedOnly, merchantQuery, merchantSort]);
  const merchantWeapons = useMemo(() => sortItemList(WEAPONS.filter((weapon) => !merchantQuery || weapon.name.toLocaleLowerCase("ja-JP").includes(merchantQuery)), merchantSort, (weapon) => weaponInventory[weapon.name] ?? 0), [merchantQuery, merchantSort, weaponInventory]);
  const merchantArmors = useMemo(() => sortItemList(ARMORS.filter((armor) => !merchantQuery || armor.name.toLocaleLowerCase("ja-JP").includes(merchantQuery)), merchantSort, (armor) => armorInventory[armor.name] ?? 0), [armorInventory, merchantQuery, merchantSort]);
  const filteredSupplies = useMemo<SupplyCatalogItem[]>(() => {
    const supplies: SupplyCatalogItem[] = [
      { id: 1, name: "回復薬", owned: craftedItems.potion, price: 60, rarity: "N", description: `探索中に使用するとHPを${POTION_HEAL_AMOUNT}回復します。`, action: "" },
      { id: 2, name: "免罪符", owned: craftedItems.indulgence, price: INDULGENCE_GOLD, rarity: "SSR", description: `商人街で売却すると${formatNumber(INDULGENCE_GOLD)}Gを入手できます。`, action: "" },
      ...PORTAL_COLORS.flatMap((color, colorIndex) => DUNGEON_STORAGE_LEVELS.map<SupplyCatalogItem>((level, levelIndex) => ({ id: 100 + colorIndex * 10 + levelIndex, name: `${color.name} Lv${DISPLAY_PORTAL_LEVELS[level]}`, owned: portalKeyInventory[color.id]?.[level] ?? 0, price: 0, rarity: "SR", description: "ダンジョン転移に使う鍵です。売却不可。", action: "locked" }))),
      ...PORTAL_COLORS.map<SupplyCatalogItem>((color, colorIndex) => {
        const name = DUNGEON_BADGES[color.id];
        return { id: 200 + colorIndex, name, owned: materialInventory[name] ?? 0, price: 0, rarity: "SSR", description: "ダンジョンで入手した色別バッジです。", action: "locked", kindLabel: "バッジ" };
      }),
    ];
    const filtered = supplies.filter((item) => (!inventoryQuery || `${item.name} 道具 消耗品 転移キー ${item.kindLabel ?? ""}`.toLocaleLowerCase("ja-JP").includes(inventoryQuery)) && (!ownedMaterialsOnly || item.owned > 0));
    return sortItemList(filtered, inventorySort, (item) => item.owned);
  }, [craftedItems.indulgence, craftedItems.potion, inventoryQuery, inventorySort, materialInventory, ownedMaterialsOnly, portalKeyInventory]);
  const merchantSupplies = useMemo<SupplyCatalogItem[]>(() => {
    const filtered = [
      { id: 1, name: "回復薬", owned: craftedItems.potion, price: 60, rarity: "N", description: "探索中にHPを28回復", action: "sell" },
      { id: 2, name: "免罪符", owned: craftedItems.indulgence, price: INDULGENCE_GOLD, rarity: "SSR", description: "補填用換金アイテム", action: "sellIndulgence" },
    ].filter((item) => !merchantQuery || `${item.name} 道具 消耗品`.toLocaleLowerCase("ja-JP").includes(merchantQuery)) as SupplyCatalogItem[];
    return sortItemList(filtered, merchantSort, (item) => item.owned);
  }, [craftedItems.indulgence, craftedItems.potion, merchantQuery, merchantSort]);
  const marketInventoryOptions = useMemo<MarketInventoryOption[]>(() => [
    ...MATERIALS.filter((item) => (materialInventory[item.name] ?? 0) > 0).map((item) => ({ key: `MATERIAL:${item.id}`, type: "MATERIAL" as const, id: item.id, name: item.name, owned: materialInventory[item.name], npcPrice: item.sellPrice })),
    ...WEAPONS.map((item) => ({ key: `WEAPON:${item.id}`, type: "WEAPON" as const, id: item.id, name: item.name, owned: Math.max(0, (weaponInventory[item.name] ?? 0) - (equippedWeapon === item.name && !equippedWeaponHighQuality ? 1 : 0) - (equippedOffhandWeapon === item.name && !equippedOffhandWeaponHighQuality ? 1 : 0)), npcPrice: item.sellPrice })).filter((item) => item.owned > 0),
    ...ARMORS.map((item) => ({ key: `ARMOR:${item.id}`, type: "ARMOR" as const, id: item.id, name: item.name, owned: Math.max(0, (armorInventory[item.name] ?? 0) - (equippedArmor === item.name && !equippedArmorHighQuality ? 1 : 0)), npcPrice: item.sellPrice })).filter((item) => item.owned > 0),
    ...(craftedItems.potion > 0 ? [{ key: "SUPPLY:1", type: "SUPPLY" as const, id: 1, name: "回復薬", owned: craftedItems.potion, npcPrice: 60 }] : []),
    ...(craftedItems.indulgence > 0 ? [{ key: "SUPPLY:2", type: "SUPPLY" as const, id: 2, name: "免罪符", owned: craftedItems.indulgence, npcPrice: INDULGENCE_GOLD }] : []),
  ], [armorInventory, craftedItems.indulgence, craftedItems.potion, equippedArmor, equippedArmorHighQuality, equippedWeapon, equippedWeaponHighQuality, equippedOffhandWeapon, equippedOffhandWeaponHighQuality, materialInventory, weaponInventory]);
  const marketItemSearchQuery = marketItemSearch.trim().toLocaleLowerCase("ja-JP");
  const filteredMarketInventoryOptions = useMemo(() => marketInventoryOptions.filter((item) => !marketItemSearchQuery || item.name.toLocaleLowerCase("ja-JP").includes(marketItemSearchQuery)), [marketInventoryOptions, marketItemSearchQuery]);
  const selectedMarketItem = marketInventoryOptions.find((option) => option.key === marketItemKey);
  const marketMinimumPrice = (selectedMarketItem?.npcPrice ?? 0) * marketQuantity;
  const selectedUpgradeRecipe = selectedBuilding && selectedBuilding.level < MAX_BUILDING_LEVEL && BUILDING_UPGRADES[selectedBuilding.kind]?.[String(selectedBuilding.level + 1)] ? buildingUpgradeCost(selectedBuilding.kind, selectedBuilding.level + 1) : null;
  const canUpgradeSelectedBuilding = Boolean(selectedUpgradeRecipe?.every((material) => (materialInventory[material.name] ?? 0) >= material.quantity));
  const selectedSmeltingRecipe = SMELTING_RECIPES.find((recipe) => recipe.ore.name === smeltingRecipeName) ?? SMELTING_RECIPES[0];
  const maxSmeltingAmount = selectedSmeltingRecipe ? Math.floor((materialInventory[selectedSmeltingRecipe.ore.name] ?? 0) / ORE_PER_INGOT) : 0;
  const safeSmeltingAmount = Math.max(1, Math.min(Math.max(1, maxSmeltingAmount), smeltingAmount));
  const selectedSmeltingProgress = selectedBuilding?.kind === "furnace" && selectedBuilding.smeltingJob
    ? Math.min(100, Math.max(0, (Date.now() + serverTimeOffsetRef.current - selectedBuilding.smeltingJob.startedAt) / (selectedBuilding.smeltingJob.completedAt - selectedBuilding.smeltingJob.startedAt) * 100))
    : 0;

  function playSe(kind: "click" | "start" | "building" | "enemy" | WeaponSe) {
    if (seVolumeRef.current <= 0) return;
    if (kind === "building" && buildingSeRef.current && !buildingSeRef.current.ended) return;
    const audio = new Audio(`/crocsians/se/${kind}.mp3`);
    audio.volume = seVolumeRef.current;
    activeSeRef.current.add(audio);
    if (kind === "building") buildingSeRef.current = audio;
    const release = () => {
      activeSeRef.current.delete(audio);
      if (buildingSeRef.current === audio) buildingSeRef.current = null;
    };
    audio.addEventListener("ended", release, { once: true });
    audio.addEventListener("error", release, { once: true });
    void audio.play().catch(release);
  }

  function canAfford(kind: BuildingKind) {
    const cost = buildingCost(kind);
    return resources.gold >= cost.gold && cost.materials.every((material) => (materialInventory[material.name] ?? 0) >= material.quantity);
  }

  function canBuild(kind: BuildingKind) {
    return (buildingCounts[kind] ?? 0) < BUILDING_LIMITS[kind] && canAfford(kind);
  }

  function canAffordTile(kind: TileKind) {
    return TILES[kind].materials.every((material) => (materialInventory[material.name] ?? 0) >= material.quantity);
  }

  function placeTileArea(start: number, end: number) {
    const area = tileRectangleCells(start, end);
    setSelectedCell(end);
    if (!tileMode) {
      playSe("click");
      return;
    }
    const selectedTile = tileMode;
    const definition = TILES[selectedTile];
    const changingCells = area.cells.filter((cell) => baseTiles[cell] !== selectedTile);
    if (changingCells.length === 0) {
      setSystemMessage(`選択範囲は既に${definition.name}です`);
      playSe("click");
      return;
    }
    const requiredMaterials = definition.materials.map((material) => ({ ...material, quantity: material.quantity * changingCells.length }));
    if (!requiredMaterials.every((material) => (materialInventory[material.name] ?? 0) >= material.quantity)) {
      setSystemMessage(`${area.width}×${area.height}の${definition.name}に必要な素材が足りません`);
      playSe("click");
      return;
    }
    if (requiredMaterials.length > 0) {
      setMaterialInventory((current) => {
        const next = { ...current };
        requiredMaterials.forEach((material) => { next[material.name] = (next[material.name] ?? 0) - material.quantity; });
        return next;
      });
    }
    setBaseTiles((current) => {
      const next = [...current];
      changingCells.forEach((cell) => { next[cell] = selectedTile; });
      return next;
    });
    setSystemMessage(`${definition.name}を${changingCells.length}マスに張りました（${area.width}×${area.height}）`);
    playSe("building");
  }

  function changeMapZoom(nextZoom: number) {
    const viewport = mapViewportRef.current;
    const clampedZoom = Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, Math.round(nextZoom * 1000) / 1000));
    if (!viewport) {
      setZoom(clampedZoom);
      return;
    }
    const centerX = (viewport.scrollLeft + viewport.clientWidth / 2) / zoom;
    const centerY = (viewport.scrollTop + viewport.clientHeight / 2) / zoom;
    setZoom(clampedZoom);
    window.requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, centerX * clampedZoom - viewport.clientWidth / 2);
      viewport.scrollTop = Math.max(0, centerY * clampedZoom - viewport.clientHeight / 2);
    });
  }

  function touchDistance(touches: React.TouchList) {
    const first = touches.item(0);
    const second = touches.item(1);
    if (!first || !second) return 0;
    return Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
  }

  function beginMapTouch(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 2) return;
    const distance = touchDistance(event.touches);
    if (distance <= 0) return;
    event.preventDefault();
    mapPinchRef.current = { distance, zoom };
  }

  function moveMapTouch(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length !== 2 || !mapPinchRef.current) return;
    const distance = touchDistance(event.touches);
    if (distance <= 0) return;
    event.preventDefault();
    changeMapZoom(mapPinchRef.current.zoom * (distance / mapPinchRef.current.distance));
  }

  function finishMapTouch(event: React.TouchEvent<HTMLDivElement>) {
    if (event.touches.length < 2) mapPinchRef.current = null;
  }

  function tileCellFromPointer(event: React.PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const scaleX = bounds.width / event.currentTarget.offsetWidth;
    const scaleY = bounds.height / event.currentTarget.offsetHeight;
    const contentX = event.clientX - bounds.left - event.currentTarget.clientLeft * scaleX;
    const contentY = event.clientY - bounds.top - event.currentTarget.clientTop * scaleY;
    const column = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(contentX / (event.currentTarget.clientWidth * scaleX) * MAP_SIZE)));
    const row = Math.max(0, Math.min(MAP_SIZE - 1, Math.floor(contentY / (event.currentTarget.clientHeight * scaleY) * MAP_SIZE)));
    return row * MAP_SIZE + column;
  }

  function beginTileDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (basePanelTab !== "tile" || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.preventDefault();
    const cell = tileCellFromPointer(event);
    tileDragStartRef.current = cell;
    tileDragEndRef.current = cell;
    setSelectedCell(cell);
    setTileDragSelection({ start: cell, end: cell });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveTileDrag(event: React.PointerEvent<HTMLDivElement>) {
    const start = tileDragStartRef.current;
    if (start === null) return;
    event.preventDefault();
    const cell = tileCellFromPointer(event);
    if (tileDragEndRef.current === cell) return;
    tileDragEndRef.current = cell;
    setSelectedCell(cell);
    setTileDragSelection({ start, end: cell });
  }

  function finishTileDrag(event: React.PointerEvent<HTMLDivElement>) {
    const start = tileDragStartRef.current;
    if (start === null) return;
    event.preventDefault();
    const end = tileCellFromPointer(event);
    tileDragStartRef.current = null;
    tileDragEndRef.current = null;
    setTileDragSelection(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    placeTileArea(start, end);
  }

  function cancelTileDrag(event: React.PointerEvent<HTMLDivElement>) {
    tileDragStartRef.current = null;
    tileDragEndRef.current = null;
    setTileDragSelection(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function demolishSelectedTile() {
    const currentTile = baseTiles[selectedCell];
    if (currentTile === "soil") return;
    setBaseTiles((current) => { const next = [...current]; next[selectedCell] = "soil"; return next; });
    setSystemMessage(`${TILES[currentTile].name}を解体して土に戻しました`);
    playSe("building");
  }

  function placeBuilding(cell: number) {
    setSelectedCell(cell);
    if (!buildMode) {
      playSe("click");
      return;
    }
    if (!canPlaceFacility(buildings, cell)) {
      playSe("click");
      setSystemMessage("施設は空いている2×2マスに建築してください");
      return;
    }
    const definition = BUILDINGS[buildMode];
    const cost = buildingCost(buildMode);
    if ((buildingCounts[buildMode] ?? 0) >= BUILDING_LIMITS[buildMode]) {
      playSe("click");
      setSystemMessage(`${definition.name}は最大${BUILDING_LIMITS[buildMode]}つまで建築できます`);
      setBuildMode(null);
      return;
    }
    if (!canAfford(buildMode)) {
      playSe("click");
      setSystemMessage("建築資材が足りません");
      return;
    }
    setResources((current) => ({ gold: current.gold - cost.gold }));
    setMaterialInventory((current) => {
      const next = { ...current };
      cost.materials.forEach((material) => { next[material.name] -= material.quantity; });
      return next;
    });
    setBuildings((current) => ({ ...current, [cell]: { id: cell, kind: buildMode, level: 1, stockCount: 0, lastProductionAt: Date.now() + serverTimeOffsetRef.current, ready: false, investedMaterials: cost.materials.map((material) => ({ ...material })) } }));
    setSystemMessage(`${definition.name}の建築を開始しました`);
    setBuildMode(null);
    playSe("building");
  }

  function collect(cell: number) {
    const building = buildings[cell];
    if (!building || building.stockCount === 0 || CRAFTING_KINDS.has(building.kind)) return;
    const collectedCount = building.stockCount;
    const producedMaterials = getProductionMaterials(building);
    if (building.kind === "inn") setResources((current) => ({ gold: current.gold + 130 * building.level * collectedCount }));
    if (producedMaterials.length > 0) setMaterialInventory((current) => {
      const next = { ...current };
      producedMaterials.forEach((material) => { next[material.name] = (next[material.name] ?? 0) + material.quantity * collectedCount; });
      return next;
    });
    setBuildings((current) => ({ ...current, [cell]: { ...building, stockCount: 0, lastProductionAt: building.ready ? Date.now() + serverTimeOffsetRef.current : building.lastProductionAt, ready: false } }));
    setSystemMessage(`${BUILDINGS[building.kind].product}を${collectedCount}回分まとめて回収しました`);
  }

  function startSmelting(cell: number) {
    const building = buildings[cell];
    if (!building || building.kind !== "furnace" || building.smeltingJob || !selectedSmeltingRecipe) return;
    const quantity = safeSmeltingAmount;
    const requiredOre = quantity * ORE_PER_INGOT;
    if ((materialInventory[selectedSmeltingRecipe.ore.name] ?? 0) < requiredOre) {
      setSystemMessage("精錬に必要な鉱石が足りません");
      return;
    }
    const now = Date.now() + serverTimeOffsetRef.current;
    const smeltingJob: SmeltingJob = {
      oreName: selectedSmeltingRecipe.ore.name,
      ingotName: selectedSmeltingRecipe.ingot.name,
      quantity,
      startedAt: now,
      completedAt: now + quantity * SMELTING_INTERVAL_MS,
    };
    setMaterialInventory((current) => ({ ...current, [selectedSmeltingRecipe.ore.name]: current[selectedSmeltingRecipe.ore.name] - requiredOre }));
    setBuildings((current) => ({ ...current, [cell]: { ...building, ready: false, smeltingJob } }));
    setSystemMessage(`${selectedSmeltingRecipe.ore.name}×${requiredOre}の精錬を開始しました（${quantity}個 / ${quantity * 5}分）`);
    playSe("building");
  }

  function collectSmelting(cell: number) {
    const building = buildings[cell];
    const job = building?.smeltingJob;
    if (!building || building.kind !== "furnace" || !job) return;
    const now = Date.now() + serverTimeOffsetRef.current;
    if (job.completedAt > now) {
      setSystemMessage("精錬はまだ完了していません");
      return;
    }
    setMaterialInventory((current) => ({ ...current, [job.ingotName]: (current[job.ingotName] ?? 0) + job.quantity }));
    setBuildings((current) => ({ ...current, [cell]: { ...building, ready: false, smeltingJob: null } }));
    setSystemMessage(`${job.ingotName}を${job.quantity}個受け取りました`);
    playSe("building");
  }

  function getCraftMaterialCosts(materials: MaterialCost[]) {
    const reductionRate = job === "職人" ? (skillLevels.alchemy ?? 0) * 0.04 : 0;
    return materials.map((material) => ({ ...material, quantity: Math.max(1, Math.ceil(material.quantity * (1 - reductionRate))) }));
  }

  function craftingSuccessRate(kind: "weapon" | "armor") {
    const skillBonus = job === "職人" ? (skillLevels[kind === "weapon" ? "weaponCraft" : "armorCraft"] ?? 0) * 5 : 0;
    return Math.min(100, 75 + Math.min(10, Math.floor(totalLuck / 10)) + skillBonus);
  }

  function showCraftOutcome(success: boolean, message: string) {
    if (craftOutcomeTimerRef.current) window.clearTimeout(craftOutcomeTimerRef.current);
    setCraftOutcome({ success, message });
    craftOutcomeTimerRef.current = window.setTimeout(() => {
      setCraftOutcome(null);
      craftOutcomeTimerRef.current = null;
    }, 3200);
  }

  function craft(kind: BuildingKind) {
    const recipes: Partial<Record<BuildingKind, { materials: MaterialCost[]; item: keyof CraftedItems }>> = {
      apothecary: { materials: [{ name: "薬草", quantity: 8 }, { name: "清水", quantity: 4 }, { name: "空き瓶", quantity: 2 }], item: "potion" },
    };
    const recipe = recipes[kind];
    const materialCosts = recipe ? getCraftMaterialCosts(recipe.materials) : [];
    if (!recipe || !materialCosts.every((material) => (materialInventory[material.name] ?? 0) >= material.quantity)) {
      setSystemMessage("製作に必要なアイテムが足りません");
      return;
    }
    setMaterialInventory((current) => {
      const next = { ...current };
      materialCosts.forEach((material) => { next[material.name] -= material.quantity; });
      return next;
    });
    const successRate = Math.min(100, 75 + Math.min(10, Math.floor(totalLuck / 10)));
    if (!randomChance(successRate)) {
      setSystemMessage(`調合に失敗しました（成功率${successRate}%）`);
      return;
    }
    const produced = Math.max(1, selectedBuilding?.level ?? 1);
    setCraftedItems((current) => ({ ...current, [recipe.item]: current[recipe.item] + produced }));
    setSystemMessage(`${BUILDINGS[kind].product}を${produced}個製作しました`);
  }

  function canCraftWeapon(weapon: WeaponDefinition) {
    return selectedBuilding?.kind === "weapon" && selectedBuilding.level >= weapon.requiredLevel && getCraftMaterialCosts(weapon.materials).every((material) => (materialInventory[material.name] ?? 0) >= material.quantity);
  }

  function craftWeapon(weapon: WeaponDefinition) {
    if (selectedBuilding?.kind !== "weapon" || selectedBuilding.level < weapon.requiredLevel) {
      setSystemMessage(`${weapon.name}の製作には武器工房Lv.${weapon.requiredLevel}が必要です`);
      return;
    }
    const materialCosts = getCraftMaterialCosts(weapon.materials);
    if (!materialCosts.every((material) => (materialInventory[material.name] ?? 0) >= material.quantity)) {
      setSystemMessage(`${weapon.name}の製作素材が足りません`);
      return;
    }
    setMaterialInventory((current) => {
      const next = { ...current };
      materialCosts.forEach((material) => { next[material.name] -= material.quantity; });
      return next;
    });
    const successRate = craftingSuccessRate("weapon");
    if (!randomChance(successRate)) {
      setSystemMessage(`${weapon.name}の制作に失敗しました（成功率${successRate}%）`);
      showCraftOutcome(false, `${weapon.name}の制作に失敗しました`);
      return;
    }
    const highQuality = job === "職人" && randomChance((skillLevels.highQuality ?? 0) * 4);
    if (highQuality) setHighQualityWeaponInventory((current) => ({ ...current, [weapon.name]: (current[weapon.name] ?? 0) + 1 }));
    else setWeaponInventory((current) => ({ ...current, [weapon.name]: (current[weapon.name] ?? 0) + 1 }));
    setSystemMessage(`${weapon.name}${highQuality ? "【高品質】" : ""}を1個製作しました${highQuality ? "（ATK +25%）" : ""}`);
    showCraftOutcome(true, `${weapon.name}${highQuality ? "【高品質】" : ""}の制作に成功しました`);
  }

  function sellWeapon(weapon: WeaponDefinition) {
    if ((weaponInventory[weapon.name] ?? 0) < 1) return;
    if (equippedWeapon === weapon.name && !equippedWeaponHighQuality && weaponInventory[weapon.name] === 1) {
      setSystemMessage("装備中の武器は売却できません");
      return;
    }
    setWeaponInventory((current) => ({ ...current, [weapon.name]: current[weapon.name] - 1 }));
    const price = merchantSellPrice(weapon.sellPrice);
    setResources((current) => ({ gold: current.gold + price }));
    setSystemMessage(`${weapon.name}を${formatNumber(price)}Gで売却しました`);
  }

  function canCraftArmor(armor: ArmorDefinition) {
    return selectedBuilding?.kind === "armor" && selectedBuilding.level >= armor.requiredLevel && getCraftMaterialCosts(armor.materials).every((material) => (materialInventory[material.name] ?? 0) >= material.quantity);
  }

  function craftArmor(armor: ArmorDefinition) {
    if (selectedBuilding?.kind !== "armor" || selectedBuilding.level < armor.requiredLevel) {
      setSystemMessage(`${armor.name}の製作には防具工房Lv.${armor.requiredLevel}が必要です`);
      return;
    }
    const materialCosts = getCraftMaterialCosts(armor.materials);
    if (!materialCosts.every((material) => (materialInventory[material.name] ?? 0) >= material.quantity)) {
      setSystemMessage(`${armor.name}の製作素材が足りません`);
      return;
    }
    setMaterialInventory((current) => {
      const next = { ...current };
      materialCosts.forEach((material) => { next[material.name] -= material.quantity; });
      return next;
    });
    const successRate = craftingSuccessRate("armor");
    if (!randomChance(successRate)) {
      setSystemMessage(`${armor.name}の制作に失敗しました（成功率${successRate}%）`);
      showCraftOutcome(false, `${armor.name}の制作に失敗しました`);
      return;
    }
    const highQuality = job === "職人" && randomChance((skillLevels.highQuality ?? 0) * 4);
    if (highQuality) setHighQualityArmorInventory((current) => ({ ...current, [armor.name]: (current[armor.name] ?? 0) + 1 }));
    else setArmorInventory((current) => ({ ...current, [armor.name]: (current[armor.name] ?? 0) + 1 }));
    setSystemMessage(`${armor.name}${highQuality ? "【高品質】" : ""}を1個製作しました${highQuality ? "（DEF +25%）" : ""}`);
    showCraftOutcome(true, `${armor.name}${highQuality ? "【高品質】" : ""}の制作に成功しました`);
  }

  function sellArmor(armor: ArmorDefinition) {
    if ((armorInventory[armor.name] ?? 0) < 1) return;
    if (equippedArmor === armor.name && !equippedArmorHighQuality && armorInventory[armor.name] === 1) {
      setSystemMessage("装備中の防具は売却できません");
      return;
    }
    setArmorInventory((current) => ({ ...current, [armor.name]: current[armor.name] - 1 }));
    const price = merchantSellPrice(armor.sellPrice);
    setResources((current) => ({ gold: current.gold + price }));
    setSystemMessage(`${armor.name}を${formatNumber(price)}Gで売却しました`);
  }

  function sellMaterial(material: MaterialDefinition) {
    if ((materialInventory[material.name] ?? 0) < 1) return;
    setMaterialInventory((current) => ({ ...current, [material.name]: current[material.name] - 1 }));
    const price = merchantSellPrice(material.sellPrice);
    setResources((current) => ({ gold: current.gold + price }));
    setSystemMessage(`${material.name}を${formatNumber(price)}Gで売却しました`);
  }

  function toggleMaterialFavorite(material: MaterialDefinition) {
    const isFavorite = materialFavoriteSet.has(material.name);
    if (!isFavorite && (materialInventory[material.name] ?? 0) < 1) {
      setSystemMessage("未所持の素材はお気に入り登録できません");
      return;
    }
    setMaterialFavorites((current) => isFavorite ? current.filter((name) => name !== material.name) : [...current, material.name]);
    setSystemMessage(isFavorite ? `${material.name}のお気に入りを解除しました` : `${material.name}をお気に入り登録しました`);
  }

  function merchantBuyPrice(sellPrice: number) {
    const luckDiscount = Math.min(0.05, totalLuck / 2000);
    const discount = luckDiscount + (job === "商人" ? (skillLevels.bargain ?? 0) * 0.03 : 0);
    return Math.max(1, Math.ceil(sellPrice * 2 * (1 - discount)));
  }

  function merchantSellPrice(sellPrice: number) {
    const luckBonus = Math.min(0.05, totalLuck / 2000);
    const bonus = luckBonus + (job === "商人" ? (skillLevels.negotiation ?? 0) * 0.03 : 0);
    return Math.max(1, Math.floor(sellPrice * (1 + bonus)));
  }

  function canPurchaseMerchantMaterial(material: MaterialDefinition) {
    if (material.rarity === "N" || material.rarity === "R") return true;
    if (job !== "商人") return false;
    const secretTradeLevel = skillLevels.marketResearch ?? 0;
    return material.rarity === "SR" && secretTradeLevel >= 1;
  }

  function clampTradeAmount(amount: number, max: number) {
    if (max < 1) return 1;
    return Math.max(1, Math.min(max, Math.floor(amount)));
  }

  function merchantTradeAmount(key: string, max: number) {
    return clampTradeAmount(merchantTradeAmounts[key] ?? 1, max);
  }

  function updateMerchantTradeAmount(key: string, amount: number, max: number) {
    setMerchantTradeAmounts((current) => ({ ...current, [key]: clampTradeAmount(amount, max) }));
  }

  function merchantMaterialPurchaseMax(material: MaterialDefinition) {
    if (!canPurchaseMerchantMaterial(material)) return 0;
    const buyPrice = merchantBuyPrice(material.sellPrice);
    const stock = Math.max(0, merchantStock[material.name] ?? 0);
    return Math.max(0, Math.min(stock, Math.floor(resources.gold / buyPrice)));
  }

  function weaponSellableAmount(weapon: WeaponDefinition) {
    const owned = weaponInventory[weapon.name] ?? 0;
    const equippedCount = (equippedWeapon === weapon.name && !equippedWeaponHighQuality ? 1 : 0) + (equippedOffhandWeapon === weapon.name && !equippedOffhandWeaponHighQuality ? 1 : 0);
    return Math.max(0, owned - equippedCount);
  }

  function armorSellableAmount(armor: ArmorDefinition) {
    const owned = armorInventory[armor.name] ?? 0;
    const equippedCount = equippedArmor === armor.name && !equippedArmorHighQuality ? 1 : 0;
    return Math.max(0, owned - equippedCount);
  }

  function buyMaterial(material: MaterialDefinition, amount: number) {
    amount = clampTradeAmount(amount, merchantMaterialPurchaseMax(material));
    if (!canPurchaseMerchantMaterial(material)) {
      setSystemMessage(material.rarity === "SSR" ? "SSR素材は購入できません" : "SR素材の購入には商人の秘蔵品取引Lv.1が必要です");
      return;
    }
    if (Math.max(0, merchantStock[material.name] ?? 0) < amount) {
      setSystemMessage("商人の在庫が足りません");
      return;
    }
    const price = merchantBuyPrice(material.sellPrice) * amount;
    if (resources.gold < price) {
      setSystemMessage("購入に必要な所持金が足りません");
      return;
    }
    setResources((current) => ({ gold: current.gold - price }));
    setMaterialInventory((current) => ({ ...current, [material.name]: (current[material.name] ?? 0) + amount }));
    setMerchantStock((current) => ({ ...current, [material.name]: current[material.name] - amount }));
    setSystemMessage(`${material.name}を${amount}個、${formatNumber(price)}Gで購入しました`);
  }

  function sellMaterialAmount(material: MaterialDefinition, amount: number) {
    amount = clampTradeAmount(amount, materialInventory[material.name] ?? 0);
    if ((materialInventory[material.name] ?? 0) < amount) return;
    setMaterialInventory((current) => ({ ...current, [material.name]: current[material.name] - amount }));
    const price = merchantSellPrice(material.sellPrice) * amount;
    setResources((current) => ({ gold: current.gold + price }));
    if (material.rarity === "N" || material.rarity === "R") setMerchantStock((current) => ({ ...current, [material.name]: (current[material.name] ?? 0) + amount }));
    setSystemMessage(`${material.name}を${amount}個、${formatNumber(price)}Gで売却しました`);
  }

  function sellWeaponAmount(weapon: WeaponDefinition, amount: number) {
    amount = clampTradeAmount(amount, weaponSellableAmount(weapon));
    if (weaponSellableAmount(weapon) < amount) return;
    setWeaponInventory((current) => ({ ...current, [weapon.name]: current[weapon.name] - amount }));
    const price = merchantSellPrice(weapon.sellPrice) * amount;
    setResources((current) => ({ gold: current.gold + price }));
    setSystemMessage(`${weapon.name}を${amount}個、${formatNumber(price)}Gで売却しました`);
  }

  function sellArmorAmount(armor: ArmorDefinition, amount: number) {
    amount = clampTradeAmount(amount, armorSellableAmount(armor));
    if (armorSellableAmount(armor) < amount) return;
    setArmorInventory((current) => ({ ...current, [armor.name]: current[armor.name] - amount }));
    const price = merchantSellPrice(armor.sellPrice) * amount;
    setResources((current) => ({ gold: current.gold + price }));
    setSystemMessage(`${armor.name}を${amount}個、${formatNumber(price)}Gで売却しました`);
  }

  function sellPotionAmount(amount: number) {
    amount = clampTradeAmount(amount, craftedItems.potion);
    if (craftedItems.potion < amount) return;
    setCraftedItems((current) => ({ ...current, potion: current.potion - amount }));
    const price = merchantSellPrice(60) * amount;
    setResources((current) => ({ gold: current.gold + price }));
    setSystemMessage(`回復薬を${amount}個、${formatNumber(price)}Gで売却しました`);
  }

  function openGoldSupply(name: string, amount: number, consume: () => void) {
    consume();
    setResources((current) => ({ gold: current.gold + amount }));
    setSystemMessage(`${name}を開封し、${formatNumber(amount)}Gを入手しました`);
  }

  function sellIndulgenceAmount(amount: number) {
    amount = clampTradeAmount(amount, craftedItems.indulgence);
    if (craftedItems.indulgence < amount) return;
    setCraftedItems((current) => ({ ...current, indulgence: current.indulgence - amount }));
    const price = INDULGENCE_GOLD * amount;
    setResources((current) => ({ gold: current.gold + price }));
    setSystemMessage(`免罪符を${amount}個、${formatNumber(price)}Gで売却しました`);
  }

  function marketPlayerId() {
    let playerId = window.localStorage.getItem("crocsians-market-player-id");
    if (!playerId) {
      playerId = window.crypto.randomUUID();
      window.localStorage.setItem("crocsians-market-player-id", playerId);
    }
    if (marketPlayerKey !== playerId) setMarketPlayerKey(playerId);
    return playerId;
  }

  async function loadMarket() {
    setMarketLoading(true);
    try {
      const response = await fetch(`/api/crocsians/market?playerId=${encodeURIComponent(marketPlayerId())}`, { cache: "no-store" });
      const data = await response.json() as MarketSnapshot & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "交易所を読み込めませんでした");
      setMarketSnapshot(data);
    } catch (error) {
      setSystemMessage(error instanceof Error ? error.message : "交易所を読み込めませんでした");
    } finally {
      setMarketLoading(false);
    }
  }

  function openMarket() {
    setHolySeeOpen(false);
    setMarketOpen(true);
    setMarketTab("browse");
    void loadMarket();
  }

  async function marketAction(body: Record<string, unknown>) {
    const response = await fetch("/api/crocsians/market", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playerId: marketPlayerId(), playerName: characterName, ...body }) });
    const data = await response.json() as { error?: string; listing?: MarketListing; gold?: number };
    if (!response.ok) throw new Error(data.error ?? "交易所の操作に失敗しました");
    return data;
  }

  function removeMarketInventory(item: MarketInventoryOption, quantity: number) {
    if (item.type === "MATERIAL") setMaterialInventory((current) => ({ ...current, [item.name]: current[item.name] - quantity }));
    else if (item.type === "WEAPON") setWeaponInventory((current) => ({ ...current, [item.name]: current[item.name] - quantity }));
    else if (item.type === "ARMOR") setArmorInventory((current) => ({ ...current, [item.name]: current[item.name] - quantity }));
    else if (item.id === 2) setCraftedItems((current) => ({ ...current, indulgence: current.indulgence - quantity }));
    else setCraftedItems((current) => ({ ...current, potion: current.potion - quantity }));
  }

  function addMarketInventory(item: Pick<MarketListing, "itemType" | "itemName" | "quantity">) {
    if (item.itemType === "MATERIAL") setMaterialInventory((current) => ({ ...current, [item.itemName]: (current[item.itemName] ?? 0) + item.quantity }));
    else if (item.itemType === "WEAPON") setWeaponInventory((current) => ({ ...current, [item.itemName]: (current[item.itemName] ?? 0) + item.quantity }));
    else if (item.itemType === "ARMOR") setArmorInventory((current) => ({ ...current, [item.itemName]: (current[item.itemName] ?? 0) + item.quantity }));
    else if (item.itemName === "免罪符") setCraftedItems((current) => ({ ...current, indulgence: current.indulgence + item.quantity }));
    else setCraftedItems((current) => ({ ...current, potion: current.potion + item.quantity }));
  }

  async function createMarketListing() {
    const item = marketInventoryOptions.find((option) => option.key === marketItemKey);
    if (!item || marketQuantity < 1 || marketQuantity > item.owned) {
      setSystemMessage("出品するアイテムと数量を確認してください");
      return;
    }
    const minimum = item.npcPrice * marketQuantity;
    if (marketPrice < minimum) {
      setSystemMessage(`出品価格はNPC買取価格${minimum}G以上にしてください`);
      return;
    }
    setMarketLoading(true);
    try {
      await marketAction({ action: "list", itemType: item.type, itemId: item.id, quantity: marketQuantity, price: marketPrice });
      removeMarketInventory(item, marketQuantity);
      setMarketItemKey("");
      setMarketQuantity(1);
      setMarketPrice(0);
      setSystemMessage(`${item.name}を交易所へ無料で出品しました`);
      await loadMarket();
    } catch (error) {
      setSystemMessage(error instanceof Error ? error.message : "出品に失敗しました");
    } finally {
      setMarketLoading(false);
    }
  }

  async function withdrawMarketListing(listing: MarketListing) {
    setMarketLoading(true);
    try {
      const data = await marketAction({ action: "withdraw", listingId: listing.id });
      if (data.listing) addMarketInventory(data.listing);
      setSystemMessage(`${listing.itemName}の出品を無料で取り下げました`);
      await loadMarket();
    } catch (error) {
      setSystemMessage(error instanceof Error ? error.message : "取り下げに失敗しました");
    } finally {
      setMarketLoading(false);
    }
  }

  async function buyMarketListing(listing: MarketListing) {
    const rate = marketSnapshot?.taxRate ?? 1.2;
    const total = Math.ceil(listing.price * rate);
    if (resources.gold < total) {
      setSystemMessage("購入に必要な所持金が足りません");
      return;
    }
    setMarketLoading(true);
    try {
      const data = await marketAction({ action: "buy", listingId: listing.id, buyerGold: resources.gold });
      if (!data.listing || data.listing.buyerPaid == null) throw new Error("購入結果が不正です");
      setResources((current) => ({ gold: current.gold - data.listing!.buyerPaid! }));
      addMarketInventory(data.listing);
      setSystemMessage(`${listing.itemName}を税込${formatNumber(data.listing.buyerPaid)}Gで購入しました`);
      await loadMarket();
    } catch (error) {
      setSystemMessage(error instanceof Error ? error.message : "購入に失敗しました");
    } finally {
      setMarketLoading(false);
    }
  }

  async function claimMarketProceeds() {
    setMarketLoading(true);
    try {
      const data = await marketAction({ action: "claim" });
      const gold = data.gold ?? 0;
      if (gold > 0) setResources((current) => ({ gold: current.gold + gold }));
      setSystemMessage(gold > 0 ? `交易所の売上${formatNumber(gold)}Gを受け取りました` : "未受取の売上はありません");
      await loadMarket();
    } catch (error) {
      setSystemMessage(error instanceof Error ? error.message : "売上を受け取れませんでした");
    } finally {
      setMarketLoading(false);
    }
  }

  function openCharacterPanel() {
    setNameDraft(characterName);
    setCharacterPanelOpen(true);
  }

  function changeCharacterName(event: FormEvent) {
    event.preventDefault();
    const nextName = nameDraft.trim().slice(0, 16);
    if (!nextName) {
      setSystemMessage("名前を入力してください");
      return;
    }
    setCharacterName(nextName);
    setNameDraft(nextName);
    setSystemMessage(`名前を${nextName}に変更しました`);
  }

  async function uploadCharacterIcon(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setSystemMessage("画像ファイルを選択してください");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSystemMessage("アイコン画像は10MB以下にしてください");
      return;
    }
    try {
      const resizedIcon = await resizeCharacterIcon(file);
      const iconBlob = await (await fetch(resizedIcon)).blob();
      const response = await fetch("/api/crocsians/icon", { method: "PUT", headers: { "content-type": iconBlob.type }, body: iconBlob });
      if (!response.ok) throw new Error("アイコンをサーバーへ保存できませんでした");
      const result = await response.json() as { url: string };
      setCharacterIcon(result.url);
      setSystemMessage("キャラクターアイコンを256×256pxでサーバーへ保存しました");
    } catch (error) {
      setSystemMessage(error instanceof Error ? error.message : "画像を処理できませんでした");
    }
  }

  async function deleteCharacterIcon() {
    try {
      const response = await fetch("/api/crocsians/icon", { method: "DELETE" });
      if (!response.ok) throw new Error("アイコンをサーバーから削除できませんでした");
      setCharacterIcon(null);
      setSystemMessage("キャラクターアイコンをサーバーから削除しました");
    } catch (error) {
      setSystemMessage(error instanceof Error ? error.message : "アイコンを削除できませんでした");
    }
  }

  async function prepareNewCharacterIcon(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) {
      setStartScreenMessage("10MB以下の画像ファイルを選択してください");
      return;
    }
    try {
      setNewCharacterIcon(await resizeCharacterIcon(file));
      setStartScreenMessage("アイコンを256×256pxに調整しました");
    } catch (error) {
      setStartScreenMessage(error instanceof Error ? error.message : "画像を処理できませんでした");
    }
  }

  function levelSkill(skill: SkillDefinition) {
    if (view === "explore") {
      setSystemMessage("スキルの習得・強化は拠点か街で行ってください");
      return;
    }
    const currentLevel = skillLevels[skill.id] ?? 0;
    if (currentLevel >= skill.maxLevel) return;
    if (skill.advanced && playerProgress.level < 20) {
      setSystemMessage("上級スキルはLv.20から習得できます");
      return;
    }
    const cost = skillPointCost(skill, currentLevel);
    if (skillPoints < cost) {
      setSystemMessage("スキルポイントが足りません");
      return;
    }
    if (skill.id === "regularCustomer" || skill.id === "marketResearch") {
      const oldRegularLevel = skillLevels.regularCustomer ?? 0;
      const oldSecretLevel = skillLevels.marketResearch ?? 0;
      const newRegularLevel = skill.id === "regularCustomer" ? currentLevel + 1 : oldRegularLevel;
      const newSecretLevel = skill.id === "marketResearch" ? currentLevel + 1 : oldSecretLevel;
      setMerchantStock((current) => adjustMerchantStockForSkills(current, oldRegularLevel, oldSecretLevel, newRegularLevel, newSecretLevel));
    }
    setJobProgress((current) => ({ ...current, [job]: { ...current[job], skillPoints: current[job].skillPoints - cost } }));
    setSkillLevels((current) => ({ ...current, [skill.id]: currentLevel + 1 }));
    setSystemMessage(`${skill.name}をLv.${currentLevel + 1}にしました`);
  }

  function resetSkills() {
    if (view === "explore") {
      setSystemMessage("スキルリセットは拠点か街で行ってください");
      return;
    }
    const jobSkillIds = new Set(jobSkills.map((skill) => skill.id));
    const refunded = Object.entries(skillLevels).reduce((total, [skillId, level]) => {
      const definition = SKILLS.find((skill) => skill.id === skillId);
      if (!jobSkillIds.has(skillId as SkillId) || !level || !definition) return total;
      return total + Array.from({ length: Math.min(level, definition.maxLevel) }, (_, currentLevel) => skillPointCost(definition, currentLevel)).reduce((sum, cost) => sum + cost, 0);
    }, 0);
    if (job === "商人") setMerchantStock((current) => adjustMerchantStockForSkills(current, skillLevels.regularCustomer ?? 0, skillLevels.marketResearch ?? 0, 0, 0));
    setSkillLevels((current) => Object.fromEntries(Object.entries(current).filter(([skillId]) => !jobSkillIds.has(skillId as SkillId))) as SkillLevels);
    setJobProgress((current) => ({ ...current, [job]: { ...current[job], skillPoints: current[job].skillPoints + refunded } }));
    setSystemMessage(`スキルをリセットし、${refunded}ポイント返却しました`);
  }

  function getSkillUseLimit(skillId: SkillId) {
    const cardinal = CARDINAL_IDS.map((id) => CARDINALS[id]).find((entry) => entry.skillId === skillId);
    if (cardinal) {
      const level = equippedCardinal === cardinal.id ? cardinalLevels[cardinal.id] ?? 0 : 0;
      if (level <= 0) return 0;
      return cardinal.id === "bread" || cardinal.id === "batrump" ? level + 2 : level;
    }
    const level = skillLevels[skillId] ?? 0;
    if (level <= 0) return 0;
    if (skillId === "falsePraise" || skillId === "autoResurrect") return level;
    if (skillId === "strongDuty" || skillId === "divineDevotion" || skillId === "safeFlee") return 5;
    return level + 2;
  }

  function cardinalLevelUpCost(level: number) {
    return 1000 * (level + 1);
  }

  function acquireOrLevelCardinal(cardinal: (typeof CARDINALS)[CardinalId]) {
    if (view === "explore") {
      setSystemMessage("探索中は枢機卿を獲得・育成できません");
      return;
    }
    const currentLevel = cardinalLevels[cardinal.id] ?? 0;
    const nextLevel = currentLevel === 0 ? 1 : currentLevel + 1;
    if (currentLevel >= CARDINAL_MAX_LEVEL) {
      setSystemMessage(`${cardinal.name}は最大レベルです`);
      return;
    }
    const cost = currentLevel === 0 ? CARDINAL_ACQUIRE_COST : cardinalLevelUpCost(currentLevel);
    if ((materialInventory[cardinal.badge] ?? 0) < cost) {
      setSystemMessage(`${cardinal.badge}が不足しています（必要 ${formatNumber(cost)}）`);
      return;
    }
    setMaterialInventory((current) => ({ ...current, [cardinal.badge]: (current[cardinal.badge] ?? 0) - cost }));
    setCardinalLevels((current) => ({ ...current, [cardinal.id]: nextLevel }));
    if (!equippedCardinal) setEquippedCardinal(cardinal.id);
    setSystemMessage(currentLevel === 0 ? `${cardinal.name}を獲得しました` : `${cardinal.name}をLv.${nextLevel}にしました`);
  }

  function getRemainingSkillUses(skillId: SkillId) {
    return Math.max(0, getSkillUseLimit(skillId) - (skillUses[skillId] ?? 0));
  }

  function getSkillUsageText(skillId: SkillId) {
    return `残り ${getRemainingSkillUses(skillId)}/${getSkillUseLimit(skillId)}`;
  }

  async function sendSessionAction(action: Record<string, unknown>) {
    const clientId = presenceClientIdRef.current;
    if (!clientId || view !== "explore") return null;
    if (statusActionBlocked && (action.action === "skill" || action.action === "heal" || action.action === "groupHeal" || action.action === "cure" || action.action === "enhancedTreasure")) {
      setBattleLog(`${statusEffect}状態のため行動できません`);
      return null;
    }
    try {
      const response = await fetch("/api/crocsians/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ map: currentMapKey, clientId, ...action }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null) as { error?: string } | null;
        const message = errorBody?.error ?? "共有探索サーバーで処理できませんでした";
        setBattleLog(message);
        setSystemMessage(message);
        return null;
      }
      return await response.json() as SharedExplorationSnapshot;
    } catch {
      setSystemMessage("共有探索サーバーとの通信に失敗しました。自動的に再接続します");
      return null;
    }
  }

  function applyImmediatePlayerSnapshot(snapshot: SharedExplorationSnapshot) {
    setConnectedPlayers(snapshot.players);
    setCurrentDungeon(snapshot.dungeon ?? null);
    setConnectedPlayersMapKey(currentMapKey);
    if (snapshot.skillUses) setSkillUses(snapshot.skillUses);
    if (snapshot.skillUsesResetAt !== undefined) setSkillUsesResetAt(snapshot.skillUsesResetAt);
    if (typeof snapshot.serverTime === "number") serverTimeOffsetRef.current = snapshot.serverTime - Date.now();
    if (snapshot.portalRates) setPortalRates({ ...INITIAL_PORTAL_RATES, ...snapshot.portalRates });
    if (snapshot.portalKeyInventory) setPortalKeyInventory({ ...INITIAL_PORTAL_KEY_INVENTORY, ...snapshot.portalKeyInventory });
    const clientId = presenceClientIdRef.current;
    const player = snapshot.players.find((entry) => entry.id === clientId);
    if (player) setHp(player.hp);
  }

  function resolveExplorationEvent() {
    if (explorationEvent?.id !== "sealedChest") return;
    void sendSessionAction({ action: "treasure" });
  }

  async function activateFalsePraise() {
    if (job !== "盗賊" || explorationEvent?.id !== "sealedChest" || getRemainingSkillUses("falsePraise") === 0) return;
    const snapshot = await sendSessionAction({ action: "enhancedTreasure" });
    if (!snapshot) return;
    applyImmediatePlayerSnapshot(snapshot);
    setBattleLog(snapshot.skillActionApplied === false ? snapshot.skillActionError ?? "嘘っぱちの賛歌を使用できませんでした" : "嘘っぱちの賛歌を発動し、宝箱報酬を1段階上昇させました");
  }

  function levelUp() {
    if (!selectedBuilding) return;
    if (selectedBuilding.level >= MAX_BUILDING_LEVEL) {
      setSystemMessage(`${BUILDINGS[selectedBuilding.kind].name}は最大レベルです`);
      return;
    }
    const recipe = buildingUpgradeCost(selectedBuilding.kind, selectedBuilding.level + 1);
    if (!recipe.every((material) => (materialInventory[material.name] ?? 0) >= material.quantity)) {
      setSystemMessage("施設の強化に必要な素材が足りません");
      return;
    }
    setMaterialInventory((current) => {
      const next = { ...current };
      recipe.forEach((material) => { next[material.name] -= material.quantity; });
      return next;
    });
    setBuildings((current) => ({ ...current, [selectedCell]: { ...selectedBuilding, level: selectedBuilding.level + 1, investedMaterials: mergeMaterialCosts(selectedBuilding.investedMaterials, recipe) } }));
    setSystemMessage(`${BUILDINGS[selectedBuilding.kind].name}をLv.${selectedBuilding.level + 1}に強化しました`);
    playSe("building");
  }

  function demolishSelectedBuilding() {
    if (!selectedBuilding) return;
    const refund = selectedBuilding.investedMaterials;
    if (refund.length > 0) {
      setMaterialInventory((current) => {
        const next = { ...current };
        refund.forEach((material) => { next[material.name] = (next[material.name] ?? 0) + material.quantity; });
        return next;
      });
    }
    setBuildings((current) => {
      const next = { ...current };
      delete next[selectedCell];
      return next;
    });
    setWeaponWorkshopOpen(false);
    setArmorWorkshopOpen(false);
    const summary = refund.length > 0 ? refund.map((material) => `${material.name}×${material.quantity}`).join("、") : "返却素材なし";
    setSystemMessage(`${BUILDINGS[selectedBuilding.kind].name}を解体しました（${summary}）`);
    playSe("building");
  }

  function navigate(target: View) {
    if (view === "explore" && target !== "explore") {
      setSystemMessage("探索中は離脱ボタンから街へ戻ってください");
      return;
    }
    if (target === "explore" && view !== "explore") {
      setView("town");
      setMapPopulations({});
      setTempleOpen(true);
      setSystemMessage("神殿で探索マップを選択してください");
      return;
    }
    if (target === "town") setTempleOpen(false);
    if (target !== "town") {
      setChurchOpen(false);
      setTrainingOpen(false);
      setHolySeeOpen(false);
    }
    setView(target);
  }

  function openTownBuilding(building: (typeof TOWN_BUILDINGS)[number]) {
    setTempleOpen(false);
    setChurchOpen(false);
    setTrainingOpen(false);
    setHolySeeOpen(false);
    setMerchantOpen(false);
    setMarketOpen(false);
    if (building.tone === "temple") {
      setMapPopulations({});
      setTempleTab("exploration");
      setTempleOpen(true);
    } else if (building.tone === "shops") setMerchantOpen(true);
    else if (building.tone === "market") openMarket();
    else if (building.tone === "guild") setChurchOpen(true);
    else if (building.tone === "training") setTrainingOpen(true);
    else if (building.tone === "holySee") setHolySeeOpen(true);
    else setSystemMessage(`${building.name}を利用できます`);
  }

  function ensurePresenceClientId() {
    let clientId = presenceClientIdRef.current;
    if (!clientId) {
      clientId = window.sessionStorage.getItem("crocsians-presence-id") ?? window.crypto.randomUUID();
      window.sessionStorage.setItem("crocsians-presence-id", clientId);
      presenceClientIdRef.current = clientId;
    }
    return clientId;
  }

  function warpToMap(map: MapDefinition) {
    setCurrentMap(map);
    setTempleOpen(false);
    setChurchOpen(false);
    setHolySeeOpen(false);
    setView("explore");
    setHp(maxHp);
    setEnemies([]);
    setExplorationEvent(null);
    setBattleActive(false);
    setStatusEffect(null);
    setReturnNotice(null);
    setEventCountdown(5);
    setEventCount(0);
    setBattleLog(`${map.name}へ到着。周辺を探索しています`);
  }

  function dungeonMap(color: PortalColor, level: DungeonLevel, storageLevel: PortalLevel, lobbyId?: string): MapDefinition {
    const colorName = PORTAL_COLORS.find((entry) => entry.id === color)?.name.replace("の転移キー", "") ?? "ダンジョン";
    return { name: `${colorName}ダンジョン Lv.${level}`, code: `dungeon:${color}:${level}${lobbyId ? `:${lobbyId}` : ""}`, level, enemyFrom: 0, enemyTo: 0, dungeon: { color, storageLevel } };
  }

  function beginDungeonLobby(color: PortalColor, level: DungeonLevel, storageLevel: PortalLevel, consumeKey: boolean, mapCode?: string) {
    if (consumeKey && (portalKeyInventory[color]?.[storageLevel] ?? 0) < 4) {
      setSystemMessage("同じ色・Lvの転移キーが4本必要です");
      return;
    }
    ensurePresenceClientId();
    const lobbyId = consumeKey ? window.crypto.randomUUID() : undefined;
    warpToMap(mapCode ? { ...dungeonMap(color, level, storageLevel), code: mapCode.replace(/^explore:/, "") } : dungeonMap(color, level, storageLevel, lobbyId));
    setBattleLog(`${DUNGEON_ENVIRONMENTS[color].name}へ繋がるPTロビーに入りました`);
  }

  async function startDungeonAttack() {
    if (!currentMap.dungeon || !isDungeonHost || dungeonStarted) return;
    const { color, storageLevel } = currentMap.dungeon;
    const owned = portalKeyInventory[color]?.[storageLevel] ?? 0;
    if (owned < 4) {
      setSystemMessage("ダンジョンアタック開始にはホストの転移キーが4本必要です");
      return;
    }
    const snapshot = await sendSessionAction({ action: "startDungeon" });
    if (snapshot) {
      applyImmediatePlayerSnapshot(snapshot);
      setSystemMessage("転移キーを4本消費し、ダンジョンアタックを開始しました");
    }
  }

  async function kickDungeonMember(playerId: string) {
    const snapshot = await sendSessionAction({ action: "kickDungeonMember", targetClientId: playerId });
    if (snapshot) applyImmediatePlayerSnapshot(snapshot);
  }

  function leaveExploration() {
    if (currentMap.dungeon && dungeonStarted) {
      setBattleLog("ダンジョンアタック中は離脱できません");
      return;
    }
    if (battleActive && !waitingForNextEvent) {
      setBattleLog("戦闘中は探索から離脱できません");
      return;
    }
    const clientId = presenceClientIdRef.current;
    if (clientId) {
      void fetch("/api/crocsians/session", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ map: currentMapKey, clientId }),
      });
    }
    setBattleActive(false);
    setEnemies([]);
    setExplorationEvent(null);
    setTempleOpen(false);
    setStatusEffect(null);
    setCurrentDungeon(null);
    setView("town");
    setReturnNotice("探索から街へ帰還しました");
    setSystemMessage("探索を離脱し、街へ帰還しました");
  }

  async function activateWarriorSkill(kind: "strike" | "sweep" | "rage" | "flurry" | "strongDuty") {
    if (job !== "戦士" || !battleActive) return;
    const skillId: SkillId = kind === "strike" ? "powerStrike" : kind === "sweep" ? "sweepingBlow" : kind === "rage" ? "rageStrike" : kind === "strongDuty" ? "strongDuty" : "flurry";
    const skillLevel = skillLevels[skillId] ?? 0;
    if (skillLevel === 0 || getRemainingSkillUses(skillId) === 0) return;
    const snapshot = await sendSessionAction({ action: "skill", skillId });
    if (!snapshot) return;
    applyImmediatePlayerSnapshot(snapshot);
    if (snapshot.skillActionApplied === false) {
      setBattleLog(snapshot.skillActionError ?? "スキルを使用できませんでした");
      return;
    }
    setBattleLog(kind === "strike" ? "強撃を発動しました" : kind === "sweep" ? "薙ぎ払いを発動しました" : kind === "rage" ? "怒りの一撃を発動しました" : kind === "strongDuty" ? "強者の務めを発動しました。単体攻撃を引き受けやすくなり、被ダメージを10%軽減します" : "無双乱撃を発動しました");
  }

  async function activateThiefSkill(kind: "safeFlee" | "thiefEye" | "criticalFoot") {
    if (job !== "盗賊" || !battleActive) return;
    const skillId: SkillId = kind === "thiefEye" ? "trapDisarm" : kind === "criticalFoot" ? "dangerSense" : "safeFlee";
    const skillLevel = skillLevels[skillId] ?? 0;
    if (skillLevel === 0 || getRemainingSkillUses(skillId) === 0) return;
    const snapshot = await sendSessionAction({ action: "skill", skillId });
    if (!snapshot) return;
    applyImmediatePlayerSnapshot(snapshot);
    if (snapshot.skillActionApplied === false) {
      setBattleLog(snapshot.skillActionError ?? "スキルを使用できませんでした");
      return;
    }
    setBattleLog(kind === "thiefEye" ? `盗人の眼力を発動しました。戦闘中の全員のレアドロップ率が${skillLevel * 4}%上昇します` : kind === "criticalFoot" ? "クリティカルフットを発動しました" : "逃げるがマシを発動しました。同じ場にいる探索者全員が逃走を試みます");
  }

  async function activateMerchantSkill(skillId: "moneyStrike" | "brightenUp") {
    if (job !== "商人" || !battleActive || getRemainingSkillUses(skillId) === 0) return;
    const level = skillLevels[skillId] ?? 0;
    const costs = [1_000, 5_000, 10_000, 30_000, 100_000];
    if (skillId === "brightenUp" && resources.gold < costs[level - 1]) {
      setBattleLog("GOLDが不足しています");
      return;
    }
    const snapshot = await sendSessionAction({ action: "skill", skillId });
    if (!snapshot) return;
    applyImmediatePlayerSnapshot(snapshot);
    if (snapshot.skillActionApplied === false) {
      setBattleLog(snapshot.skillActionError ?? "スキルを使用できませんでした");
      return;
    }
    if (skillId === "brightenUp") setResources((current) => ({ gold: Math.max(0, current.gold - costs[level - 1]) }));
    setBattleLog(skillId === "moneyStrike" ? "札束で殴るを発動しました" : `どうだ明るくなったろうを発動し、味方全員のHPを${Math.floor(playerProgress.level * level * 0.5)}回復しました`);
  }

  async function activateCardinalSkill(targetPlayerId?: string) {
    if (!equippedCardinalDefinition || equippedCardinalLevel <= 0 || !battleActive) return;
    if (getRemainingSkillUses(equippedCardinalDefinition.skillId) === 0) return;
    const snapshot = await sendSessionAction({ action: "skill", skillId: equippedCardinalDefinition.skillId, ...(targetPlayerId ? { targetPlayerId } : {}) });
    if (!snapshot) return;
    applyImmediatePlayerSnapshot(snapshot);
    if (snapshot.skillActionApplied === false) {
      setBattleLog(snapshot.skillActionError ?? "枢機卿スキルを使用できませんでした");
      return;
    }
    setBattleLog(`${equippedCardinalDefinition.skillName}を発動しました`);
  }

  function changeJob(nextJob: JobName) {
    if (view !== "town" || !churchOpen || nextJob === job) return;
    setJob(nextJob);
    setSystemMessage(`${nextJob}へジョブを変更しました。Lv・EXP・SPと実効ステータスを切り替えました`);
  }

  function buyTrainingExperience(amount: number) {
    if (view !== "town" || !trainingOpen) return;
    if (resources.gold < amount) {
      setSystemMessage("GOLDが不足しています");
      return;
    }
    const previousLevel = getPlayerProgress(activeJobProgress.experience).level;
    const experience = activeJobProgress.experience + amount;
    const gainedLevels = Math.max(0, getPlayerProgress(experience).level - previousLevel);
    setResources((current) => ({ gold: current.gold - amount }));
    setJobProgress((current) => {
      const progress = current[job];
      return { ...current, [job]: { experience: progress.experience + amount, skillPoints: progress.skillPoints + gainedLevels } };
    });
    setSystemMessage(`訓練所で${formatNumber(amount)}Gを${formatNumber(amount)}EXPに交換しました${gainedLevels > 0 ? `。Lvが${gainedLevels}上がりました` : ""}`);
  }

  async function activateDivineDevotion() {
    if (job !== "僧侶" || !battleActive) return;
    const skillId: SkillId = "divineDevotion";
    const skillLevel = skillLevels[skillId] ?? 0;
    if (skillLevel === 0 || getRemainingSkillUses(skillId) === 0) return;
    const snapshot = await sendSessionAction({ action: "skill", skillId });
    if (!snapshot) return;
    applyImmediatePlayerSnapshot(snapshot);
    if (snapshot.skillActionApplied === false) {
      setBattleLog(snapshot.skillActionError ?? "スキルを使用できませんでした");
      return;
    }
    setBattleLog("御心による献身を発動しました。自身のATKを捧げ、最もATKが高い味方へ上乗せします");
  }

  async function activatePriestSkill(kind: "heal" | "groupHeal" | "cure", targetPlayerId?: string) {
    if (job !== "僧侶") return;
    const skillId: SkillId = kind;
    const skillLevel = skillLevels[skillId] ?? 0;
    const healTarget = kind === "heal" ? healingTargets.find((player) => player.id === targetPlayerId) : undefined;
    if (skillLevel === 0 || getRemainingSkillUses(skillId) === 0 || (kind === "heal" && (!healTarget || healTarget.hp >= (healTarget.maxHp ?? 100))) || (kind === "groupHeal" && healingTargets.every((player) => player.hp >= (player.maxHp ?? 100)))) return;
    if (kind === "heal" || kind === "groupHeal") {
      const recovery = Math.floor((kind === "heal" ? PRIEST_HEAL_INITIAL_RECOVERY : PRIEST_GROUP_HEAL_INITIAL_RECOVERY) + playerProgress.level * skillLevel * (kind === "heal" ? 1 : 0.5));
      const snapshot = await sendSessionAction({ action: kind === "groupHeal" ? "groupHeal" : "heal", ...(healTarget ? { targetPlayerId: healTarget.id } : {}) });
      if (!snapshot) return;
      applyImmediatePlayerSnapshot(snapshot);
      if (snapshot.skillActionApplied === false) {
        setBattleLog(snapshot.skillActionError ?? "スキルを使用できませんでした");
        return;
      }
      setBattleLog(kind === "groupHeal" ? `グループヒールLv.${skillLevel}を発動し、味方全員のHPを${recovery}回復しました` : `ヒールLv.${skillLevel}を発動し、${healTarget?.name}のHPを${recovery}回復しました`);
    } else {
      const snapshot = await sendSessionAction({ action: "cure" });
      if (!snapshot) return;
      applyImmediatePlayerSnapshot(snapshot);
      if (snapshot.skillActionApplied === false) {
        setBattleLog(snapshot.skillActionError ?? "スキルを使用できませんでした");
        return;
      }
      setStatusEffect(null);
      setBattleLog("キュアを発動し、味方全員の状態異常を解除しました");
    }
  }

  async function sendChat(event: FormEvent) {
    event.preventDefault();
    const text = chat.trim();
    if (!text && !chatImage) return;
    const pendingImage = chatImage;
    setChat("");
    setChatImage(null);
    try {
      const body = new FormData();
      body.set("text", text);
      if (pendingImage) body.set("image", pendingImage);
      const response = await fetch("/api/crocsians/chat", { method: "POST", body });
      if (!response.ok) {
        setChat(text);
        setChatImage(pendingImage);
        const error = await response.json().catch(() => null) as { error?: string } | null;
        setSystemMessage(response.status === 429 ? "チャットの送信間隔を空けてください" : error?.error ?? "チャットを送信できませんでした");
        return;
      }
      const data = await response.json() as { message?: ChatMessage };
      if (data.message) {
        rememberChatAutoScrollIntent();
        setMessagesMapKey(chatMapKey);
        setMessages((current) => [...current.filter((message) => message.id !== data.message!.id), data.message!].slice(-100));
      }
    } catch {
      setChat(text);
      setChatImage(pendingImage);
      setSystemMessage("チャットサーバーへ接続できませんでした");
    }
  }

  function selectChatImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setSystemMessage("画像ファイルを選択してください");
    if (file.size > 15 * 1024 * 1024) return setSystemMessage("画像は15MB以下にしてください");
    setChatImage(file);
  }

  function pasteChatImage(event: React.ClipboardEvent<HTMLInputElement>) {
    const image = [...event.clipboardData.items].find((item) => item.kind === "file" && item.type.startsWith("image/"))?.getAsFile();
    if (!image) return;
    event.preventDefault();
    if (image.size > 15 * 1024 * 1024) return setSystemMessage("画像は15MB以下にしてください");
    setChatImage(image);
  }

  function renderChatMessage(message: ChatMessage) {
    const linkedGifUrl = message.text.match(/https?:\/\/[^\s<>"']+?\.gif(?:\?[^\s<>"']*)?/i)?.[0] ?? null;
    const displayImageUrl = message.imageUrl ?? linkedGifUrl;
    return <div key={message.id} className={styles.message}><span className={styles.miniAvatar}>{message.icon ? <NextImage src={message.icon} alt="" width={256} height={256} unoptimized /> : message.name.charAt(0)}</span><div><p><strong>{message.name}</strong><small>{message.job} · {new Date(message.createdAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</small></p>{message.text && <span>{message.text}</span>}{displayImageUrl ? <button type="button" className={styles.chatImageButton} onClick={() => setExpandedChatImage(displayImageUrl)}><img src={displayImageUrl} alt={`${message.name}が送信したGIFアニメーション`} /></button> : message.imageExpired ? <span className={styles.chatImageExpired}>アップロードから72時間経過したので画像を削除しました</span> : null}</div></div>;
  }

  function renderDesktopStatusPanel() {
    return <section className={styles.panelSection}><div className={styles.sectionHeading}><div><p>{view === "town" ? "TOWN STATUS" : "EXPEDITION"}</p><h3>{view === "town" ? "街の賑わい" : "探索状況"}</h3></div></div><div className={styles.activityList}>{view === "town" ? <><div><span>接続プレイヤー</span><b>{mapPlayers.length}人</b></div><div><span>現在地</span><b>イーストヘイヴン</b></div><div><span>NPC商店 更新</span><b>毎日 04:00</b></div><div><span>街施設レベル</span><b>Lv.6</b></div></> : <><div><span>現在HP</span><b>{hp} / {maxHp}</b></div><div><span>状態異常</span><b>{statusEffect ?? "なし"}</b></div><div><span>接続プレイヤー</span><b>{mapPlayers.length}人</b></div><div><span>スキル回復まで</span><b>{skillUsesResetAt === null ? "--:--" : formatRecoveryTime(skillRecoveryRemaining)}</b></div><div><span>次のイベント</span><b>{battleActive ? "戦闘終了後" : explorationEvent?.id === "sealedChest" ? `自動解錠まで${eventCountdown}秒` : explorationEvent ? "選択待ち" : `${eventCountdown}秒`}</b></div><div><span>発生イベント</span><b>{eventCount}</b></div><div><span>ポータル出現率</span><b>{portalRates[currentMap.code]?.toFixed(1) ?? PORTAL_BASE_RATE.toFixed(1)}%</b></div><div><span>探索状態</span><b>{battleActive ? `交戦中 · 残り${enemies.filter((enemy) => enemy.currentHp > 0).length}体` : explorationEvent ? explorationEvent.title : "探索中"}</b></div></>}</div>{view === "explore" && <button disabled={battleActive} className={styles.secondaryAction} onClick={leaveExploration}>{battleActive ? "戦闘中は離脱できません" : "離脱"}</button>}</section>;
  }

  function renderDesktopChatPanel() {
    return <section className={`${styles.panelSection} ${styles.chatPanel} ${styles.desktopChatPanel}`}><div className={styles.chatTabs}><button type="button" className={desktopChatTab === "chat" ? styles.chatActive : ""} onClick={() => setDesktopChatTab("chat")}>全体チャット</button><button type="button" className={desktopChatTab === "logs" ? styles.chatActive : ""} onClick={() => setDesktopChatTab("logs")}>ログ</button></div>{desktopChatTab === "chat" ? <><div ref={desktopChatMessagesRef} className={styles.messages} onScroll={(event) => { const element = event.currentTarget; chatWasAtBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight <= 1; }}>{visibleMessages.length === 0 ? <p className={styles.chatEmpty}>まだメッセージがありません</p> : visibleMessages.map(renderChatMessage)}</div><form className={styles.chatForm} onSubmit={sendChat}><label className={styles.chatImagePicker} title="画像を添付">▧<input type="file" accept="image/*" onChange={selectChatImage} /></label><input value={chat} maxLength={300} onPaste={pasteChatImage} onChange={(event) => setChat(event.target.value)} placeholder={chatImage ? `画像: ${chatImage.name}` : "メッセージを入力"} aria-label="チャットメッセージ"/><button title="送信" type="submit">➤</button></form></> : <div ref={desktopLogMessagesRef} className={styles.expeditionLogList}>{explorationLogs.length === 0 ? <p className={styles.chatEmpty}>まだログがありません</p> : [...explorationLogs].reverse().map((entry) => <article key={entry.id}><time>{new Date(entry.createdAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</time><span>{entry.message}</span></article>)}</div>}</section>;
  }

  async function consumePotion() {
    if (craftedItems.potion <= 0 || hp >= maxHp) return;
    const snapshot = await sendSessionAction({ action: "potion" });
    if (!snapshot) {
      setSystemMessage("回復薬を使用できませんでした");
      return;
    }
    setCraftedItems((value) => ({ ...value, potion: Math.max(0, value.potion - 1) }));
    applyImmediatePlayerSnapshot(snapshot);
    setBattleLog(`回復薬を使い、HPが${POTION_HEAL_AMOUNT}回復しました`);
  }

  function resetCharacterState(name: string, initialJob: JobName) {
    const initialStats = getLevelStats(1);
    setView("base");
    setResources({ ...INITIAL_RESOURCES });
    setBuildings(createInitialBuildings());
    setBaseTiles(createInitialTiles());
    setBasePanelTab("building");
    setBuildMode(null);
    setTileMode(null);
    setSelectedCell(0);
    setCraftedItems({ ...INITIAL_CRAFTED_ITEMS });
    setJobProgress(createInitialJobProgress());
    setJob(initialJob);
    setCharacterName(name);
    setNameDraft(name);
    setCharacterIcon(null);
    setSkillLevels({ ...INITIAL_SKILL_LEVELS });
    setCardinalLevels({});
    setEquippedCardinal(null);
    setEquippedWeapon(null);
    setEquippedOffhandWeapon(null);
    setEquippedArmor(null);
    setEquippedWeaponHighQuality(false);
    setEquippedOffhandWeaponHighQuality(false);
    setEquippedArmorHighQuality(false);
    setMaterialInventory({ ...INITIAL_MATERIAL_INVENTORY });
    setMaterialFavorites([]);
    setOwnedMaterialsOnly(false);
    setWeaponInventory({});
    setArmorInventory({});
    setHighQualityWeaponInventory({});
    setHighQualityArmorInventory({});
    setMerchantStock({ ...INITIAL_MERCHANT_STOCK });
    setPortalRates({ ...INITIAL_PORTAL_RATES });
    setPortalKeyInventory({ ...INITIAL_PORTAL_KEY_INVENTORY });
    const restockKey = getMerchantRestockKey(Date.now() + serverTimeOffsetRef.current);
    merchantStockRestockKeyRef.current = restockKey;
    setMerchantStockRestockKey(restockKey);
    setHp(Math.max(1, Math.floor(initialStats.hp * JOB_MODIFIERS[initialJob].hp)));
    setCurrentMap(EXPLORATION_MAPS[0]);
    setConnectedPlayers([]);
    setConnectedPlayersMapKey(null);
    setBattleActive(false);
    setEnemies([]);
    setExplorationEvent(null);
    setEventCountdown(8);
    setEventCount(0);
    setStatusEffect(null);
    setLastLoot([]);
    setMessages([]);
    setTempleOpen(false);
    setChurchOpen(false);
    setHolySeeOpen(false);
    setCharacterPanelOpen(false);
    setMaterialCatalogOpen(false);
    setWeaponWorkshopOpen(false);
    setArmorWorkshopOpen(false);
    setMerchantOpen(false);
    setHolySeeOpen(false);
    setMerchantOwnedOnly(false);
    setMarketOpen(false);
    setSystemMessage(`${name}の冒険が始まりました`);
  }

  function loadSavedCharacter() {
    if (!saveReady || !hasSave) return;
    setHp(maxHp);
    setStartScreenMode("menu");
    setGameStarted(true);
  }

  async function createNewCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = newCharacterName.trim();
    if (!name) {
      setStartScreenMessage("キャラクター名を入力してください");
      return;
    }
    const characterNameToSave = name.slice(0, 16);
    const data: CrocsiansSaveData = {
      resources: { ...INITIAL_RESOURCES }, buildings: createInitialBuildings(), baseTiles: createInitialTiles(), mapLayoutVersion: MAP_LAYOUT_VERSION, craftedItems: { ...INITIAL_CRAFTED_ITEMS },
      job: newCharacterJob, materialInventory: { ...INITIAL_MATERIAL_INVENTORY }, materialFavorites: [], weaponInventory: {}, armorInventory: {}, highQualityWeaponInventory: {}, highQualityArmorInventory: {},
      playerProgressionVersion: PLAYER_PROGRESSION_VERSION, merchantSkillResetVersion: MERCHANT_SKILL_RESET_VERSION, merchantStock: { ...INITIAL_MERCHANT_STOCK }, merchantStockVersion: MERCHANT_STOCK_VERSION, merchantStockRestockKey: getMerchantRestockKey(Date.now() + serverTimeOffsetRef.current), characterName: characterNameToSave,
      characterIcon: newCharacterIcon ? "/api/crocsians/icon" : null, jobProgress: createInitialJobProgress(), skillLevels: { ...INITIAL_SKILL_LEVELS }, cardinalLevels: {}, equippedCardinal: null, equippedWeapon: null, equippedOffhandWeapon: null, equippedArmor: null, equippedWeaponHighQuality: false, equippedOffhandWeaponHighQuality: false, equippedArmorHighQuality: false, bgmVolume, seVolume, textSize, portalRates: { ...INITIAL_PORTAL_RATES }, portalKeyInventory: { ...INITIAL_PORTAL_KEY_INVENTORY },
    };
    setSaveReady(false);
    setStartScreenMessage("アカウントへキャラクターを登録しています…");
    try {
      const response = await fetch("/api/crocsians/save", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data, iconDataUrl: newCharacterIcon }) });
      if (response.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent("/crocsians")}`);
        return;
      }
      if (!response.ok) {
        const failure = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(failure?.error || "キャラクターを登録できませんでした。時間を置いて再度お試しください");
      }
      const result = await response.json() as { merchantStockRestockKey?: string; characterIcon?: string };
      window.localStorage.removeItem("crocsians-demo-v2");
      resetCharacterState(characterNameToSave, newCharacterJob);
      if (result.merchantStockRestockKey) {
        merchantStockRestockKeyRef.current = result.merchantStockRestockKey;
        setMerchantStockRestockKey(result.merchantStockRestockKey);
      }
      if (newCharacterIcon) setCharacterIcon(result.characterIcon ?? `/api/crocsians/icon?v=${Date.now()}`);
      setNewCharacterIcon(null);
      saveLoadedRef.current = true;
      setHasSave(true);
      setSaveReady(true);
      setStartScreenMode("menu");
      setGameStarted(true);
    } catch (error) {
      setSaveReady(true);
      setStartScreenMessage(error instanceof Error ? error.message : "キャラクターを登録できませんでした。時間を置いて再度お試しください");
    }
  }

  async function deleteSavedCharacter() {
    if (deleteConfirmationText !== DELETE_CONFIRMATION_PHRASE) {
      setStartScreenMessage("指定された確認テキストを入力してください");
      return;
    }
    setSaveReady(false);
    setStartScreenMessage("アカウントのキャラクターを削除しています…");
    try {
      const response = await fetch("/api/crocsians/save", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirmationText: deleteConfirmationText }) });
      if (response.status === 401) {
        window.location.assign(`/login?next=${encodeURIComponent("/crocsians")}`);
        return;
      }
      if (response.status === 400) {
        setSaveReady(true);
        setStartScreenMessage("指定された確認テキストを入力してください");
        return;
      }
      if (!response.ok) throw new Error("character deletion failed");
      window.localStorage.removeItem("crocsians-demo-v2");
      resetCharacterState("アルマ", "戦士");
      setHasSave(false);
      setSaveReady(true);
      setNewCharacterName("");
      setNewCharacterJob("戦士");
      setNewCharacterIcon(null);
      setDeleteConfirmationText("");
      setStartScreenMode("menu");
      setStartScreenMessage("アカウントのキャラクターデータを削除しました");
    } catch {
      setSaveReady(true);
      setStartScreenMessage("キャラクターを削除できませんでした。通信状態を確認してください");
    }
  }

  const renderInventoryMaterialCard = (material: MaterialDefinition) => {
    const owned = materialInventory[material.name] ?? 0;
    const isFavorite = materialFavoriteSet.has(material.name);
    return (
      <article key={material.id} className={styles.materialCard}>
        <span className={styles.materialNumber}>No.{String(material.id).padStart(3, "0")}</span>
        <button type="button" className={`${styles.materialFavoriteButton} ${isFavorite ? styles.materialFavoriteActive : ""}`} aria-label={isFavorite ? `${material.name}のお気に入りを解除` : `${material.name}をお気に入り登録`} aria-pressed={isFavorite} title={isFavorite ? "お気に入り解除" : "お気に入り登録"} disabled={!isFavorite && owned < 1} onClick={() => toggleMaterialFavorite(material)}>{isFavorite ? "★" : "☆"}</button>
        <b className={`${styles.rarity} ${styles[`rarity${material.rarity}`]}`}>{material.rarity}</b>
        <ItemTexture kind="materials" id={material.id} name={material.name} />
        <h3>{material.name}</h3>
        <p>{material.description}</p>
        <footer><div className={styles.materialTags}><span>{material.category}</span><span>{material.uses}</span></div><div className={styles.materialTrade}><strong>所持 ×{owned} · 売値 {formatNumber(merchantSellPrice(material.sellPrice))}G</strong><button type="button" disabled={owned < 1} onClick={() => sellMaterial(material)}>1個売却</button></div></footer>
      </article>
    );
  };

  if (!gameStarted) {
    return (
      <main className={styles.startScreen} data-crocsians-page>
        <NextImage className={styles.startBackground} src="/crocsians/other/start.png" alt="大聖堂に集うクロックシアンたち" fill priority sizes="100vw" />
        <div className={styles.startShade} aria-hidden="true" />
        <header className={styles.startBrand}>
          <span>C</span>
          <div><p>CROCSIANS</p><small>FRONTIER DISTRICT 07</small></div>
        </header>

        <section className={`${styles.startPanel} ${startScreenMode === "create" ? styles.startPanelCreate : ""}`} aria-labelledby="start-screen-title">
          <div className={styles.startTitle}>
            <p>THE FRONTIER CHRONICLE</p>
            <h1 id="start-screen-title">クロックシアンズ</h1>
            <span>{startScreenMessage}</span>
          </div>

          {startScreenMode === "menu" && (
            <div className={styles.startMenu}>
              {hasSave && <div className={styles.startSaveSummary}><small>LAST CHARACTER</small><strong>{characterName}</strong><span>{job} · Lv.{playerProgress.level}</span></div>}
              <button type="button" data-se="start" className={styles.startPrimary} disabled={!saveReady || !hasSave} onClick={loadSavedCharacter}>データロード <span>LOAD DATA</span></button>
              <button type="button" onClick={() => { setStartScreenMode("create"); setStartScreenMessage("新しい冒険者を登録します"); }}>キャラクター新規作成 <span>NEW CHARACTER</span></button>
              <button type="button" className={styles.startDeleteButton} disabled={!saveReady || !hasSave} onClick={() => { setStartScreenMode("delete"); setStartScreenMessage("削除するデータを確認してください"); }}>キャラクターデリート <span>DELETE CHARACTER</span></button>
              <button type="button" className={styles.startReleaseLink} onClick={() => setReleaseNotesOpen(true)}>リリースノート <span>RELEASE NOTES</span></button>
            </div>
          )}

          {startScreenMode === "create" && (
            <form className={styles.startForm} onSubmit={createNewCharacter}>
              <div className={styles.startIdentityFields}>
                <div className={styles.startIconEditor}>
                  <div>{newCharacterIcon ? <NextImage src={newCharacterIcon} alt="新しいキャラクターアイコン" width={256} height={256} unoptimized /> : <span>{newCharacterName.trim().charAt(0) || "?"}</span>}</div>
                  <label>アイコンを選択<input type="file" accept="image/*" onChange={prepareNewCharacterIcon} /></label>
                  <small>中央を正方形に切り抜き、256×256pxで保存</small>
                  {newCharacterIcon && <button type="button" onClick={() => setNewCharacterIcon(null)}>選択を解除</button>}
                </div>
                <label className={styles.startNameField}><span>キャラクター名</span><input autoFocus value={newCharacterName} maxLength={16} placeholder="名前を入力" onChange={(event) => setNewCharacterName(event.target.value)} /><small>1～16文字で設定してください</small></label>
              </div>
              <fieldset>
                <legend>初期ジョブ</legend>
                <div className={styles.startJobs}>{JOBS.map((jobName) => { const modifiers = JOB_MODIFIERS[jobName]; return <button key={jobName} type="button" className={newCharacterJob === jobName ? styles.startJobSelected : ""} aria-pressed={newCharacterJob === jobName} onClick={() => setNewCharacterJob(jobName)}><strong>{jobName}</strong><dl><div><dt>HP</dt><dd>×{modifiers.hp.toFixed(1)}</dd></div><div><dt>ATK</dt><dd>×{modifiers.atk.toFixed(1)}</dd></div><div><dt>DEF</dt><dd>×{modifiers.def.toFixed(1)}</dd></div><div><dt>LUC</dt><dd>×{modifiers.luck.toFixed(1)}</dd></div></dl></button>; })}</div>
              </fieldset>
              {hasSave && <p className={styles.startWarning}>新規作成すると現在のキャラクターデータは上書きされます。</p>}
              <div className={styles.startFormActions}><button type="button" disabled={!saveReady} onClick={() => { setStartScreenMode("menu"); setStartScreenMessage(hasSave ? "アカウントのセーブデータが見つかりました" : "新しい冒険者を作成してください"); }}>戻る</button><button type="submit" data-se="start" className={styles.startPrimary} disabled={!saveReady}>冒険を始める</button></div>
            </form>
          )}

          {startScreenMode === "delete" && (
            <div className={styles.startDeleteConfirm}>
              <span>DELETE SAVE DATA</span>
              <h2>{characterName}</h2>
              <p>このキャラクターの拠点・所持品・ジョブ進行を削除します。削除後は元に戻せません。</p>
              <label><span>確認テキスト</span><input autoFocus value={deleteConfirmationText} placeholder={DELETE_CONFIRMATION_PHRASE} onChange={(event) => setDeleteConfirmationText(event.target.value)} /></label>
              <div className={styles.startFormActions}><button type="button" disabled={!saveReady} onClick={() => { setDeleteConfirmationText(""); setStartScreenMode("menu"); setStartScreenMessage("アカウントのセーブデータが見つかりました"); }}>キャンセル</button><button type="button" className={styles.startDanger} disabled={!saveReady || deleteConfirmationText !== DELETE_CONFIRMATION_PHRASE} onClick={() => void deleteSavedCharacter()}>完全に削除する</button></div>
            </div>
          )}
        </section>

        {releaseNotesOpen && (
          <div className={styles.startReleaseBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReleaseNotesOpen(false); }}>
            <section className={styles.releaseNotesPanel} role="dialog" aria-modal="true" aria-labelledby="release-notes-title">
              <header>
                <div><p>CROCSIANS RELEASE LOG</p><h2 id="release-notes-title">リリースノート</h2></div>
                <button type="button" aria-label="リリースノートを閉じる" onClick={() => setReleaseNotesOpen(false)}>×</button>
              </header>
              <div className={styles.releaseNotesBody}>
                {RELEASE_NOTES.map((release) => <article key={release.version}>
                  <h3>{release.version}</h3>
                  <ul>{release.items.map((item) => <li key={item.title}><strong>{item.title}</strong>{item.details.length > 0 && <ul>{item.details.map((detail) => <li key={detail}>{detail}</li>)}</ul>}</li>)}</ul>
                </article>)}
              </div>
            </section>
          </div>
        )}

      </main>
    );
  }

  return (
    <main className={`${styles.gameShell} ${textSize === "medium" ? styles.textMedium : textSize === "large" ? styles.textLarge : ""}`} data-crocsians-page>
      <header className={styles.gameHeader}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>C</span>
          <div><h1>CROCSIANS</h1></div>
        </div>
        <nav className={styles.viewTabs} aria-label="ゲーム画面">
          <button className={view === "base" ? styles.activeTab : ""} aria-disabled={view === "explore"} onClick={() => navigate("base")}><span>▦</span> 拠点</button>
          <button className={view === "town" ? styles.activeTab : ""} aria-disabled={view === "explore"} onClick={() => navigate("town")}><span>♜</span> 街</button>
          <button className={view === "explore" ? styles.activeTab : ""} onClick={() => navigate("explore")}><span>⌖</span> 探索</button>
        </nav>
        <div className={styles.profile}>
          <button className={styles.catalogTrigger} type="button" onClick={() => setMaterialCatalogOpen(true)}>◇所持品</button>
          <button className={styles.avatar} type="button" aria-label="キャラクター設定を開く" onClick={openCharacterPanel}>{characterIcon ? <NextImage src={characterIcon} alt="" width={256} height={256} unoptimized /> : characterName.charAt(0)}</button>
          <div className={styles.profileIdentity}><strong>{characterName}</strong><span>{job} Lv.{playerProgress.level}</span></div>
          <span className={styles.profileJob}>CURRENT JOB</span>
        </div>
      </header>

      <div className={styles.statusHud} aria-label="プレイヤーステータス">
        <div className={styles.statusHudCore}>
          <span><small>GOLD</small><b>{formatNumber(resources.gold)}G</b></span>
          <span><small>LEVEL</small><b>Lv.{playerProgress.level}</b></span>
          <span className={styles.statusExp}><small>EXP</small><b>{playerProgress.required > 0 ? `${formatNumber(playerProgress.current)} / ${formatNumber(playerProgress.required)}` : "MAX"}</b><i><em style={{ width: `${Math.min(100, playerProgress.required > 0 ? playerProgress.current / playerProgress.required * 100 : 100)}%` }} /></i></span>
          <span><small>HP</small><b>{hp} / {maxHp}</b></span>
          <span><small>SP</small><b>{skillPoints}</b></span>
        </div>
      </div>

      {craftOutcome && <div className={`${styles.craftOutcome} ${craftOutcome.success ? styles.craftOutcomeSuccess : styles.craftOutcomeFailure}`} role="status" aria-live="assertive"><strong>{craftOutcome.success ? "制作成功" : "制作失敗"}</strong><span>{craftOutcome.message}</span></div>}

      {inspectedPlayer && (
        <div className={styles.catalogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setInspectedPlayer(null); }}>
          <section className={styles.playerProfilePanel} role="dialog" aria-modal="true" aria-labelledby="player-profile-title">
            <header>
              <div><p>ADVENTURER PROFILE</p><h2 id="player-profile-title">{inspectedPlayer.name}</h2></div>
              <span>{inspectedPlayer.job} Lv.{inspectedPlayer.level}</span>
              <button type="button" aria-label="プレイヤー情報を閉じる" onClick={() => setInspectedPlayer(null)}>×</button>
            </header>
            <div className={styles.playerProfileContent}>
              <aside>
                <div className={styles.playerProfileIcon}>{inspectedPlayer.icon ? <NextImage src={inspectedPlayer.icon} alt={`${inspectedPlayer.name}のアイコン`} width={256} height={256} unoptimized /> : <span>{inspectedPlayer.name.charAt(0)}</span>}</div>
                <strong>{inspectedPlayer.name}</strong><small>{inspectedPlayer.job} · Lv.{inspectedPlayer.level}</small>
                <dl><div><dt>HP</dt><dd>{inspectedPlayer.hp} / {inspectedPlayer.maxHp ?? "?"}</dd></div><div><dt>ATK</dt><dd>{inspectedPlayer.atk ?? "?"}</dd></div><div><dt>DEF</dt><dd>{inspectedPlayer.def ?? "?"}</dd></div><div><dt>LUC</dt><dd>{inspectedPlayer.luck ?? "?"}</dd></div></dl>
              </aside>
              <div className={styles.playerProfileDetails}>
                <section><h3>装備</h3><div className={styles.playerEquipment}>
                  <article>{inspectedWeaponDefinition ? <NextImage src={`/crocsians/items/weapons/${inspectedWeaponDefinition.id}.png`} alt="" width={96} height={96} unoptimized /> : <span>—</span>}<div><small>WEAPON</small><strong>{inspectedPlayer.equippedWeapon ? `${inspectedPlayer.equippedWeaponHighQuality ? "★ " : ""}${inspectedPlayer.equippedWeapon}` : "装備なし"}</strong>{inspectedWeaponDefinition && <em>ATK {Math.floor(inspectedWeaponDefinition.atk * (inspectedPlayer.equippedWeaponHighQuality ? 1.25 : 1))}</em>}</div></article>
                  <article>{inspectedArmorDefinition ? <NextImage src={`/crocsians/items/armors/${inspectedArmorDefinition.id}.png`} alt="" width={96} height={96} unoptimized /> : <span>—</span>}<div><small>ARMOR</small><strong>{inspectedPlayer.equippedArmor ? `${inspectedPlayer.equippedArmorHighQuality ? "★ " : ""}${inspectedPlayer.equippedArmor}` : "装備なし"}</strong>{inspectedArmorDefinition && <em>DEF {Math.floor(inspectedArmorDefinition.def * (inspectedPlayer.equippedArmorHighQuality ? 1.25 : 1))}</em>}</div></article>
                  <article data-cardinal-color={inspectedCardinalDefinition?.color}>{inspectedCardinalDefinition ? <NextImage src={inspectedCardinalDefinition.image} alt="" width={96} height={96} unoptimized /> : <span>—</span>}<div><small>CARDINAL</small><strong>{inspectedCardinalDefinition ? inspectedCardinalDefinition.name : "装備なし"}</strong>{inspectedCardinalDefinition && <em>Lv.{inspectedPlayer.cardinalLevels?.[inspectedCardinalDefinition.id] ?? 0}</em>}</div></article>
                </div></section>
                <section><h3>習得スキル</h3>{inspectedSkills.length > 0 ? <div className={styles.playerSkillList}>{inspectedSkills.map((skill) => <article key={skill.id}><div><strong>{skill.name}{skill.advanced ? "【上級】" : ""}</strong><b>Lv.{inspectedPlayer.skillLevels?.[skill.id]}</b></div><p>{skill.description}</p><small>{skill.job}</small></article>)}</div> : <p className={styles.playerProfileEmpty}>習得済みのスキルはありません</p>}</section>
              </div>
            </div>
          </section>
        </div>
      )}

      {characterPanelOpen && (
        <div className={styles.catalogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCharacterPanelOpen(false); }}>
          <section className={styles.characterPanel} role="dialog" aria-modal="true" aria-labelledby="character-panel-title">
            <header>
              <div><p>CHARACTER MANAGEMENT</p><h2 id="character-panel-title">キャラクター設定</h2></div>
              <span>{job} Lv.{playerProgress.level}</span>
              <button type="button" aria-label="キャラクター設定を閉じる" onClick={() => setCharacterPanelOpen(false)}>×</button>
            </header>
            <div className={styles.characterContent}>
              <aside className={styles.characterIdentity}>
                <div className={styles.characterIconPreview}>{characterIcon ? <NextImage src={characterIcon} alt={`${characterName}のアイコン`} width={256} height={256} unoptimized /> : <span>{characterName.charAt(0)}</span>}</div>
                <label className={styles.iconUpload}>画像をアップロード<input type="file" accept="image/*" onChange={uploadCharacterIcon} /></label>
                <small>中央を正方形に切り抜き、256×256pxで保存します（最大10MB）</small>
                {characterIcon && <button type="button" className={styles.iconReset} onClick={() => void deleteCharacterIcon()}>デフォルトに戻す</button>}
                {job === "職人" && (skillLevels.dualWield ?? 0) > 0 && <div className={styles.dualAttackStats}><span>順手 <b>{totalAttack}</b></span><span>逆手 <b>{offhandAttack}</b></span></div>}
                <dl><div><dt>HP</dt><dd title={`基礎 ${levelStats.hp} × ${jobModifier.hp} × 枢機卿 ${cardinalHpMultiplier.toFixed(2)}`}>{maxHp}</dd></div><div><dt>ATK</dt><dd title={`(基礎 ${levelStats.atk} × ${jobModifier.atk} + 装備 ${equippedWeaponAttack}${equippedWeaponHighQuality ? "（高品質）" : ""}) × 枢機卿 ${cardinalAtkMultiplier.toFixed(2)}`}>{totalAttack}</dd></div><div><dt>DEF</dt><dd title={`(基礎 ${levelStats.def} × ${jobModifier.def} + 装備 ${equippedArmorDefense}${equippedArmorHighQuality ? "（高品質）" : ""} + スキル ${(skillLevels.defensiveStance ?? 0) * 3}) × 枢機卿 ${cardinalDefMultiplier.toFixed(2)}`}>{totalDefense}</dd></div><div><dt>LUC</dt><dd title={`基礎 ${levelStats.luck} × ${jobModifier.luck} × 枢機卿 ${cardinalLuckMultiplier.toFixed(2)}`}>{totalLuck}</dd></div><div><dt>EXP</dt><dd>{playerProgress.required > 0 ? `${formatNumber(playerProgress.current)} / ${formatNumber(playerProgress.required)}` : "MAX"}</dd></div><div><dt>SP</dt><dd>{skillPoints}</dd></div></dl>
                <form action="/logout" method="post"><button type="submit" className={styles.gameExitButton} disabled={battleActive}>{battleActive ? "戦闘中はログアウトできません" : "ログアウト"}</button></form>
              </aside>
              <div className={styles.characterEditor}>
                <section>
                  <h3>プロフィール</h3>
                  <form className={styles.nameEditor} onSubmit={changeCharacterName}><input aria-label="キャラクター名" value={nameDraft} maxLength={16} onChange={(event) => setNameDraft(event.target.value)} /><button type="submit">名前変更</button></form>
                </section>
                <section className={styles.mobileCharacterSettings}>
                  <h3>表示・サウンド設定</h3>
                  <div className={styles.characterSettingsGrid}>
                    <div className={styles.characterTextSizeControl}><span>文字サイズ</span><div>{(["small", "medium", "large"] as const).map((size, index) => <button key={size} type="button" className={textSize === size ? styles.textSizeActive : ""} aria-pressed={textSize === size} onClick={() => setTextSize(size)}>{["小", "中", "大"][index]}</button>)}</div></div>
                    <label><span>BGM</span><input aria-label="BGM音量" type="range" min="0" max="100" value={Math.round(bgmVolume * 100)} onChange={(event) => setBgmVolume(Number(event.target.value) / 100)} /><b>{Math.round(bgmVolume * 100)}%</b></label>
                    <label><span>SE</span><input aria-label="SE音量" type="range" min="0" max="100" value={Math.round(seVolume * 100)} onChange={(event) => setSeVolume(Number(event.target.value) / 100)} /><b>{Math.round(seVolume * 100)}%</b></label>
                  </div>
                </section>
                <section className={styles.desktopLayoutSettings}>
                  <h3>PC版 UI配置</h3>
                  <div className={styles.desktopLayoutSettingRow}><span>探索・ログ</span><label><input type="radio" name="expedition-panel-side" checked={expeditionPanelSide === "right"} onChange={() => setExpeditionPanelSide("right")} />右側に表示</label><label><input type="radio" name="expedition-panel-side" checked={expeditionPanelSide === "left"} onChange={() => setExpeditionPanelSide("left")} />左側に表示</label></div>
                  <div className={styles.desktopLayoutSettingRow}><span>全体チャット</span><label><input type="radio" name="chat-panel-side" checked={chatPanelSide === "right"} onChange={() => setChatPanelSide("right")} />右側に表示</label><label><input type="radio" name="chat-panel-side" checked={chatPanelSide === "left"} onChange={() => setChatPanelSide("left")} />左側に表示</label></div>
                </section>
                <section>
                  <h3>装備変更</h3>
                  <div className={styles.equipmentGrid}>
                    {job === "職人" && (skillLevels.dualWield ?? 0) > 0 && <label><span>逆手武器</span>{equippedOffhandWeaponDefinition && <ItemTexture kind="weapons" id={equippedOffhandWeaponDefinition.id} name={equippedOffhandWeaponDefinition.name} />}<select value={equippedOffhandWeapon ? `${equippedOffhandWeaponHighQuality ? "high" : "normal"}:${equippedOffhandWeapon}` : ""} onChange={(event) => { const [quality, ...nameParts] = event.target.value.split(":"); setEquippedOffhandWeapon(nameParts.join(":") || null); setEquippedOffhandWeaponHighQuality(quality === "high"); }}><option value="">装備なし</option>{WEAPONS.filter((weapon) => (weaponInventory[weapon.name] ?? 0) > (equippedWeapon === weapon.name && !equippedWeaponHighQuality ? 1 : 0)).map((weapon) => <option key={`offhand-normal-${weapon.id}`} value={`normal:${weapon.name}`}>{weapon.name}（ATK {weapon.atk}）</option>)}{WEAPONS.filter((weapon) => (highQualityWeaponInventory[weapon.name] ?? 0) > (equippedWeapon === weapon.name && equippedWeaponHighQuality ? 1 : 0)).map((weapon) => <option key={`offhand-high-${weapon.id}`} value={`high:${weapon.name}`}>★ {weapon.name}【高品質】（ATK {Math.floor(weapon.atk * 1.25)}）</option>)}</select></label>}
                    <label><span>武器</span>{equippedWeaponDefinition && <ItemTexture kind="weapons" id={equippedWeaponDefinition.id} name={equippedWeaponDefinition.name} />}<select value={equippedWeapon ? `${equippedWeaponHighQuality ? "high" : "normal"}:${equippedWeapon}` : ""} onChange={(event) => { const [quality, ...nameParts] = event.target.value.split(":"); setEquippedWeapon(nameParts.join(":") || null); setEquippedWeaponHighQuality(quality === "high"); }}><option value="">装備なし</option>{WEAPONS.filter((weapon) => (weaponInventory[weapon.name] ?? 0) > 0).map((weapon) => <option key={`normal-${weapon.id}`} value={`normal:${weapon.name}`}>{weapon.name}（ATK {weapon.atk}）</option>)}{WEAPONS.filter((weapon) => (highQualityWeaponInventory[weapon.name] ?? 0) > 0).map((weapon) => <option key={`high-${weapon.id}`} value={`high:${weapon.name}`}>★ {weapon.name}【高品質】（ATK {Math.floor(weapon.atk * 1.25)}）</option>)}</select></label>
                    <label><span>防具</span>{equippedArmorDefinition && <ItemTexture kind="armors" id={equippedArmorDefinition.id} name={equippedArmorDefinition.name} />}<select value={equippedArmor ? `${equippedArmorHighQuality ? "high" : "normal"}:${equippedArmor}` : ""} onChange={(event) => { const [quality, ...nameParts] = event.target.value.split(":"); setEquippedArmor(nameParts.join(":") || null); setEquippedArmorHighQuality(quality === "high"); }}><option value="">装備なし</option>{ARMORS.filter((armor) => (armorInventory[armor.name] ?? 0) > 0).map((armor) => <option key={`normal-${armor.id}`} value={`normal:${armor.name}`}>{armor.name}（DEF {armor.def}）</option>)}{ARMORS.filter((armor) => (highQualityArmorInventory[armor.name] ?? 0) > 0).map((armor) => <option key={`high-${armor.id}`} value={`high:${armor.name}`}>★ {armor.name}【高品質】（DEF {Math.floor(armor.def * 1.25)}）</option>)}</select></label>
                    <article className={styles.cardinalEquipmentSummary} data-cardinal-color={equippedCardinalDefinition && equippedCardinalLevel > 0 ? equippedCardinalDefinition.color : undefined}>{equippedCardinalDefinition && equippedCardinalLevel > 0 ? <NextImage src={equippedCardinalDefinition.image} alt="" width={72} height={72} unoptimized /> : <span>—</span>}<div><small>枢機卿</small><strong>{equippedCardinalDefinition && equippedCardinalLevel > 0 ? equippedCardinalDefinition.name : "装備なし"}</strong>{equippedCardinalDefinition && equippedCardinalLevel > 0 && <em>Lv.{equippedCardinalLevel}</em>}<small>変更は教皇庁で行えます</small></div></article>
                  </div>
                </section>
                <section className={styles.skillSection}>
                  <div className={styles.skillHeading}><div><h3>{job}スキル</h3><span>残りSP <b>{skillPoints}</b></span>{view === "explore" && <em>探索中は変更できません</em>}</div><button type="button" disabled={view === "explore" || !jobSkills.some((skill) => (skillLevels[skill.id] ?? 0) > 0)} onClick={resetSkills}>スキルリセット</button></div>
                  <div className={styles.skillList}>{jobSkills.map((skill) => {
                    const level = skillLevels[skill.id] ?? 0;
                    const cost = skillPointCost(skill, level);
                    const locked = Boolean(skill.advanced && playerProgress.level < 20);
                    const useLimit = getSkillUseLimit(skill.id);
                    const usageText = level > 0 && useLimit > 0 ? `${useLimit}回` : "未習得";
                    const skillMeta = locked
                      ? "Lv.20で解放 · 習得SP 3倍"
                      : skill.automatic
                        ? skill.id === "autoResurrect" ? `オート発動 · 使用上限: ${usageText}` : "パッシブスキル · オート発動"
                        : skill.active ? `探索1回の使用上限: ${usageText}` : `パッシブスキル · 現在Lv.${level}${skill.advanced ? " · 習得SP 3倍" : ""}`;
                    return <article key={skill.id}><div><strong>{skill.name}{skill.advanced ? "【上級】" : ""}</strong><b>Lv.{level}/{skill.maxLevel}</b></div><p>{skill.description}</p><small>{skillMeta}</small><button type="button" disabled={view === "explore" || locked || level >= skill.maxLevel || skillPoints < cost} onClick={() => levelSkill(skill)}>{view === "explore" ? "探索中は変更不可" : locked ? "Lv.20で解放" : level >= skill.maxLevel ? "最大レベル" : level === 0 ? `習得する（SP ${cost}）` : `レベルアップ（SP ${cost}）`}</button></article>;
                  })}</div>
                </section>
              </div>
            </div>
          </section>
        </div>
      )}

      {materialCatalogOpen && (
        <div className={styles.catalogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMaterialCatalogOpen(false); }}>
          <section className={styles.materialCatalog} role="dialog" aria-modal="true" aria-labelledby="material-catalog-title">
            <header>
              <div><p>PLAYER INVENTORY</p><h2 id="material-catalog-title">所持品</h2></div>
              <span>素材収集 {collectedMaterialCount} / {MATERIALS.length} · お気に入り {favoriteMaterialCount}</span>
              <button type="button" aria-label="所持品を閉じる" onClick={() => setMaterialCatalogOpen(false)}>×</button>
            </header>
            <nav className={styles.inventoryTabs} aria-label="所持品の種類">
              <button className={inventoryTab === "materials" ? styles.inventoryTabActive : ""} onClick={() => setInventoryTab("materials")}>素材</button>
              <button className={inventoryTab === "favorites" ? styles.inventoryTabActive : ""} onClick={() => setInventoryTab("favorites")}>お気に入り</button>
              <button className={inventoryTab === "weapons" ? styles.inventoryTabActive : ""} onClick={() => setInventoryTab("weapons")}>武器</button>
              <button className={inventoryTab === "armors" ? styles.inventoryTabActive : ""} onClick={() => setInventoryTab("armors")}>防具</button>
              <button className={inventoryTab === "supplies" ? styles.inventoryTabActive : ""} onClick={() => setInventoryTab("supplies")}>道具</button>
            </nav>
            <div className={styles.catalogFilters}>
              <input value={materialSearch} onChange={(event) => setMaterialSearch(event.target.value)} placeholder="所持品を検索" aria-label="所持品を検索" autoFocus />
              <select value={inventorySort} onChange={(event) => setInventorySort(event.target.value as ItemSort)} aria-label="所持品の並び順">
                <option value="number">No順</option><option value="owned">所持数順</option><option value="rarity">レアリティ順</option>
              </select>
              {(inventoryTab === "materials" || inventoryTab === "favorites") && <select value={materialCategory} onChange={(event) => setMaterialCategory(event.target.value)} aria-label="カテゴリで絞り込む">
                <option>すべて</option>{MATERIAL_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
              </select>}
              {(inventoryTab === "materials" || inventoryTab === "favorites") && <select value={materialRarity} onChange={(event) => setMaterialRarity(event.target.value)} aria-label="レア度で絞り込む">
                <option>すべて</option><option>N</option><option>R</option><option>SR</option><option>SSR</option>
              </select>}
              <label className={styles.ownedOnlyFilter}><input type="checkbox" checked={ownedMaterialsOnly} onChange={(event) => setOwnedMaterialsOnly(event.target.checked)} /><span>所持品のみ</span></label>
              <strong>{inventoryTab === "materials" ? filteredMaterials.length : inventoryTab === "favorites" ? filteredFavoriteMaterials.length : inventoryTab === "weapons" ? filteredInventoryWeapons.length : inventoryTab === "armors" ? filteredInventoryArmors.length : filteredSupplies.length} 件</strong>
            </div>
            <div className={styles.materialList}>
              {inventoryTab === "materials" && filteredMaterials.map(renderInventoryMaterialCard)}
              {inventoryTab === "favorites" && filteredFavoriteMaterials.map(renderInventoryMaterialCard)}
              {inventoryTab === "weapons" && filteredInventoryWeapons.map((weapon) => <article key={weapon.id} className={styles.materialCard}><span className={styles.materialNumber}>WEAPON No.{String(weapon.id).padStart(2, "0")}</span><b className={`${styles.rarity} ${styles[`rarity${weapon.rarity}`]}`}>{weapon.rarity}</b><ItemTexture kind="weapons" id={weapon.id} name={weapon.name} /><h3>{weapon.name}</h3><p>ATK {weapon.atk} · 必要工房Lv.{weapon.requiredLevel}{equippedWeapon === weapon.name ? " · 装備中" : ""}</p><footer><div className={styles.materialTags}><span>通常 ×{weaponInventory[weapon.name] ?? 0}</span><span>高品質 ×{highQualityWeaponInventory[weapon.name] ?? 0}</span></div><div className={styles.materialTrade}><strong>売値 {formatNumber(merchantSellPrice(weapon.sellPrice))}G</strong></div></footer></article>)}
              {inventoryTab === "armors" && filteredInventoryArmors.map((armor) => <article key={armor.id} className={styles.materialCard}><span className={styles.materialNumber}>ARMOR No.{String(armor.id).padStart(2, "0")}</span><b className={`${styles.rarity} ${styles[`rarity${armor.rarity}`]}`}>{armor.rarity}</b><ItemTexture kind="armors" id={armor.id} name={armor.name} /><h3>{armor.name}</h3><p>DEF {armor.def} · 必要工房Lv.{armor.requiredLevel}{equippedArmor === armor.name ? " · 装備中" : ""}</p><footer><div className={styles.materialTags}><span>通常 ×{armorInventory[armor.name] ?? 0}</span><span>高品質 ×{highQualityArmorInventory[armor.name] ?? 0}</span></div><div className={styles.materialTrade}><strong>売値 {formatNumber(merchantSellPrice(armor.sellPrice))}G</strong></div></footer></article>)}
              {inventoryTab === "supplies" && filteredSupplies.map((item) => <article key={item.id} className={styles.materialCard}><span className={styles.materialNumber}>SUPPLY No.{String(item.id).padStart(2, "0")}</span><b className={`${styles.rarity} ${styles[`rarity${item.rarity}`]}`}>{item.rarity}</b><h3>{item.name}</h3><p>{item.description}</p><footer><div className={styles.materialTags}><span>道具</span><span>{item.kindLabel ?? (item.action === "locked" ? "転移キー" : "消耗品")}</span></div><div className={styles.materialTrade}><strong>所持 ×{item.owned} · {item.action === "locked" ? "売却不可" : `売値 ${formatNumber(item.price)}G`}</strong>{item.action === "open" && <button type="button" disabled={item.owned < 1} onClick={() => openGoldSupply(item.name, item.price, () => undefined)}>開封する</button>}</div></footer></article>)}
              {((inventoryTab === "materials" && filteredMaterials.length === 0) || (inventoryTab === "favorites" && filteredFavoriteMaterials.length === 0) || (inventoryTab === "weapons" && filteredInventoryWeapons.length === 0) || (inventoryTab === "armors" && filteredInventoryArmors.length === 0) || (inventoryTab === "supplies" && filteredSupplies.length === 0)) && <p className={styles.catalogEmpty}>{inventoryTab === "favorites" ? `お気に入り登録済みの所持素材はありません。素材タブで☆を押すと登録できます。` : "条件に一致する所持品はありません。"}</p>}
            </div>
          </section>
        </div>
      )}

      {marketOpen && (
        <div className={styles.catalogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMarketOpen(false); }}>
          <section className={styles.marketPanel} role="dialog" aria-modal="true" aria-labelledby="market-title">
            <header>
              <div><p>PLAYER EXCHANGE</p><h2 id="market-title">交易所</h2></div>
              <span>Lv.{marketSnapshot?.level ?? 1} · 税率 ×{(marketSnapshot?.taxRate ?? 1.2).toFixed(2)}</span>
              <button type="button" aria-label="交易所を閉じる" onClick={() => setMarketOpen(false)}>×</button>
            </header>
            <div className={styles.marketSummary}><span>購入者支払額 = 出品価格 × 税率</span><span>出品者受取額 = 出品価格</span><button disabled={marketLoading || !marketSnapshot?.pendingGold} onClick={() => void claimMarketProceeds()}>未受取売上 {formatNumber(marketSnapshot?.pendingGold ?? 0)}Gを受け取る</button></div>
            <nav className={styles.merchantTabs} aria-label="交易所メニュー">
              <button className={marketTab === "browse" ? styles.merchantTabActive : ""} onClick={() => setMarketTab("browse")}>商品棚</button>
              <button className={marketTab === "mine" ? styles.merchantTabActive : ""} onClick={() => setMarketTab("mine")}>出品管理</button>
              <button className={marketTab === "logs" ? styles.merchantTabActive : ""} onClick={() => setMarketTab("logs")}>取引ログ</button>
              <button disabled={marketLoading} onClick={() => void loadMarket()}>更新</button>
            </nav>
            {marketTab === "browse" && <div className={styles.marketList}>
              {marketSnapshot?.listings.map((listing) => { const total = Math.ceil(listing.price * (marketSnapshot.taxRate ?? 1.2)); const own = listing.sellerId === marketPlayerKey; return <article key={listing.id}><div><small>{listing.itemType}</small><strong>{listing.itemName} ×{listing.quantity}</strong><span>出品者 {listing.sellerName}</span></div><dl><div><dt>出品価格</dt><dd>{formatNumber(listing.price)}G</dd></div><div><dt>税込価格</dt><dd>{formatNumber(total)}G</dd></div><div><dt>税金</dt><dd>{formatNumber(total - listing.price)}G</dd></div></dl><button disabled={marketLoading || own || resources.gold < total} onClick={() => void buyMarketListing(listing)}>{own ? "自分の出品" : resources.gold < total ? "所持金不足" : "購入する"}</button></article>; })}
              {!marketLoading && !marketSnapshot?.listings.length && <p className={styles.catalogEmpty}>現在出品中の商品はありません。</p>}
            </div>}
            {marketTab === "mine" && <div className={styles.marketManage}>
              <section className={styles.marketForm}>
                <h3>商品を出品</h3>
                <label>アイテム検索<input aria-label="出品アイテムを検索" value={marketItemSearch} onChange={(event) => setMarketItemSearch(event.target.value)} placeholder="アイテム名で検索" /></label>
                <label>アイテム<select aria-label="出品アイテム" value={marketItemKey} onChange={(event) => { const key = event.target.value; const item = marketInventoryOptions.find((option) => option.key === key); setMarketItemKey(key); setMarketQuantity(1); setMarketPrice(item?.npcPrice ?? 0); }}><option value="">選択してください</option>{filteredMarketInventoryOptions.map((item) => <option key={item.key} value={item.key}>{item.name}（所持 {item.owned}）</option>)}</select></label>
                <label>数量<input aria-label="出品数量" type="number" min={1} max={selectedMarketItem?.owned ?? 1} value={marketQuantity} onChange={(event) => { const quantity = Math.max(1, Math.floor(Number(event.target.value) || 1)); setMarketQuantity(quantity); if (selectedMarketItem) setMarketPrice((current) => Math.max(current, selectedMarketItem.npcPrice * quantity)); }} /></label>
                <label>出品価格<input aria-label="出品価格" type="number" min={marketMinimumPrice} value={marketPrice} onChange={(event) => setMarketPrice(Math.max(0, Math.floor(Number(event.target.value) || 0)))} /></label>
                <small>最低価格: NPC買取価格 {formatNumber(marketMinimumPrice)}G · 出品無料</small>
                <button disabled={marketLoading || !selectedMarketItem || marketQuantity > (selectedMarketItem?.owned ?? 0) || marketPrice < marketMinimumPrice} onClick={() => void createMarketListing()}>無料で出品する</button>
              </section>
              <div className={styles.marketList}>{marketSnapshot?.ownListings.map((listing) => <article key={listing.id}><div><small>{listing.status}</small><strong>{listing.itemName} ×{listing.quantity}</strong><span>{formatNumber(listing.price)}G</span></div><p>{listing.status === "SOLD" ? `${listing.buyerName ?? "購入者"}が購入済み` : listing.status === "WITHDRAWN" ? "取り下げ済み" : "商品棚に出品中"}</p>{listing.status === "ACTIVE" && <button disabled={marketLoading} onClick={() => void withdrawMarketListing(listing)}>無料で取り下げる</button>}</article>)}</div>
            </div>}
            {marketTab === "logs" && <div className={styles.marketLogs}>{marketSnapshot?.logs.map((log) => <article key={log.id}><strong>{log.itemName} ×{log.quantity}</strong><span>{log.sellerId === marketPlayerKey ? `${log.buyerName}へ売却 +${formatNumber(log.price)}G` : `${log.sellerName}から購入 -${formatNumber(log.buyerPaid)}G`}</span><small>税金 {formatNumber(log.taxAmount)}G · {formatMarketDate(log.createdAt)}</small></article>)}{!marketSnapshot?.logs.length && <p className={styles.catalogEmpty}>取引履歴はありません。</p>}</div>}
          </section>
        </div>
      )}

      {merchantOpen && (
        <div className={styles.catalogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMerchantOpen(false); }}>
          <section className={styles.merchantPanel} role="dialog" aria-modal="true" aria-labelledby="merchant-title">
            <header>
              <div><p>EASTHAVEN MERCHANT ROW</p><h2 id="merchant-title">商人街</h2></div>
              <span>所持金 <b>{formatNumber(resources.gold)}G</b>{job === "商人" && <em>商人割引 10%</em>}</span>
              <button type="button" aria-label="商人街を閉じる" onClick={() => setMerchantOpen(false)}>×</button>
            </header>
            <nav className={styles.merchantTabs} aria-label="商店を選択">
              <button className={merchantTab === "materials" ? styles.merchantTabActive : ""} onClick={() => setMerchantTab("materials")}>素材商</button>
              <button className={merchantTab === "weapons" ? styles.merchantTabActive : ""} onClick={() => setMerchantTab("weapons")}>武器買取</button>
              <button className={merchantTab === "armor" ? styles.merchantTabActive : ""} onClick={() => setMerchantTab("armor")}>防具買取</button>
              <button className={merchantTab === "supplies" ? styles.merchantTabActive : ""} onClick={() => setMerchantTab("supplies")}>道具買取</button>
            </nav>
            <div className={styles.merchantSearch}>
              <input value={merchantSearch} onChange={(event) => setMerchantSearch(event.target.value)} placeholder="商品名を検索" aria-label="商人街の商品を検索" />
              <select value={merchantSort} onChange={(event) => setMerchantSort(event.target.value as ItemSort)} aria-label="商人街商品の並び順">
                <option value="number">No順</option><option value="owned">所持数順</option><option value="rarity">レアリティ順</option>
              </select>
              {merchantTab === "materials" && <button type="button" className={merchantOwnedOnly ? styles.merchantOwnedActive : ""} aria-pressed={merchantOwnedOnly} onClick={() => setMerchantOwnedOnly((current) => !current)}>所持品のみ</button>}
              <small>購入可能: N・R素材／秘蔵品取引Lv.1でSR素材を解放（SSR素材は買取専用）</small>
            </div>
            <div className={styles.merchantList}>
              {merchantTab === "materials" && merchantMaterials.map((material) => {
                const owned = materialInventory[material.name] ?? 0;
                const buyPrice = merchantBuyPrice(material.sellPrice);
                const purchasable = canPurchaseMerchantMaterial(material);
                const stock = Math.max(0, merchantStock[material.name] ?? 0);
                const buyMax = merchantMaterialPurchaseMax(material);
                const sellMax = owned;
                const buyKey = `buy:material:${material.id}`;
                const sellKey = `sell:material:${material.id}`;
                const buyAmount = merchantTradeAmount(buyKey, buyMax);
                const sellAmount = merchantTradeAmount(sellKey, sellMax);
                return <article key={material.id} className={`${styles.merchantCard} ${styles.merchantMaterialCard}`}>
                  <div><span>No.{String(material.id).padStart(3, "0")}</span><b className={`${styles.rarity} ${styles[`rarity${material.rarity}`]}`}>{material.rarity}</b></div>
                  <ItemTexture kind="materials" id={material.id} name={material.name} />
                  <h3>{material.name}</h3><p>{material.category} · {material.uses}{!purchasable && " · 買取専用"}</p>
                  <dl><div><dt>所持</dt><dd>×{owned}</dd></div><div><dt>商人在庫</dt><dd>{purchasable ? `×${stock}` : "―"}</dd></div><div><dt>買値</dt><dd>{purchasable ? `${formatNumber(buyPrice)}G` : "―"}</dd></div><div><dt>売値</dt><dd>{formatNumber(merchantSellPrice(material.sellPrice))}G</dd></div></dl>
                  {job === "商人" && (material.rarity === "SR" || material.rarity === "SSR") && purchasable && <small>秘蔵品取引: {material.rarity}素材を取引可能</small>}
                  <div className={styles.merchantActions}>
                    {purchasable && <>
                      <div className={styles.merchantRange}><span>購入数 <b>{buyMax > 0 ? buyAmount : 0}</b> / {buyMax}</span><input type="range" min={1} max={Math.max(1, buyMax)} value={buyAmount} disabled={buyMax < 1} onChange={(event) => updateMerchantTradeAmount(buyKey, Number(event.target.value), buyMax)} /><button className={styles.merchantBuy} disabled={buyMax < 1} onClick={() => buyMaterial(material, buyAmount)}>購入</button></div>
                    </>}
                    <div className={styles.merchantRange}><span>売却数 <b>{sellMax > 0 ? sellAmount : 0}</b> / {sellMax}</span><input type="range" min={1} max={Math.max(1, sellMax)} value={sellAmount} disabled={sellMax < 1} onChange={(event) => updateMerchantTradeAmount(sellKey, Number(event.target.value), sellMax)} /><button disabled={sellMax < 1} onClick={() => sellMaterialAmount(material, sellAmount)}>売却</button></div>
                  </div>
                </article>;
              })}
              {merchantTab === "weapons" && merchantWeapons.map((weapon) => {
                const owned = weaponInventory[weapon.name] ?? 0;
                const sellMax = weaponSellableAmount(weapon);
                const sellKey = `sell:weapon:${weapon.id}`;
                const sellAmount = merchantTradeAmount(sellKey, sellMax);
                return <article key={weapon.id} className={styles.merchantCard}>
                  <div><span>No.{String(weapon.id).padStart(2, "0")}</span><b className={`${styles.rarity} ${styles[`rarity${weapon.rarity}`]}`}>{weapon.rarity}</b></div>
                  <ItemTexture kind="weapons" id={weapon.id} name={weapon.name} />
                  <h3>{weapon.name}</h3><p>ATK {weapon.atk} · 所持 ×{owned}</p>
                  <dl><div><dt>取扱</dt><dd>買取のみ</dd></div><div><dt>売値</dt><dd>{formatNumber(merchantSellPrice(weapon.sellPrice))}G</dd></div></dl>
                  <div className={styles.merchantActions}>
                    <div className={styles.merchantRange}><span>売却数 <b>{sellMax > 0 ? sellAmount : 0}</b> / {sellMax}</span><input type="range" min={1} max={Math.max(1, sellMax)} value={sellAmount} disabled={sellMax < 1} onChange={(event) => updateMerchantTradeAmount(sellKey, Number(event.target.value), sellMax)} /><button disabled={sellMax < 1} onClick={() => sellWeaponAmount(weapon, sellAmount)}>売却</button></div>
                  </div>
                </article>;
              })}
              {merchantTab === "armor" && merchantArmors.map((armor) => {
                const owned = armorInventory[armor.name] ?? 0;
                const sellMax = armorSellableAmount(armor);
                const sellKey = `sell:armor:${armor.id}`;
                const sellAmount = merchantTradeAmount(sellKey, sellMax);
                return <article key={armor.id} className={styles.merchantCard}>
                  <div><span>No.{String(armor.id).padStart(2, "0")}</span><b className={`${styles.rarity} ${styles[`rarity${armor.rarity}`]}`}>{armor.rarity}</b></div>
                  <ItemTexture kind="armors" id={armor.id} name={armor.name} />
                  <h3>{armor.name}</h3><p>DEF {armor.def} · 所持 ×{owned}</p>
                  <dl><div><dt>取扱</dt><dd>買取のみ</dd></div><div><dt>売値</dt><dd>{formatNumber(merchantSellPrice(armor.sellPrice))}G</dd></div></dl>
                  <div className={styles.merchantActions}>
                    <div className={styles.merchantRange}><span>売却数 <b>{sellMax > 0 ? sellAmount : 0}</b> / {sellMax}</span><input type="range" min={1} max={Math.max(1, sellMax)} value={sellAmount} disabled={sellMax < 1} onChange={(event) => updateMerchantTradeAmount(sellKey, Number(event.target.value), sellMax)} /><button disabled={sellMax < 1} onClick={() => sellArmorAmount(armor, sellAmount)}>売却</button></div>
                  </div>
                </article>;
              })}
              {merchantTab === "supplies" && merchantSupplies.map((item) => {
                const sellMax = item.owned;
                const sellKey = `sell:supply:${item.id}`;
                const sellAmount = merchantTradeAmount(sellKey, sellMax);
                return <article key={item.id} className={styles.merchantCard}>
                  <div><span>GENERAL GOODS</span><b className={`${styles.rarity} ${styles[`rarity${item.rarity}`]}`}>{item.rarity}</b></div>
                  <h3>{item.name}</h3><p>{item.description} · 所持 ×{item.owned}</p>
                  <dl><div><dt>取扱</dt><dd>買取のみ</dd></div><div><dt>売値</dt><dd>{formatNumber(item.price)}G</dd></div></dl>
                  <div className={styles.merchantActions}>
                    <div className={styles.merchantRange}><span>売却数 <b>{sellMax > 0 ? sellAmount : 0}</b> / {sellMax}</span><input type="range" min={1} max={Math.max(1, sellMax)} value={sellAmount} disabled={sellMax < 1} onChange={(event) => updateMerchantTradeAmount(sellKey, Number(event.target.value), sellMax)} />{item.action === "sell" && <button disabled={sellMax < 1} onClick={() => sellPotionAmount(sellAmount)}>売却</button>}{item.action === "sellIndulgence" && <button disabled={sellMax < 1} onClick={() => sellIndulgenceAmount(sellAmount)}>売却</button>}</div>
                  </div>
                </article>;
              })}
              {((merchantTab === "materials" && merchantMaterials.length === 0) || (merchantTab === "weapons" && merchantWeapons.length === 0) || (merchantTab === "armor" && merchantArmors.length === 0) || (merchantTab === "supplies" && merchantSupplies.length === 0)) && <p className={styles.catalogEmpty}>条件に一致する商品はありません。</p>}
            </div>
          </section>
        </div>
      )}

      {weaponWorkshopOpen && selectedBuilding?.kind === "weapon" && (
        <div className={styles.catalogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setWeaponWorkshopOpen(false); }}>
          <section className={styles.weaponWorkshop} role="dialog" aria-modal="true" aria-labelledby="weapon-workshop-title">
            <header>
              <div><p>WEAPON CRAFT</p><h2 id="weapon-workshop-title">武器工房レシピ</h2></div>
              <span>工房 Lv.{selectedBuilding.level} · 解放 {unlockedWeaponCount}/{WEAPONS.length}</span>
              <button type="button" aria-label="武器工房を閉じる" onClick={() => setWeaponWorkshopOpen(false)}>×</button>
            </header>
            <div className={styles.weaponLevelGuide}><span>N <b>Lv.1</b></span><span>R <b>Lv.2</b></span><span>SR <b>Lv.3</b></span><span>SSR <b>Lv.4</b></span></div>
            <div className={styles.weaponList}>
              {WEAPONS.map((weapon) => {
                const unlocked = selectedBuilding.level >= weapon.requiredLevel;
                const craftable = canCraftWeapon(weapon);
                const materialCosts = getCraftMaterialCosts(weapon.materials);
                const highQualityOwned = highQualityWeaponInventory[weapon.name] ?? 0;
                return <article key={weapon.id} className={`${styles.weaponCard} ${!unlocked ? styles.weaponLocked : ""}`}>
                  <div className={styles.weaponCardHead}><span>No.{String(weapon.id).padStart(2, "0")}</span><b className={`${styles.rarity} ${styles[`rarity${weapon.rarity}`]}`}>{weapon.rarity}</b></div>
                  <ItemTexture kind="weapons" id={weapon.id} name={weapon.name} />
                  <h3>{weapon.name}</h3>
                  <div className={styles.weaponStats}><strong>ATK {weapon.atk}</strong><span>通常 ×{weaponInventory[weapon.name] ?? 0} · 高品質 ×{highQualityOwned}</span></div>
                  <div className={styles.craftRate}><span>制作成功率</span><b>{craftingSuccessRate("weapon")}%</b></div>
                  <ul>{materialCosts.map((material) => { const owned = materialInventory[material.name] ?? 0; return <li key={material.name} className={owned < material.quantity ? styles.materialShortage : ""}><span>{material.name} ×{material.quantity}</span><small>{owned}/{material.quantity}</small></li>; })}</ul>
                  <div className={styles.armorActions}><button type="button" disabled={!craftable} onClick={() => craftWeapon(weapon)}>{!unlocked ? `工房Lv.${weapon.requiredLevel}で解放` : craftable ? "製作する" : "素材不足"}</button><button type="button" disabled={(weaponInventory[weapon.name] ?? 0) < 1} onClick={() => sellWeapon(weapon)}>1個売却</button></div>
                </article>;
              })}
            </div>
          </section>
        </div>
      )}

      {armorWorkshopOpen && selectedBuilding?.kind === "armor" && (
        <div className={styles.catalogBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setArmorWorkshopOpen(false); }}>
          <section className={styles.weaponWorkshop} role="dialog" aria-modal="true" aria-labelledby="armor-workshop-title">
            <header>
              <div><p>ARMOR CRAFT</p><h2 id="armor-workshop-title">防具工房レシピ</h2></div>
              <span>工房 Lv.{selectedBuilding.level} · 解放 {unlockedArmorCount}/{ARMORS.length}</span>
              <button type="button" aria-label="防具工房を閉じる" onClick={() => setArmorWorkshopOpen(false)}>×</button>
            </header>
            <div className={styles.weaponLevelGuide}><span>N <b>Lv.1</b></span><span>R <b>Lv.2</b></span><span>SR <b>Lv.3</b></span><span>SSR <b>Lv.4</b></span></div>
            <div className={styles.weaponList}>
              {ARMORS.map((armor) => {
                const unlocked = selectedBuilding.level >= armor.requiredLevel;
                const craftable = canCraftArmor(armor);
                const owned = armorInventory[armor.name] ?? 0;
                const materialCosts = getCraftMaterialCosts(armor.materials);
                const highQualityOwned = highQualityArmorInventory[armor.name] ?? 0;
                return <article key={armor.id} className={`${styles.weaponCard} ${!unlocked ? styles.weaponLocked : ""}`}>
                  <div className={styles.weaponCardHead}><span>No.{String(armor.id).padStart(2, "0")}</span><b className={`${styles.rarity} ${styles[`rarity${armor.rarity}`]}`}>{armor.rarity}</b></div>
                  <ItemTexture kind="armors" id={armor.id} name={armor.name} />
                  <h3>{armor.name}</h3>
                  <div className={styles.weaponStats}><strong>DEF {armor.def}</strong><span>通常 ×{owned} · 高品質 ×{highQualityOwned}</span></div>
                  <div className={styles.craftRate}><span>制作成功率</span><b>{craftingSuccessRate("armor")}%</b></div>
                  <ul>{materialCosts.map((material) => { const materialOwned = materialInventory[material.name] ?? 0; return <li key={material.name} className={materialOwned < material.quantity ? styles.materialShortage : ""}><span>{material.name} ×{material.quantity}</span><small>{materialOwned}/{material.quantity}</small></li>; })}</ul>
                  <div className={styles.armorActions}><button type="button" disabled={!craftable} onClick={() => craftArmor(armor)}>{!unlocked ? `工房Lv.${armor.requiredLevel}で解放` : craftable ? "製作する" : "素材不足"}</button><button type="button" disabled={owned < 1} onClick={() => sellArmor(armor)}>1個売却</button></div>
                </article>;
              })}
            </div>
          </section>
        </div>
      )}

      <div className={`${styles.workspace} ${expeditionPanelSide === "left" || chatPanelSide === "left" ? styles.workspaceHasLeft : ""} ${view === "base" || expeditionPanelSide === "right" || chatPanelSide === "right" ? styles.workspaceHasRight : ""} ${view !== "base" && expeditionPanelSide === "left" && chatPanelSide === "right" ? styles.compactLeftPanel : ""} ${view !== "base" && expeditionPanelSide === "right" && chatPanelSide === "left" ? styles.compactRightPanel : ""}`}>
        {(expeditionPanelSide === "left" || chatPanelSide === "left") && <aside className={`${styles.sidePanel} ${styles.leftSidePanel} ${(view === "base" || expeditionPanelSide === "right" || chatPanelSide === "right") ? styles.singleSidePanel : ""}`}>{view !== "base" && expeditionPanelSide === "left" && renderDesktopStatusPanel()}{chatPanelSide === "left" && renderDesktopChatPanel()}</aside>}
        <section className={`${styles.mainStage} ${view === "explore" ? styles.exploringStage : ""}`}>
          <div className={styles.stageTitle}>
            <div><p>{view === "base" ? "MY FRONTIER" : view === "town" ? "COMMON DISTRICT" : `EXPEDITION · ${currentMap.code}`}</p><h2>{view === "base" ? `${characterName}の拠点` : view === "town" ? "イーストヘイヴン" : currentMap.name}</h2></div>
            <div className={styles.stageMeta}>
              {view === "base" && <div className={styles.mapTools}><span>表示 <b>{Math.round(zoom * 100)}%</b></span><span>建物 <b>{Object.keys(buildings).length}/{MAP_CELL_COUNT / (FACILITY_SIZE * FACILITY_SIZE)}</b></span><button title="縮小" onClick={() => changeMapZoom(zoom - .1)}>−</button><button title="拡大" onClick={() => changeMapZoom(zoom + .1)}>＋</button></div>}
              {view === "explore" && <div className={styles.exploreMeta}><span>推奨 Lv.{currentMap.level}</span><span>接続プレイヤー {mapPlayers.length}人</span><span>イベント {eventCount}</span><button disabled={battleActive} onClick={leaveExploration}>{battleActive ? "交戦中" : "離脱"}</button></div>}
              <div className={styles.skillRecovery}><small>スキル回復まで</small><b>{skillUsesResetAt === null ? "--:--" : formatRecoveryTime(skillRecoveryRemaining)}</b></div>
            </div>
          </div>

          {view === "base" && (
            <div ref={mapViewportRef} className={styles.mapViewport} onTouchStart={beginMapTouch} onTouchMove={moveMapTouch} onTouchEnd={finishMapTouch} onTouchCancel={finishMapTouch}>
              <div className={styles.mapCanvas} style={{ width: MAP_PIXEL_SIZE * zoom, height: MAP_PIXEL_SIZE * zoom }}>
                <div className={`${styles.mapGrid} ${basePanelTab === "tile" ? styles.tileEditing : ""}`} style={{ zoom, gridTemplateColumns: `repeat(${MAP_SIZE}, ${MAP_CELL_SIZE}px)`, gridTemplateRows: `repeat(${MAP_SIZE}, ${MAP_CELL_SIZE}px)`, gridAutoColumns: `${MAP_CELL_SIZE}px`, gridAutoRows: `${MAP_CELL_SIZE}px` } as React.CSSProperties} onPointerDown={beginTileDrag} onPointerMove={moveTileDrag} onPointerUp={finishTileDrag} onPointerCancel={cancelTileDrag} onContextMenu={(event) => { if (basePanelTab === "tile") event.preventDefault(); }}>
                  {baseTiles.map((tile, cell) => <span key={`floor-${cell}`} className={styles.floorTile} style={{ gridColumn: cell % MAP_SIZE + 1, gridRow: Math.floor(cell / MAP_SIZE) + 1, backgroundImage: `url("/crocsians/base/tile/${TILES[tile].image}")` }} />)}
                  {Array.from({ length: MAP_CELL_COUNT }, (_, cell) => {
                    const occupiedAnchor = buildingAnchorAtCell(buildings, cell);
                    if (occupiedAnchor !== undefined && occupiedAnchor !== cell) return null;
                    const building = buildings[cell];
                    const placeable = basePanelTab === "building" && buildMode ? canPlaceFacility(buildings, cell) : false;
                    const column = cell % MAP_SIZE + 1;
                    const row = Math.floor(cell / MAP_SIZE) + 1;
                    return <button key={cell} data-se="none" style={{ gridColumn: `${column} / span ${building ? FACILITY_SIZE : 1}`, gridRow: `${row} / span ${building ? FACILITY_SIZE : 1}` }} aria-label={building ? `${BUILDINGS[building.kind].name}（2×2）` : `空きマス ${column},${row}`} className={`${styles.mapCell} ${building ? styles.facilityCell : ""} ${basePanelTab === "building" && selectedCell === cell ? styles.selectedCell : ""} ${placeable ? styles.buildable : ""}`} onClick={() => placeBuilding(cell)}>
                      {building ? <><span className={styles.buildingIcon}><NextImage src={buildingImagePath(building.kind, building.level)} alt={BUILDINGS[building.kind].name} width={256} height={256} unoptimized /></span><small>Lv.{building.level}</small>{building.ready && (building.kind === "furnace" || !CRAFTING_KINDS.has(building.kind)) ? <i className={styles.ready}>!</i> : !CRAFTING_KINDS.has(building.kind) ? <i className={styles.progress} style={{ "--progress": `${stockProgress(building)}%` } as React.CSSProperties} /> : null}</> : null}
                    </button>;
                  })}
                  {basePanelTab === "tile" && baseTiles.map((tile, cell) => <button key={`tile-${cell}`} data-se="none" type="button" className={`${styles.tileCell} ${selectedCell === cell || selectedTileCells.has(cell) ? styles.selectedTileCell : ""}`} style={{ gridColumn: cell % MAP_SIZE + 1, gridRow: Math.floor(cell / MAP_SIZE) + 1 }} aria-label={`${TILES[tile].name}の床 ${cell % MAP_SIZE + 1},${Math.floor(cell / MAP_SIZE) + 1}`} />)}
                </div>
              </div>
              <div className={styles.mapLegend}><span><i className={styles.legendReady} />回収可能 {completed}</span>{tileDragSelection && <span>選択範囲 {tileRectangleCells(tileDragSelection.start, tileDragSelection.end).width} × {tileRectangleCells(tileDragSelection.start, tileDragSelection.end).height}</span>}<span>{MAP_SIZE} × {MAP_SIZE} · 施設 2 × 2</span></div>
            </div>
          )}

          {view === "town" && (
            <div className={styles.townView}>
              {returnNotice && <div className={styles.returnNotice}><strong>帰還報告</strong><span>{returnNotice}</span><button title="閉じる" onClick={() => setReturnNotice(null)}>×</button></div>}
              {TOWN_BUILDINGS.map((building, index) => <button key={building.name} className={`${styles.townBuilding} ${styles[building.tone]}`} style={{ "--col": index % 3, "--row": Math.floor(index / 3) } as React.CSSProperties} onClick={() => openTownBuilding(building)}><span>{building.icon}</span><strong>{building.name}</strong><small>{building.sub}</small></button>)}
              <div className={styles.townPeople}>{mapPlayers.map((player, index) => <i key={player.id} style={{ left: `${22 + (index % 4) * 18}%`, top: `${35 + Math.floor(index / 4) * 17}%` }}>{player.name}</i>)}</div>
              {templeOpen && <div className={styles.templeDialog}>
                <div><p>STARWAY TEMPLE</p><h3>{templeTab === "exploration" ? "探索マップを選択" : templeTab === "dungeon" ? "ダンジョンPT募集" : "パーティ参加"}</h3></div>
                <nav className={styles.templeTabs} aria-label="神殿メニュー">
                  <button type="button" className={templeTab === "exploration" ? styles.templeTabActive : ""} onClick={() => setTempleTab("exploration")}>探索</button>
                  <button type="button" className={templeTab === "dungeon" ? styles.templeTabActive : ""} onClick={() => setTempleTab("dungeon")}>ダンジョン</button>
                  <button type="button" className={templeTab === "party" ? styles.templeTabActive : ""} onClick={() => setTempleTab("party")}>パーティ参加</button>
                </nav>
                {templeTab === "exploration" ? EXPLORATION_MAPS.map((map) => <button key={map.code} onClick={() => warpToMap(map)}><span>推奨 Lv.{map.level} · 接続 {mapPopulations[map.code] === undefined ? "確認中" : `${mapPopulations[map.code]}人`}</span><strong>{map.name}</strong><small>{map.code} · 敵No.{map.enemyFrom}〜{map.enemyTo} · キーLv{DISPLAY_PORTAL_LEVELS[MAP_PORTAL_LEVELS[map.code]]} · ポータル {portalRates[map.code]?.toFixed(1) ?? PORTAL_BASE_RATE.toFixed(1)}%</small><b>ワープ</b></button>) : templeTab === "dungeon" ? <div className={styles.dungeonPortalList}>{PORTAL_COLORS.map((color) => <article key={color.id} className={`${styles.dungeonPortalCard} ${styles[`portal${color.tone}`]}`}><span>{color.name.replace("の転移キー", "")}</span><h4>{color.name.replace("キー", "ダンジョン")}</h4><dl>{DUNGEON_STORAGE_LEVELS.map((storageLevel, index) => { const level = DUNGEON_LEVELS[index]; const owned = portalKeyInventory[color.id]?.[storageLevel] ?? 0; return <div key={storageLevel}><dt>Lv{level}</dt><dd>×{owned}</dd><button type="button" disabled={owned < 4} onClick={() => beginDungeonLobby(color.id, level, storageLevel, true)}>募集</button></div>; })}</dl></article>)}</div> : <div className={styles.dungeonPortalList}>{dungeonParties.map((party) => { const color = PORTAL_COLORS.find((entry) => entry.id === party.color); const storageLevel = DUNGEON_STORAGE_LEVELS[DUNGEON_LEVELS.indexOf(party.level)]; return <article key={party.map} className={`${styles.dungeonPortalCard} ${color ? styles[`portal${color.tone}`] : ""}`}><span>{party.hostName}</span><h4>{color?.name.replace("キー", "ダンジョン") ?? "ダンジョン"} Lv.{party.level}</h4><dl><div><dt>PT</dt><dd>{party.memberCount}/{party.maxMembers}</dd></div></dl><button type="button" disabled={party.memberCount >= party.maxMembers} onClick={() => beginDungeonLobby(party.color, party.level, storageLevel, false, party.map)}>参加</button></article>; })}{dungeonParties.length === 0 && <p className={styles.catalogEmpty}>募集中のPTはありません。</p>}</div>}
                <button className={styles.templeClose} onClick={() => setTempleOpen(false)}>閉じる</button>
              </div>}
              {holySeeOpen && <div className={styles.holySeeDialog}><div><p>THE HOLY SEE · CARDINAL ARMORY</p><h3>教皇庁</h3><small>色バッジで枢機卿を獲得・育成し、装備を変更できます</small></div><div className={styles.cardinalList}>{CARDINAL_IDS.map((id) => { const cardinal = CARDINALS[id]; const level = cardinalLevels[id] ?? 0; const owned = materialInventory[cardinal.badge] ?? 0; const cost = level === 0 ? CARDINAL_ACQUIRE_COST : cardinalLevelUpCost(level); const maxed = level >= CARDINAL_MAX_LEVEL; return <article key={id} className={equippedCardinal === id ? styles.cardinalEquipped : ""}><NextImage src={cardinal.image} alt="" width={160} height={160} unoptimized /><span>{cardinal.badge} · 所持 {formatNumber(owned)}</span><h4>{cardinal.name}</h4><p>{cardinal.skillName}: {cardinal.description}</p><dl><div><dt>Lv</dt><dd>{level || "未獲得"}</dd></div><div><dt>HP</dt><dd>+{Math.round(cardinal.hp * level * 100)}%</dd></div><div><dt>ATK</dt><dd>+{Math.round(cardinal.atk * level * 100)}%</dd></div><div><dt>DEF</dt><dd>+{Math.round(cardinal.def * level * 100)}%</dd></div>{cardinal.luck > 0 && <div><dt>LUC</dt><dd>+{Math.round(cardinal.luck * level * 100)}%</dd></div>}{cardinal.statusResist > 0 && <div><dt>異常無効</dt><dd>+{Math.round(cardinal.statusResist * level * 100)}%</dd></div>}{cardinal.accuracy > 0 && <div><dt>命中</dt><dd>+{Math.round(cardinal.accuracy * level * 100)}%</dd></div>}</dl><button type="button" disabled={maxed || owned < cost} onClick={() => acquireOrLevelCardinal(cardinal)}>{maxed ? "最大レベル" : level === 0 ? `獲得する（${formatNumber(cost)}）` : `Lv.${level + 1}へ強化（${formatNumber(cost)}）`}</button>{level > 0 && <button type="button" className={styles.cardinalEquipButton} onClick={() => setEquippedCardinal(equippedCardinal === id ? null : id)}>{equippedCardinal === id ? "装備を解除" : "装備する"}</button>}</article>; })}</div><button type="button" className={styles.holySeeClose} onClick={() => setHolySeeOpen(false)}>閉じる</button></div>}
              {churchOpen && <div className={styles.churchDialog}><div><p>CHURCH · JOB SANCTUARY</p><h3>ジョブを変更</h3><small>各ジョブのLv・EXP・SPは個別に保持されます</small></div><div className={styles.churchJobs}>{JOBS.map((jobName) => { const progress = getPlayerProgress(jobProgress[jobName].experience); const base = getLevelStats(progress.level); const modifier = JOB_MODIFIERS[jobName]; const previewHp = Math.floor(base.hp * modifier.hp); const previewAtk = Math.floor(base.atk * modifier.atk + equippedWeaponAttack); const previewDef = Math.floor(base.def * modifier.def + equippedArmorDefense + (jobName === "戦士" ? (skillLevels.defensiveStance ?? 0) * 3 : 0)); const previewLuck = Math.floor(base.luck * modifier.luck); return <article key={jobName} className={jobName === job ? styles.churchCurrent : ""}><span>{jobName === job ? "CURRENT" : "JOB"}</span><h4>{jobName}</h4><p>Lv.{progress.level} · EXP {progress.required > 0 ? `${formatNumber(progress.current)}/${formatNumber(progress.required)}` : "MAX"} · SP {jobProgress[jobName].skillPoints}</p><dl><div><dt>HP</dt><dd>{previewHp}</dd></div><div><dt>ATK</dt><dd>{previewAtk}</dd></div><div><dt>DEF</dt><dd>{previewDef}</dd></div><div><dt>LUC</dt><dd>{previewLuck}</dd></div></dl><button type="button" disabled={jobName === job} onClick={() => changeJob(jobName)}>{jobName === job ? "現在のジョブ" : "このジョブに変更"}</button></article>; })}</div><button type="button" className={styles.churchClose} onClick={() => setChurchOpen(false)}>閉じる</button></div>}
              {trainingOpen && <div className={styles.trainingDialog}><div><p>TRAINING HALL · EXP EXCHANGE</p><h3>訓練所</h3><small>GOLDとEXPを1:1で交換します。獲得EXPは現在のジョブに加算されます</small></div><div className={styles.trainingStatus}><span>現在のジョブ <b>{job}</b></span><span>Lv.{playerProgress.level} · EXP {playerProgress.required > 0 ? `${formatNumber(playerProgress.current)}/${formatNumber(playerProgress.required)}` : "MAX"}</span><span>所持金 <b>{formatNumber(resources.gold)}G</b></span></div><div className={styles.trainingOptions}>{TRAINING_GOLD_OPTIONS.map((amount) => { const preview = getPlayerProgress(activeJobProgress.experience + amount); const gainedLevels = Math.max(0, preview.level - playerProgress.level); return <button key={amount} type="button" disabled={resources.gold < amount} onClick={() => buyTrainingExperience(amount)}><span>{formatNumber(amount)}G</span><strong>{formatNumber(amount)}EXP</strong><small>{resources.gold < amount ? "GOLD不足" : gainedLevels > 0 ? `Lv.${preview.level}へ上昇 · SP +${gainedLevels}` : "現在のLv内で成長"}</small></button>; })}</div><button type="button" className={styles.trainingClose} onClick={() => setTrainingOpen(false)}>閉じる</button></div>}
            </div>
          )}

          {view === "explore" && (
            <div className={styles.exploreView}>
              <div className={`${styles.eventClock} ${battleActive || (explorationEvent && explorationEvent.id !== "sealedChest") ? styles.clockPaused : ""}`}>
                <span>{waitingForNextEvent ? "待機中 · 次のイベントから参加" : battleActive ? "戦闘中 · イベント進行停止" : explorationEvent?.id === "sealedChest" ? "LUC最高プレイヤーの自動解錠まで" : explorationEvent ? "イベント選択待ち" : "NEXT EVENT"}</span>
                <strong>{battleActive || (explorationEvent && explorationEvent.id !== "sealedChest") ? "--" : `${eventCountdown}秒`}</strong>
                <i><b style={{ width: battleActive || (explorationEvent && explorationEvent.id !== "sealedChest") ? "100%" : `${Math.max(0, (eventCountdown / (explorationEvent?.id === "sealedChest" ? 10 : 11)) * 100)}%` }} /></i>
              </div>
              <div ref={partyStripRef} className={`${styles.partyStrip} ${partyStripScrollable ? styles.partyStripScrollable : ""}`}>
                {mapPlayers.map((player) => {
                  const isOtherPlayer = player.id !== "local" && player.id !== presenceClientIdRef.current;
                  const statusClass = player.statusEffect === "麻痺" ? styles.partyStatusParalysis : player.statusEffect === "凍結" ? styles.partyStatusFrozen : player.statusEffect === "魅了" ? styles.partyStatusCharm : player.statusEffect === "火傷" ? styles.partyStatusBurn : "";
                  const statusLabel = player.statusEffect ? `${player.statusEffect} · ` : "";
                  return <div key={player.id} className={`${styles.partyMember} ${statusClass} ${player.waiting ? styles.partyWaiting : ""} ${flashingPlayerIds.has(player.id) ? styles.partyMemberHit : ""}`} title={player.statusEffect ? `${player.name}: ${player.statusEffect}` : undefined}>{isOtherPlayer ? <button type="button" className={styles.partyAvatarButton} aria-label={`${player.name}の詳細を見る`} onClick={() => setInspectedPlayer(player)}>{player.icon ? <NextImage src={player.icon} alt="" width={256} height={256} unoptimized /> : player.name.charAt(0)}</button> : <span>{player.icon ? <NextImage src={player.icon} alt="" width={256} height={256} unoptimized /> : player.name.charAt(0)}</span>}<div><strong>{player.name}</strong><small>{statusLabel}{player.waiting ? "次イベントまで待機中" : `${player.job} Lv.${player.level}`}</small><i><b style={{ width: `${Math.max(0, player.hp / (player.maxHp ?? 100) * 100)}%` }} /></i></div>{currentMap.dungeon && isDungeonHost && !dungeonStarted && isOtherPlayer && <button type="button" onClick={() => void kickDungeonMember(player.id)}>除外</button>}</div>;
                })}
              </div>
              <div className={styles.battlefield} style={(currentDungeonEnvironment ? EXPLORATION_BACKGROUNDS[currentDungeonEnvironment.code] : EXPLORATION_BACKGROUNDS[currentMap.code]) ? { "--exploration-bg": `url("${currentDungeonEnvironment ? EXPLORATION_BACKGROUNDS[currentDungeonEnvironment.code] : EXPLORATION_BACKGROUNDS[currentMap.code]}")` } as React.CSSProperties : undefined}>
                <div className={styles.distantRuins}>{currentMap.code}</div>
                {currentDungeon?.returnRemaining !== null && currentDungeon?.returnRemaining !== undefined && <div className={styles.explorationWaiting}><span>⌛</span><strong>{currentDungeon.returnRemaining}秒後に街へ帰還</strong><small>ボス撃破報酬を配布しました</small></div>}
                {waitingForNextEvent && <div className={styles.explorationWaiting}><span>⌛</span><strong>現在のイベント終了まで待機中</strong><small>進行中の戦闘・イベントには参加せず、次回から同期されます</small></div>}
                {battleActive ? <div className={`${styles.enemyGroup} ${enemies.length === 4 ? styles.fourEnemyGroup : ""}`}>{enemies.map((enemy) => <div key={enemy.id} className={`${styles.enemy} ${enemy.currentHp === 0 ? styles.defeated : ""} ${flashingEnemyIds.has(enemy.id) ? styles.enemyHit : ""}`}><div className={styles.enemyArt}>{missingEnemyArt.has(enemy.id) ? <><span>◢</span><b>{enemy.id % 3 === 0 ? "魔" : enemy.id % 2 === 0 ? "影" : "牙"}</b><span>◣</span></> : <NextImage src={`/crocsians/enemy/${enemy.id}.png`} alt={`${enemy.name}の立ち絵`} width={256} height={256} unoptimized onError={() => setMissingEnemyArt((current) => current.has(enemy.id) ? current : new Set(current).add(enemy.id))} />}</div><h3>{enemy.name}</h3><p>No.{enemy.id} · ATK {enemy.atk} · DEF {enemy.def} · EXP {formatNumber(enemy.exp)}</p><p className={styles.enemyDrops}>DROP {enemy.drop.trim() || "なし"} · RARE {enemy.rareDrop.trim() || "なし"} · {enemy.gold}G</p><i><b style={{ width: `${Math.max(0, enemy.currentHp / enemy.hp * 100)}%` }} /></i>{enemy.skills && enemy.skills.length > 0 && <div className={styles.enemySkills}>{enemy.skills.slice(0, 3).map((skill, index) => { const used = enemy.skillUses?.[index] ?? 0; const maxUses = Math.max(1, Math.floor(Number.isFinite(skill.maxUses) ? skill.maxUses : 1)); const spent = used >= maxUses; return <span key={`${enemy.id}-${skill.name}-${skill.rarity}-${index}`} className={`${styles.enemySkillChip} ${skill.rarity === "R" ? styles.enemySkillRare : styles.enemySkillNormal} ${spent ? styles.enemySkillSpent : ""}`} title={`${skill.effect} · ${used}/${maxUses}`}>{skill.name}<small>{used}/{maxUses}</small></span>; })}</div>}<small>{Math.ceil(enemy.currentHp)} / {enemy.hp}</small></div>)}</div> : explorationEvent ? <div className={styles.explorationEncounter}><span>{explorationEvent.icon}</span><p>SHARED TREASURE EVENT</p><h3>{explorationEvent.title}</h3><small>{explorationEvent.description}</small></div> : <div className={styles.searching}><span>⌖</span><strong>周辺を探索中</strong><small>{lastLoot.length > 0 ? `直近の戦利品: ${lastLoot.map((item) => `${item.rare ? "★" : ""}${item.name}${item.quantity > 1 ? `×${item.quantity}` : ""}`).join("、")}` : "次のイベントを待っています"}</small></div>}
              </div>
              <div className={styles.battleConsole}>
                <div className={styles.battleConsoleMessages} role="status" aria-live="polite">{explorationLogs.slice(0, 3).map((entry, index) => <p key={entry.id} style={{ opacity: 1 - index * 0.16 }}>{entry.message}</p>)}</div>
                {job === "商人" && battleActive && <div><button disabled={getRemainingSkillUses("moneyStrike") === 0} onClick={() => void activateMerchantSkill("moneyStrike")}>◆ 札束で殴る Lv.{skillLevels.moneyStrike ?? 0}<small>所持 {formatNumber(resources.gold)}G · 残り {getRemainingSkillUses("moneyStrike")}/{getSkillUseLimit("moneyStrike")}</small></button><button disabled={getRemainingSkillUses("brightenUp") === 0 || resources.gold < ([1_000, 5_000, 10_000, 30_000, 100_000][(skillLevels.brightenUp ?? 1) - 1])} onClick={() => void activateMerchantSkill("brightenUp")}>✦ どうだ明るくなったろう Lv.{skillLevels.brightenUp ?? 0}<small>味方全員回復 · 残り {getRemainingSkillUses("brightenUp")}/{getSkillUseLimit("brightenUp")}</small></button></div>}
                <div>
                  {currentMap.dungeon && !dungeonStarted ? <><button disabled={!isDungeonHost || mapPlayers.length < 1} onClick={() => void startDungeonAttack()}>{isDungeonHost ? "⚔ ダンジョンアタック開始" : "ホストの開始待ち"}</button><button onClick={leaveExploration}>↩ PTを抜けて街へ</button></> : waitingForNextEvent ? <><button disabled>⌛ 次のイベントまで待機中</button><button onClick={leaveExploration}>↩ 探索を離脱して街へ</button></> : explorationEvent ? <><button onClick={resolveExplorationEvent}>✦ {explorationEvent.action}（成功率 {getTreasureDisarmRate(totalLuck, currentMap.level, job === "盗賊" ? (skillLevels.lockpicking ?? 0) * 3 : 0)}%）</button>{job === "盗賊" && (skillLevels.falsePraise ?? 0) > 0 && <button disabled={getRemainingSkillUses("falsePraise") === 0} onClick={() => void activateFalsePraise()}>♫ 嘘っぱちの賛歌 Lv.{skillLevels.falsePraise}<small>報酬ランク+1 · 残り {getRemainingSkillUses("falsePraise")}/{getSkillUseLimit("falsePraise")}</small></button>}<button onClick={leaveExploration}>↩ イベントを離れて帰還</button></> : <><button disabled={!battleActive}>⚔ 自動攻撃中</button>
                    {job === "戦士" && <><button disabled={!battleActive || getRemainingSkillUses("powerStrike") === 0} onClick={() => void activateWarriorSkill("strike")}>✦ 強撃 Lv.{skillLevels.powerStrike ?? 0}<small>残り {getRemainingSkillUses("powerStrike")}/{getSkillUseLimit("powerStrike")}</small></button><button disabled={!battleActive || getRemainingSkillUses("sweepingBlow") === 0} onClick={() => void activateWarriorSkill("sweep")}>◈ 薙ぎ払い Lv.{skillLevels.sweepingBlow ?? 0}<small>残り {getRemainingSkillUses("sweepingBlow")}/{getSkillUseLimit("sweepingBlow")}</small></button><button disabled={!battleActive || getRemainingSkillUses("rageStrike") === 0} onClick={() => void activateWarriorSkill("rage")}>◆ 怒りの一撃 Lv.{skillLevels.rageStrike ?? 0}<small>残り {getRemainingSkillUses("rageStrike")}/{getSkillUseLimit("rageStrike")}</small></button>{(skillLevels.strongDuty ?? 0) > 0 && <button disabled={!battleActive || getRemainingSkillUses("strongDuty") === 0} onClick={() => void activateWarriorSkill("strongDuty")}>◆ 強者の務め Lv.{skillLevels.strongDuty}<small>狙われ率2倍・被ダメ-10% · 残り {getRemainingSkillUses("strongDuty")}/{getSkillUseLimit("strongDuty")}</small></button>}{(skillLevels.counterAttack ?? 0) > 0 && <button disabled>↩ 反撃 Lv.{skillLevels.counterAttack}<small>反撃率 {Math.round((skillLevels.counterAttack ?? 0) * WARRIOR_COUNTER_RATE_PER_LEVEL * 100)}%</small></button>}{(skillLevels.flurry ?? 0) > 0 && <button disabled={!battleActive || getRemainingSkillUses("flurry") === 0} onClick={() => void activateWarriorSkill("flurry")}>✹ 無双乱撃 Lv.{skillLevels.flurry}<small>ランダム4連撃 · 残り {getRemainingSkillUses("flurry")}/{getSkillUseLimit("flurry")}</small></button>}</>}
                    {job === "僧侶" && <><select className={styles.healTargetSelect} aria-label="ヒール対象" value={selectedHealTarget?.id ?? ""} onChange={(event) => setHealTargetId(event.target.value)}><option value="" disabled>回復対象を選択</option>{healingTargets.map((player) => <option key={player.id} value={player.id}>{player.name} · HP {player.hp}/{player.maxHp ?? 100}</option>)}</select><button disabled={!selectedHealTarget || selectedHealTarget.hp >= (selectedHealTarget.maxHp ?? 100) || getRemainingSkillUses("heal") === 0} onClick={() => void activatePriestSkill("heal", selectedHealTarget?.id)}>✚ ヒール Lv.{skillLevels.heal ?? 0}<small>{selectedHealTarget ? `${selectedHealTarget.name}を回復 · ` : "対象なし · "}残り {getRemainingSkillUses("heal")}/{getSkillUseLimit("heal")}</small></button>{(skillLevels.heal ?? 0) > 0 && <button disabled={!lowestHpHealTarget || getRemainingSkillUses("heal") === 0} onClick={() => void activatePriestSkill("heal", lowestHpHealTarget?.id)}>✚ 自動ヒール<small>{lowestHpHealTarget ? `${lowestHpHealTarget.name}（HP ${lowestHpHealTarget.hp}/${lowestHpHealTarget.maxHp ?? 100}）· ` : "回復対象なし · "}残り {getRemainingSkillUses("heal")}/{getSkillUseLimit("heal")}</small></button>}<button disabled={healingTargets.every((player) => player.hp >= (player.maxHp ?? 100)) || getRemainingSkillUses("groupHeal") === 0} onClick={() => void activatePriestSkill("groupHeal")}>✚ グループヒール Lv.{skillLevels.groupHeal ?? 0}<small>残り {getRemainingSkillUses("groupHeal")}/{getSkillUseLimit("groupHeal")}</small></button><button disabled={getRemainingSkillUses("cure") === 0} onClick={() => void activatePriestSkill("cure")}>◇ キュア Lv.{skillLevels.cure ?? 0}<small>味方全員 · 残り {getRemainingSkillUses("cure")}/{getSkillUseLimit("cure")}</small></button>{(skillLevels.divineDevotion ?? 0) > 0 && <button disabled={!battleActive || getRemainingSkillUses("divineDevotion") === 0 || healingTargets.filter((player) => player.id !== presenceClientIdRef.current && player.id !== "local").length === 0} onClick={() => void activateDivineDevotion()}>✙ 御心による献身 Lv.{skillLevels.divineDevotion}<small>ATK {Math.max(0, totalAttack - 1)}を上乗せ · 残り {getRemainingSkillUses("divineDevotion")}/{getSkillUseLimit("divineDevotion")}</small></button>}{(skillLevels.autoHeal ?? 0) > 0 && <button disabled>✚ オートヒール Lv.{skillLevels.autoHeal}<small>戦闘後 全員HP +{Math.floor(playerProgress.level * (skillLevels.autoHeal ?? 0) * PRIEST_AUTO_HEAL_RECOVERY_MULTIPLIER)}</small></button>}{(skillLevels.autoResurrect ?? 0) > 0 && <button disabled>✙ オートリザレクト Lv.{skillLevels.autoResurrect ?? 0}<small>自動発動 · 残り {getRemainingSkillUses("autoResurrect")}/{getSkillUseLimit("autoResurrect")}回</small></button>}</>}
                    {job === "盗賊" && <>{(skillLevels.trapDisarm ?? 0) > 0 && <button disabled={!battleActive || getRemainingSkillUses("trapDisarm") === 0} onClick={() => void activateThiefSkill("thiefEye")}>◇ 盗人の眼力 Lv.{skillLevels.trapDisarm}<small>レアドロップ率 +{(skillLevels.trapDisarm ?? 0) * 4}% · 残り {getRemainingSkillUses("trapDisarm")}/{getSkillUseLimit("trapDisarm")}</small></button>}{(skillLevels.dangerSense ?? 0) > 0 && <button disabled={!battleActive || getRemainingSkillUses("dangerSense") === 0} onClick={() => void activateThiefSkill("criticalFoot")}>✦ クリティカルフット Lv.{skillLevels.dangerSense}<small>成功率 {(skillLevels.dangerSense ?? 0) * 15}% · 残り {getRemainingSkillUses("dangerSense")}/{getSkillUseLimit("dangerSense")}</small></button>}{(skillLevels.safeFlee ?? 0) > 0 && <button disabled={!battleActive || getRemainingSkillUses("safeFlee") === 0} onClick={() => void activateThiefSkill("safeFlee")}>↯ 逃げるがマシ Lv.{skillLevels.safeFlee}<small>全員逃走 · 残り {getRemainingSkillUses("safeFlee")}/{getSkillUseLimit("safeFlee")}</small></button>}{(skillLevels.evasion ?? 0) > 0 && <button disabled>◇ 逃げも隠れもする Lv.{skillLevels.evasion}<small>回避率 {Math.round((skillLevels.evasion ?? 0) * THIEF_EVASION_RATE_PER_LEVEL * 100)}%</small></button>}</>}
                    {equippedCardinalDefinition && equippedCardinalLevel > 0 && <>{equippedCardinal === "mushroom" && <select className={styles.healTargetSelect} aria-label="変身対象" value={selectedHealTarget?.id ?? ""} onChange={(event) => setHealTargetId(event.target.value)}><option value="" disabled>変身対象を選択</option>{healingTargets.filter((player) => player.id !== presenceClientIdRef.current && player.id !== "local").map((player) => <option key={player.id} value={player.id}>{player.name} · ATK {player.atk ?? "?"}</option>)}</select>}<button disabled={equippedCardinal === "elizabeth" || !battleActive || getRemainingSkillUses(equippedCardinalDefinition.skillId) === 0 || (equippedCardinal === "mushroom" && !healingTargets.some((player) => player.id !== presenceClientIdRef.current && player.id !== "local"))} onClick={() => void activateCardinalSkill(equippedCardinal === "mushroom" ? selectedHealTarget?.id : undefined)}>✙ {equippedCardinalDefinition.skillName} Lv.{equippedCardinalLevel}<small>{equippedCardinal === "elizabeth" ? `戦闘後自動発動 · ${getSkillUsageText(equippedCardinalDefinition.skillId)}` : `枢機卿 · ${getSkillUsageText(equippedCardinalDefinition.skillId)}`}</small></button></>}
                    {job !== "戦士" && job !== "僧侶" && job !== "盗賊" && <button disabled>戦闘スキルなし</button>}
                    <button disabled={Boolean(currentMap.dungeon) || craftedItems.potion <= 0 || hp >= maxHp} onClick={() => void consumePotion()}>✚ 回復薬 <small>{currentMap.dungeon ? "ダンジョン使用不可" : `HP +${POTION_HEAL_AMOUNT} · ×${craftedItems.potion}`}</small></button>
                    <button disabled={battleActive || Boolean(currentMap.dungeon && dungeonStarted)} onClick={leaveExploration}>↩ {battleActive ? "戦闘中は離脱不可" : currentMap.dungeon && dungeonStarted ? "ダンジョン中は離脱不可" : "離脱して街へ"}</button></>}
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className={`${styles.sidePanel} ${view !== "base" && expeditionPanelSide !== chatPanelSide ? styles.singleSidePanel : ""}`}>
          {view === "base" ? (
            <>
              <section className={styles.panelSection}>
                <div className={styles.basePanelTabs}><button className={basePanelTab === "building" ? styles.basePanelTabActive : ""} onClick={() => { setBasePanelTab("building"); setTileMode(null); }}>BUILDING</button><button className={basePanelTab === "tile" ? styles.basePanelTabActive : ""} onClick={() => { setBasePanelTab("tile"); setBuildMode(null); }}>TILE</button></div>
                {basePanelTab === "building" ? <><div className={styles.sectionHeading}><div><p>BUILD</p><h3>施設を建てる</h3></div>{buildMode && <button onClick={() => setBuildMode(null)}>取消</button>}</div>
                <div className={styles.buildingList}>{(Object.keys(BUILDINGS) as BuildingKind[]).map((kind) => { const item = BUILDINGS[kind]; const cost = buildingCost(kind); const count = buildingCounts[kind] ?? 0; const limit = BUILDING_LIMITS[kind]; const costLabel = [...cost.materials.map((material) => `${material.name}${material.quantity}`), ...(cost.gold > 0 ? [`G${cost.gold}`] : [])].join(" · "); return <button key={kind} className={buildMode === kind ? styles.buildSelected : ""} disabled={!canBuild(kind)} onClick={() => setBuildMode(kind)}><span className={styles.buildBadge}><NextImage src={buildingImagePath(kind, 1)} alt="" width={128} height={128} unoptimized /></span><div><strong>{item.name} <em>{count}/{limit}</em></strong><small>{count >= limit ? "建築上限" : costLabel}</small></div></button>; })}</div></> : <><div className={styles.sectionHeading}><div><p>FLOOR</p><h3>床を張る</h3></div>{tileMode && <button onClick={() => setTileMode(null)}>取消</button>}</div>
                <div className={styles.tileList}>{TILE_KINDS.map((kind) => { const item = TILES[kind]; return <button key={kind} className={tileMode === kind ? styles.buildSelected : ""} disabled={!canAffordTile(kind)} onClick={() => setTileMode(kind)}><span style={{ backgroundImage: `url("/crocsians/base/tile/${item.image}")` }} /><div><strong>{item.name}</strong><small>{item.materials.length > 0 ? item.materials.map((material) => `${material.name}×${material.quantity}`).join(" · ") : "素材不要"}</small></div></button>; })}</div></>}
              </section>
              <section className={styles.panelSection}>
                {basePanelTab === "tile" ? <><div className={styles.sectionHeading}><div><p>FLOOR DETAIL</p><h3>{TILES[baseTiles[selectedCell]].name}</h3></div></div><div className={styles.tileDetail}><span style={{ backgroundImage: `url("/crocsians/base/tile/${TILES[baseTiles[selectedCell]].image}")` }} /><div><strong>選択マス {selectedCell % MAP_SIZE + 1}, {Math.floor(selectedCell / MAP_SIZE) + 1}</strong><small>床を解体すると土へ戻ります。素材は返却されません。</small></div><button data-se="none" disabled={baseTiles[selectedCell] === "soil"} onClick={demolishSelectedTile}>{baseTiles[selectedCell] === "soil" ? "土の床です" : "床を解体する"}</button></div></> : <><div className={styles.sectionHeading}><div><p>DETAIL</p><h3>{selectedBuilding ? BUILDINGS[selectedBuilding.kind].name : "空きマス"}</h3></div>{selectedBuilding && <b>Lv.{selectedBuilding.level}</b>}</div>
                {selectedBuilding ? <div className={styles.detail}>
                  <div className={styles.detailVisual}><NextImage src={buildingImagePath(selectedBuilding.kind, selectedBuilding.level)} alt={BUILDINGS[selectedBuilding.kind].name} width={128} height={128} unoptimized /></div>
                  {selectedBuilding.kind === "furnace" ? <div className={styles.production}><span>精錬ジョブ</span><strong>{selectedBuilding.smeltingJob ? selectedBuilding.ready ? "精錬完了" : `${selectedBuilding.smeltingJob.ingotName} ×${selectedBuilding.smeltingJob.quantity}` : "待機中"}</strong>{selectedBuilding.smeltingJob ? <><i><b style={{ width: `${selectedSmeltingProgress}%` }} /></i><small>{selectedBuilding.ready ? "受け取り可能" : `完了まで約${Math.max(1, Math.ceil((selectedBuilding.smeltingJob.completedAt - (Date.now() + serverTimeOffsetRef.current)) / 60000))}分`}</small></> : selectedSmeltingRecipe ? <div className={styles.smeltingControls}><select value={selectedSmeltingRecipe.ore.name} onChange={(event) => { setSmeltingRecipeName(event.target.value); setSmeltingAmount(1); }}>{SMELTING_RECIPES.map((recipe) => <option key={recipe.ore.name} value={recipe.ore.name}>{recipe.ore.name} → {recipe.ingot.name}</option>)}</select><label><span>生成数 {safeSmeltingAmount}</span><input type="range" min="1" max={Math.max(1, maxSmeltingAmount)} value={safeSmeltingAmount} disabled={maxSmeltingAmount < 1} onChange={(event) => setSmeltingAmount(Number(event.target.value))} /></label><small>{selectedSmeltingRecipe.ore.name}×{safeSmeltingAmount * ORE_PER_INGOT} / 所持 {materialInventory[selectedSmeltingRecipe.ore.name] ?? 0} · {safeSmeltingAmount * 5}分</small></div> : <small>精錬できる鉱石がありません</small>}</div> : CRAFTING_KINDS.has(selectedBuilding.kind) ? <div className={styles.production}><span>アイテム製作</span><strong>{selectedBuilding.kind === "weapon" ? `${unlockedWeaponCount}種 解放中` : selectedBuilding.kind === "armor" ? `${unlockedArmorCount}種 解放中` : "図鑑素材を消費"}</strong><small>{selectedBuilding.kind === "weapon" || selectedBuilding.kind === "armor" ? `N: Lv.1 · R: Lv.2 · SR: Lv.3 · SSR: Lv.4` : `${getCraftMaterialCosts([{ name: "薬草", quantity: 8 }, { name: "清水", quantity: 4 }, { name: "空き瓶", quantity: 2 }]).map((material) => `${material.name}${material.quantity}`).join(" · ")} / 所持 ${craftedItems.potion}`}</small></div> : <div className={styles.production}><span>{BUILDINGS[selectedBuilding.kind].product}のストック</span><strong>{selectedBuilding.ready ? "生産完了" : `${selectedBuilding.stockCount} / ${MAX_STOCK_COUNT}回分`}</strong><i><b style={{ width: `${stockProgress(selectedBuilding)}%` }} /></i>{isMaterialProductionKind(selectedBuilding.kind) && <small>30分ごと: {getProductionMaterials(selectedBuilding).map((material) => `${material.name}×${material.quantity}`).join("・")}</small>}<small>{selectedBuilding.ready ? "24回分に達したため生産停止中" : "サーバー時間で30分ごとに生産"}</small></div>}
                  {selectedBuilding.kind === "weapon" ? <button className={styles.primaryAction} onClick={() => setWeaponWorkshopOpen(true)}>武器レシピを開く</button> : selectedBuilding.kind === "armor" ? <button className={styles.primaryAction} onClick={() => setArmorWorkshopOpen(true)}>防具レシピを開く</button> : selectedBuilding.kind === "furnace" ? <button className={styles.primaryAction} disabled={selectedBuilding.smeltingJob ? !selectedBuilding.ready : maxSmeltingAmount < 1} onClick={() => selectedBuilding.smeltingJob ? collectSmelting(selectedCell) : startSmelting(selectedCell)}>{selectedBuilding.smeltingJob ? selectedBuilding.ready ? "インゴットを受け取る" : "精錬中" : "精錬を開始"}</button> : CRAFTING_KINDS.has(selectedBuilding.kind) ? <button className={styles.primaryAction} onClick={() => craft(selectedBuilding.kind)}>{BUILDINGS[selectedBuilding.kind].product}を製作</button> : <button className={styles.primaryAction} disabled={selectedBuilding.stockCount === 0} onClick={() => collect(selectedCell)}>生産物を受け取る{selectedBuilding.stockCount > 0 ? `（${selectedBuilding.stockCount}回分）` : ""}</button>}
                  <div className={styles.upgradeRequirements}>
                    <strong>{selectedBuilding.level >= MAX_BUILDING_LEVEL ? "最大レベル到達" : `Lv.${selectedBuilding.level + 1} 強化素材`}</strong>
                    {selectedUpgradeRecipe && <ul>{selectedUpgradeRecipe.map((material) => { const owned = materialInventory[material.name] ?? 0; return <li key={material.name} className={owned < material.quantity ? styles.materialShortage : ""}><span>{material.name} ×{material.quantity}</span><small>{owned}/{material.quantity}</small></li>; })}</ul>}
                  </div>
                  <button data-se="none" className={styles.secondaryAction} disabled={selectedBuilding.level >= MAX_BUILDING_LEVEL || !canUpgradeSelectedBuilding} onClick={levelUp}>{selectedBuilding.level >= MAX_BUILDING_LEVEL ? "強化完了" : `Lv.${selectedBuilding.level + 1}へ強化`}</button>
                  <div className={styles.demolitionRefund}><strong>解体時の返却素材</strong><span>{selectedBuilding.investedMaterials.length > 0 ? selectedBuilding.investedMaterials.map((material) => `${material.name}×${material.quantity}`).join("・") : "なし（初期施設）"}</span></div>
                  <button data-se="none" className={styles.demolishAction} onClick={() => { if (window.confirm(`${BUILDINGS[selectedBuilding.kind].name}を解体しますか？`)) demolishSelectedBuilding(); else playSe("click"); }}>施設を解体する</button>
                </div> : <p className={styles.emptyDetail}>マップの建物を選択すると、稼働状況を確認できます。</p>}</>}
              </section>
            </>
          ) : expeditionPanelSide === "right" ? renderDesktopStatusPanel() : null}
          {chatPanelSide === "right" && renderDesktopChatPanel()}
        </aside>
      </div>

      <button className={styles.mobileChatTrigger} type="button" aria-label={unreadChatCount > 0 ? `全体チャットを開く、未読${unreadChatCount}件` : "全体チャットを開く"} aria-expanded={mobileChatOpen} onClick={() => { lastReadChatMessageIdRef.current = latestChatMessageId ?? null; setUnreadChatCount(0); setMobileChatOpen(true); }}><span aria-hidden="true">◆</span>{unreadChatCount > 0 && <b>{unreadChatCount}</b>}</button>
      {mobileChatOpen && <div className={styles.mobileChatBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileChatOpen(false); }}>
        <section className={styles.mobileChatModal} role="dialog" aria-modal="true" aria-labelledby="mobile-chat-title">
          <header><div><p>GLOBAL CHANNEL</p><h2 id="mobile-chat-title">全体チャット</h2></div><button type="button" aria-label="全体チャットを閉じる" onClick={() => setMobileChatOpen(false)}>×</button></header>
          <div className={styles.chatTabs}><button type="button" className={desktopChatTab === "chat" ? styles.chatActive : ""} onClick={() => setDesktopChatTab("chat")}>全体チャット</button><button type="button" className={desktopChatTab === "logs" ? styles.chatActive : ""} onClick={() => setDesktopChatTab("logs")}>ログ</button></div>
          {desktopChatTab === "chat" ? <><div ref={mobileChatMessagesRef} className={styles.mobileChatMessages} onScroll={(event) => { const element = event.currentTarget; chatWasAtBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight <= 1; }}>{visibleMessages.length === 0 ? <p className={styles.chatEmpty}>まだメッセージがありません</p> : visibleMessages.map(renderChatMessage)}</div><form className={styles.chatForm} onSubmit={sendChat}><label className={styles.chatImagePicker} title="画像を添付">▧<input type="file" accept="image/*" onChange={selectChatImage} /></label><input value={chat} maxLength={300} onPaste={pasteChatImage} onChange={(event) => setChat(event.target.value)} placeholder={chatImage ? `画像: ${chatImage.name}` : "メッセージを入力"} aria-label="チャットメッセージ"/><button title="送信" type="submit">➤</button></form></> : <div ref={mobileLogMessagesRef} className={styles.expeditionLogList}>{explorationLogs.length === 0 ? <p className={styles.chatEmpty}>まだログがありません</p> : [...explorationLogs].reverse().map((entry) => <article key={entry.id}><time>{new Date(entry.createdAt).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}</time><span>{entry.message}</span></article>)}</div>}
        </section>
      </div>}
      {expandedChatImage && <div className={styles.chatImageModal} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setExpandedChatImage(null); }}><section role="dialog" aria-modal="true" aria-label="チャット画像の拡大表示"><button type="button" aria-label="拡大画像を閉じる" onClick={() => setExpandedChatImage(null)}>×</button><img src={expandedChatImage} alt="チャット画像の拡大表示" /></section></div>}
    </main>
  );
}
