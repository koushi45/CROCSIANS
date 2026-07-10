import enemyCatalog from "@/features/crocsians/enemies.json";
import dungeonEnemyCatalog from "@/features/crocsians/dangeon_enemies.json";
import bossEnemyCatalog from "@/features/crocsians/boss_enemies.json";
import materialCatalog from "@/features/crocsians/materials.json";
import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { consumeSkillUse, consumeSkillUseWithLimit, getSkillUsage, refundSkillUses, type ManagedSkillId, type SkillUsageSnapshot } from "@/server/services/crocsians-skill-usage";
import type { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Enemy = (typeof enemyCatalog)[number];
type Material = { name: string; rarity: "N" | "R" | "SR" | "SSR" };
type WeaponSe = "blow" | "slash" | "slash2" | "strike" | "magic" | "dark-magic" | "dark-magic2";
type EnemySkill = { name: string; rarity: "N" | "R"; maxUses: number; effect: string };
type SharedEnemy = Omit<Enemy, "skills"> & { skills: EnemySkill[]; currentHp: number; skillUses: number[] };
type DungeonColor = "blue" | "red" | "yellow" | "green" | "purple";
type DungeonLevel = 30 | 60 | 90 | 120 | 150;
type CardinalId = "bread" | "batrump" | "interstellar" | "elizabeth" | "mushroom";
type DungeonEnemyTier = { hp: number; atk: number; def: number; exp: number; drop: string; rareDrop: string; gold: number; skills?: EnemySkill[] };
type DungeonEnemySource = { id: number; imgId: number; name: string } & Partial<Record<`${DungeonLevel}`, DungeonEnemyTier>>;
type SessionPlayer = {
  id: string;
  userId: string;
  name: string;
  job: string;
  level: number;
  hp: number;
  maxHp: number;
  atk: number;
  offhandAtk: number;
  baseAtk: number;
  def: number;
  luck: number;
  skillLevels: Record<string, number>;
  cardinalLevels: Partial<Record<CardinalId, number>>;
  equippedCardinal: CardinalId | null;
  equippedWeapon: string | null;
  equippedArmor: string | null;
  equippedWeaponHighQuality: boolean;
  equippedArmorHighQuality: boolean;
  treasureHunt: number;
  treasureDisarmBonus: number;
  damageReduction: number;
  autoHealLevel: number;
  autoHealRecovery: number;
  autoResurrectLevel: number;
  autoResurrectUses: number;
  divineDevotionLevel: number;
  divineDevotionAtkBonus: number;
  divineDevotionActive: boolean;
  divineDevotionTargetId: string | null;
  strongDutyLevel: number;
  strongDutyThreatMultiplier: number;
  strongDutyDamageReduction: number;
  strongDutyActive: boolean;
  counterAttackRate: number;
  evasionRate: number;
  safeFleeLevel: number;
  falsePraiseLevel: number;
  falsePraiseUses: number;
  goldBonus: number;
  rareDropBonus: number;
  cardinalStatusResist: number;
  cardinalAccuracyBonus: number;
  cardinalBarrier: boolean;
  cardinalTransformed: boolean;
  cardinalStarCrownUsed: boolean;
  weaponSe: WeaponSe;
  icon: string | null;
  joinedAt: number;
  updatedAt: number;
  waiting: boolean;
  departurePenaltyStarted?: boolean;
  statusEffect?: string | null;
  statusTurns?: number;
};
type CombatAction = { id: number; createdAt: number; attackerId: string; targetEnemyIds: number[]; targetPlayerIds?: string[]; participantIds: string[]; weaponSe: WeaponSe | "enemy" };
type SharedEventId = "herbGrove" | "abandonedCamp" | "ancientShrine" | "sealedChest" | "caveIn" | `map:${string}`;
type SharedEvent = { id: SharedEventId; icon: string; title: string; description: string; action: string };
type MapEventOutcome = { kind: "heal"; amount: number } | { kind: "gold"; amount: number } | { kind: "damage"; amount: number } | { kind: "status"; amount: number; status: string };
type MapSharedEvent = SharedEvent & { outcome: MapEventOutcome };
type SharedResult = { id: string; createdAt: number; message: string; recipientIds: string[]; gold?: number; goldByRecipient?: Record<string, number>; exp?: number; materials?: { name: string; quantity: number }[]; materialsByRecipient?: Record<string, { name: string; quantity: number }[]>; potion?: number; clearStatus?: boolean; setStatus?: string };
type Session = { id: string; map: string; countdown: number; eventCount: number; battleActive: boolean; enemies: SharedEnemy[]; event: SharedEvent | null; eventStartedAt: number | null; forcedReturnPlayerIds: string[]; log: string; players: Map<string, SessionPlayer>; result: SharedResult | null; nextTickAt: number; battlePhase: "players" | "enemies"; battlePlayerOrder: string[]; battleTurnIndex: number; combatActions: CombatAction[]; combatActionSequence: number; thiefEyeRareDropBonus: number; playerSkillUseCount: number; dungeonSkillUses?: Record<string, Partial<Record<string, number>>>; dungeon?: { color: DungeonColor; level: DungeonLevel; hostClientId: string; started: boolean; bossActive: boolean; bossDefeatedAt: number | null; returnAt: number | null } };
type PortalColor = "blue" | "red" | "yellow" | "green" | "purple";
type PortalLevel = 20 | 40 | 60 | 80 | 100;
type PortalRates = Record<string, number>;
type PortalKeyInventory = Partial<Record<PortalColor, Partial<Record<PortalLevel, number>>>>;
type RewardMaterial = { name: string; quantity: number };

const PLAYER_TTL_MS = 30_000;
const TICK_MS = 1_000;
const CHEST_AUTO_RESOLVE_SECONDS = 10;
const CHEST_TIMEOUT_MS = 5 * 60 * 1000;
const RARE_DROP_RATE = 0.1;
const PORTAL_BASE_RATE = 0.1;
const PORTAL_RATE_STEP = 0.1;
const PORTAL_COLORS: PortalColor[] = ["blue", "red", "yellow", "green", "purple"];
const PORTAL_LEVELS: PortalLevel[] = [20, 40, 60, 80, 100];
const DUNGEON_LEVEL_TO_PORTAL_LEVEL: Record<DungeonLevel, PortalLevel> = { 30: 20, 60: 40, 90: 60, 120: 80, 150: 100 };
const DUNGEON_BADGES: Record<DungeonColor, string> = { blue: "青のバッジ", red: "赤のバッジ", yellow: "黄のバッジ", green: "緑のバッジ", purple: "紫のバッジ" };
const DUNGEON_DATA_KEYS: Record<DungeonColor, "blueDungeon" | "redDungeon" | "yellowDungeon" | "greenDungeon" | "violetDungeon"> = { blue: "blueDungeon", red: "redDungeon", yellow: "yellowDungeon", green: "greenDungeon", purple: "violetDungeon" };
const PRIEST_HEAL_INITIAL_RECOVERY = 24;
const PRIEST_GROUP_HEAL_INITIAL_RECOVERY = 14;
const PRIEST_AUTO_HEAL_RECOVERY_MULTIPLIER = 0.1;
const WARRIOR_STRONG_DUTY_THREAT_MULTIPLIER = 2;
const WARRIOR_STRONG_DUTY_DAMAGE_REDUCTION = 0.1;
const WARRIOR_COUNTER_RATE_PER_LEVEL = 0.12;
const THIEF_EVASION_RATE_PER_LEVEL = 0.04;
const CARDINAL_SKILL_IDS = ["bloodWine", "holyBread", "starCrown", "eternalMercy", "borrowPower"] as const;
const CARDINAL_SKILL_TO_ID: Record<(typeof CARDINAL_SKILL_IDS)[number], CardinalId> = { bloodWine: "batrump", holyBread: "bread", starCrown: "interstellar", eternalMercy: "elizabeth", borrowPower: "mushroom" };
const MATERIALS = materialCatalog as Material[];
const MAPS: Record<string, { level: number; enemyFrom: number; enemyTo: number }> = {
  "GALE WOOD · A1": { level: 1, enemyFrom: 1, enemyTo: 20 },
  "RED WASTE · B1": { level: 10, enemyFrom: 21, enemyTo: 40 },
  "FROST FIELD · C1": { level: 20, enemyFrom: 41, enemyTo: 60 },
  "ASH VOLCANO · D1": { level: 30, enemyFrom: 61, enemyTo: 80 },
  "MOON CASTLE · E1": { level: 40, enemyFrom: 81, enemyTo: 100 },
  "SUNKEN NAVE · F1": { level: 50, enemyFrom: 101, enemyTo: 120 },
  "SKY CITADEL · G1": { level: 60, enemyFrom: 121, enemyTo: 140 },
  "DEMON FRONT · H1": { level: 70, enemyFrom: 141, enemyTo: 160 },
  "END CORRIDOR · I1": { level: 80, enemyFrom: 161, enemyTo: 180 },
  "DEMON CASTLE · J1": { level: 90, enemyFrom: 181, enemyTo: 200 },
};
const MAP_PORTAL_LEVELS: Record<string, PortalLevel> = Object.fromEntries(Object.keys(MAPS).map((code, index) => [code, (index < 2 ? 20 : index < 4 ? 40 : index < 6 ? 60 : index < 8 ? 80 : 100) as PortalLevel]));
const EVENTS: SharedEvent[] = [
  { id: "herbGrove", icon: "✿", title: "薬草の群生地", description: "薬草を自動で採取しました。", action: "" },
  { id: "abandonedCamp", icon: "⌂", title: "放棄された野営地", description: "一行は休息し、補給箱を回収しました。", action: "" },
  { id: "ancientShrine", icon: "✧", title: "古びた祠", description: "祠の加護が一行を包みました。", action: "" },
  { id: "sealedChest", icon: "◇", title: "罠付きの宝箱", description: "すべての宝箱には罠があります。最初に解除を試みたプレイヤーの結果が全員へ反映されます。", action: "罠を解除する" },
  { id: "caveIn", icon: "◆", title: "崩落事故", description: "崩れた岩盤が探索隊へ降り注ぎました。", action: "" },
];

const MAP_EVENTS: Record<string, MapSharedEvent[]> = {
  "GALE WOOD · A1": [
    { id: "map:A1:good:1", icon: "✿", title: "妖精の泉", description: "森の奥で澄んだ泉を発見しました。", action: "", outcome: { kind: "heal", amount: 20 } },
    { id: "map:A1:good:2", icon: "☀", title: "木漏れ日の恵み", description: "木漏れ日の下に旅人の落とし物が輝いています。", action: "", outcome: { kind: "gold", amount: 35 } },
    { id: "map:A1:bad:1", icon: "♠", title: "暴れる茨", description: "急成長した茨が探索隊へ襲いかかりました。", action: "", outcome: { kind: "damage", amount: 12 } },
    { id: "map:A1:bad:2", icon: "☁", title: "毒花の胞子", description: "毒花から濃い胞子が噴き出しました。", action: "", outcome: { kind: "status", amount: 8, status: "毒" } },
  ],
  "RED WASTE · B1": [
    { id: "map:B1:good:1", icon: "♨", title: "砂漠のオアシス", description: "涸れ谷の先に豊かな水場を発見しました。", action: "", outcome: { kind: "heal", amount: 25 } },
    { id: "map:B1:good:2", icon: "◆", title: "砂金鉱脈", description: "風に削られた岩肌から砂金が現れました。", action: "", outcome: { kind: "gold", amount: 45 } },
    { id: "map:B1:bad:1", icon: "≋", title: "赤砂の嵐", description: "視界を奪う猛烈な砂嵐に巻き込まれました。", action: "", outcome: { kind: "damage", amount: 16 } },
    { id: "map:B1:bad:2", icon: "▽", title: "底なし流砂", description: "足元が崩れ、探索隊が流砂へ沈み込みました。", action: "", outcome: { kind: "status", amount: 12, status: "衰弱" } },
  ],
  "FROST FIELD · C1": [
    { id: "map:C1:good:1", icon: "♨", title: "雪原の温泉", description: "雪の下から温かな湯が湧き出ています。", action: "", outcome: { kind: "heal", amount: 30 } },
    { id: "map:C1:good:2", icon: "◇", title: "氷晶の宝脈", description: "氷壁の中に価値ある結晶を発見しました。", action: "", outcome: { kind: "gold", amount: 55 } },
    { id: "map:C1:bad:1", icon: "▲", title: "雪崩", description: "轟音とともに巨大な雪崩が迫ります。", action: "", outcome: { kind: "damage", amount: 20 } },
    { id: "map:C1:bad:2", icon: "❄", title: "凍てつく吹雪", description: "凍える風が体温と感覚を奪いました。", action: "", outcome: { kind: "status", amount: 14, status: "凍傷" } },
  ],
  "ASH VOLCANO · D1": [
    { id: "map:D1:good:1", icon: "✦", title: "火精の加護", description: "穏やかな火精が探索隊へ力を分け与えました。", action: "", outcome: { kind: "heal", amount: 35 } },
    { id: "map:D1:good:2", icon: "◆", title: "黒曜石鉱床", description: "冷えた溶岩の下から貴重な鉱床が現れました。", action: "", outcome: { kind: "gold", amount: 65 } },
    { id: "map:D1:bad:1", icon: "♨", title: "溶岩の噴出", description: "地割れから灼熱の溶岩が噴き上がりました。", action: "", outcome: { kind: "damage", amount: 24 } },
    { id: "map:D1:bad:2", icon: "☁", title: "焼けつく火山灰", description: "高温の火山灰が探索隊を覆いました。", action: "", outcome: { kind: "status", amount: 16, status: "火傷" } },
  ],
  "MOON CASTLE · E1": [
    { id: "map:E1:good:1", icon: "☾", title: "月光の礼拝堂", description: "月光が差し込む礼拝堂に安らぎが満ちています。", action: "", outcome: { kind: "heal", amount: 38 } },
    { id: "map:E1:good:2", icon: "▣", title: "城主の隠し金庫", description: "崩れた壁の奥から古い金庫を発見しました。", action: "", outcome: { kind: "gold", amount: 75 } },
    { id: "map:E1:bad:1", icon: "♞", title: "呪いの甲冑", description: "空の甲冑が突然動き出し斬りかかりました。", action: "", outcome: { kind: "damage", amount: 26 } },
    { id: "map:E1:bad:2", icon: "✢", title: "血霧の回廊", description: "赤黒い霧が生命力を吸い取っていきます。", action: "", outcome: { kind: "status", amount: 18, status: "呪い" } },
  ],
  "SUNKEN NAVE · F1": [
    { id: "map:F1:good:1", icon: "✚", title: "清めの聖水", description: "祭壇に残された聖水が淡く輝いています。", action: "", outcome: { kind: "heal", amount: 40 } },
    { id: "map:F1:good:2", icon: "◇", title: "水没した奉納庫", description: "水底の奉納庫から財宝を回収しました。", action: "", outcome: { kind: "gold", amount: 85 } },
    { id: "map:F1:bad:1", icon: "▼", title: "聖堂天井の崩落", description: "腐食した天井が一行の頭上へ崩れ落ちました。", action: "", outcome: { kind: "damage", amount: 28 } },
    { id: "map:F1:bad:2", icon: "≋", title: "深淵の水圧", description: "激しい水流と水圧が探索隊を締め付けます。", action: "", outcome: { kind: "status", amount: 20, status: "水圧傷" } },
  ],
  "SKY CITADEL · G1": [
    { id: "map:G1:good:1", icon: "☁", title: "癒やしの雲海", description: "柔らかな雲が傷を包み込みました。", action: "", outcome: { kind: "heal", amount: 42 } },
    { id: "map:G1:good:2", icon: "♜", title: "天空の宝物庫", description: "要塞の宝物庫に空賊の財宝が残されています。", action: "", outcome: { kind: "gold", amount: 95 } },
    { id: "map:G1:bad:1", icon: "ϟ", title: "直撃する落雷", description: "黒雲から強烈な雷が探索隊へ落ちました。", action: "", outcome: { kind: "damage", amount: 30 } },
    { id: "map:G1:bad:2", icon: "≋", title: "断崖の暴風", description: "足場を奪う暴風と雷気に晒されました。", action: "", outcome: { kind: "status", amount: 22, status: "感電" } },
  ],
  "DEMON FRONT · H1": [
    { id: "map:H1:good:1", icon: "✧", title: "浄化の灯", description: "戦場跡に残る聖なる灯が傷を癒やしました。", action: "", outcome: { kind: "heal", amount: 45 } },
    { id: "map:H1:good:2", icon: "◆", title: "魔晶石の鉱脈", description: "魔力を帯びた希少な鉱脈を発見しました。", action: "", outcome: { kind: "gold", amount: 105 } },
    { id: "map:H1:bad:1", icon: "♨", title: "魔界炎の奔流", description: "大地を割って黒い炎が押し寄せました。", action: "", outcome: { kind: "damage", amount: 32 } },
    { id: "map:H1:bad:2", icon: "◉", title: "奈落の咆哮", description: "奈落から響く咆哮が心身を震わせます。", action: "", outcome: { kind: "status", amount: 24, status: "恐怖" } },
  ],
  "END CORRIDOR · I1": [
    { id: "map:I1:good:1", icon: "⌛", title: "時の聖域", description: "静止した時間の中で傷が巻き戻っていきます。", action: "", outcome: { kind: "heal", amount: 48 } },
    { id: "map:I1:good:2", icon: "✦", title: "星屑の宝庫", description: "回廊の裂け目から星界の財宝が流れ着きました。", action: "", outcome: { kind: "gold", amount: 115 } },
    { id: "map:I1:bad:1", icon: "◇", title: "次元断裂", description: "空間の裂け目が探索隊を切り裂きました。", action: "", outcome: { kind: "damage", amount: 35 } },
    { id: "map:I1:bad:2", icon: "⊘", title: "終末の波動", description: "破滅の波動が生命力を急速に奪います。", action: "", outcome: { kind: "status", amount: 26, status: "虚弱" } },
  ],
  "DEMON CASTLE · J1": [
    { id: "map:J1:good:1", icon: "✧", title: "女神の残光", description: "消えかけた女神の加護が最後の力を授けました。", action: "", outcome: { kind: "heal", amount: 50 } },
    { id: "map:J1:good:2", icon: "♛", title: "魔王の宝物庫", description: "厳重に封じられた王の財宝を発見しました。", action: "", outcome: { kind: "gold", amount: 130 } },
    { id: "map:J1:bad:1", icon: "♛", title: "魔王の威圧", description: "城を満たす圧倒的な殺気が襲いかかります。", action: "", outcome: { kind: "damage", amount: 38 } },
    { id: "map:J1:bad:2", icon: "♨", title: "黒炎の嵐", description: "逃げ場のない黒炎が探索隊を包みました。", action: "", outcome: { kind: "status", amount: 30, status: "火傷" } },
  ],
};

const sessionGlobal = globalThis as typeof globalThis & { crocsiansSessions?: Map<string, Session>; crocsiansPenaltySweep?: ReturnType<typeof setInterval> };
const sessions = sessionGlobal.crocsiansSessions ?? new Map<string, Session>();
sessionGlobal.crocsiansSessions = sessions;

function mapCode(map: string) {
  return map.startsWith("explore:") ? map.slice("explore:".length) : "";
}

function dungeonFromMap(map: string) {
  const match = /^explore:dungeon:(blue|red|yellow|green|purple):(30|60|90|120|150)(?::[a-zA-Z0-9-]{1,80})?$/.exec(map);
  if (!match) return null;
  return { color: match[1] as DungeonColor, level: Number(match[2]) as DungeonLevel };
}

function validMap(map: unknown): map is string {
  return typeof map === "string" && (Boolean(MAPS[mapCode(map)]) || dungeonFromMap(map) !== null);
}

function profileSkillLevels(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 50).flatMap(([key, level]) => typeof level === "number" && Number.isFinite(level) ? [[key.slice(0, 40), Math.max(0, Math.min(5, Math.floor(level)))]] : []));
}

function profileCardinalLevels(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return Object.fromEntries((["bread", "batrump", "interstellar", "elizabeth", "mushroom"] as CardinalId[]).flatMap((id) => {
    const level = source[id];
    return typeof level === "number" && Number.isFinite(level) && level > 0 ? [[id, Math.max(1, Math.min(5, Math.floor(level)))]] : [];
  })) as Partial<Record<CardinalId, number>>;
}

function cardinalId(value: unknown): CardinalId | null {
  return value === "bread" || value === "batrump" || value === "interstellar" || value === "elizabeth" || value === "mushroom" ? value : null;
}

function equipmentName(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : null;
}

function skillUseLimitFromPlayer(player: SessionPlayer, skillId: string) {
  if (skillId in CARDINAL_SKILL_TO_ID) {
    const cardinal = CARDINAL_SKILL_TO_ID[skillId as keyof typeof CARDINAL_SKILL_TO_ID];
    const level = player.equippedCardinal === cardinal ? Math.max(0, Math.floor(player.cardinalLevels[cardinal] ?? 0)) : 0;
    if (level <= 0) return 0;
    return skillId === "bloodWine" || skillId === "holyBread" ? level + 2 : level;
  }
  const level = Math.max(0, Math.floor(player.skillLevels[skillId] ?? 0));
  if (level <= 0) return 0;
  if (skillId === "falsePraise" || skillId === "autoResurrect") return level;
  if (skillId === "strongDuty" || skillId === "divineDevotion" || skillId === "safeFlee") return 5;
  return level + 2;
}

async function consumePlayerSkillUse(session: Session, player: SessionPlayer, userId: string, skillId: string) {
  const cardinal = CARDINAL_SKILL_TO_ID[skillId as keyof typeof CARDINAL_SKILL_TO_ID];
  if (!session.dungeon?.started && cardinal) {
    const skillLevel = Math.max(0, Math.floor(player.cardinalLevels[cardinal] ?? 0));
    const limit = skillUseLimitFromPlayer(player, skillId);
    return consumeSkillUseWithLimit(userId, skillId as ManagedSkillId, skillLevel, limit);
  }
  if (!session.dungeon?.started) return consumeSkillUse(userId, skillId as Parameters<typeof consumeSkillUse>[1]);
  session.dungeonSkillUses ??= {};
  const playerUses = session.dungeonSkillUses[player.id] ?? {};
  session.dungeonSkillUses[player.id] = playerUses;
  const skillLevel = cardinal ? Math.max(0, Math.floor(player.cardinalLevels[cardinal] ?? 0)) : Math.max(0, Math.floor(player.skillLevels[skillId] ?? 0));
  const limit = skillUseLimitFromPlayer(player, skillId) * 2;
  const used = playerUses[skillId] ?? 0;
  const allowed = limit > 0 && used < limit;
  if (allowed) playerUses[skillId] = used + 1;
  return { skillUses: playerUses as SkillUsageSnapshot["skillUses"], skillUsesResetAt: null, serverTime: Date.now(), allowed, skillLevel, limit };
}

function consumePlayerTrackedSkillUse(session: Session, player: SessionPlayer, userId: string, skillId: string) {
  return consumePlayerSkillUse(session, player, userId, skillId).then((usage) => {
    if (usage.allowed) session.playerSkillUseCount = (session.playerSkillUseCount ?? 0) + 1;
    return usage;
  });
}

function normalizePortalRates(value: unknown): PortalRates {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.keys(MAPS).map((code) => {
    const rate = source[code];
    return [code, typeof rate === "number" && Number.isFinite(rate) ? Math.max(PORTAL_BASE_RATE, Math.min(100, Math.round(rate * 10) / 10)) : PORTAL_BASE_RATE];
  }));
}

function normalizePortalKeyInventory(value: unknown): PortalKeyInventory {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(PORTAL_COLORS.map((color) => {
    const colorSource = source[color] && typeof source[color] === "object" && !Array.isArray(source[color]) ? source[color] as Record<string, unknown> : {};
    return [color, Object.fromEntries(PORTAL_LEVELS.map((level) => {
      const count = colorSource[String(level)];
      return [level, typeof count === "number" && Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0];
    }))];
  })) as PortalKeyInventory;
}

async function readPortalAccountState(userId: string) {
  const save = await prisma.crocsiansSave.findUnique({ where: { userId }, select: { data: true } });
  const data = save?.data && typeof save.data === "object" && !Array.isArray(save.data) ? save.data as Record<string, unknown> : {};
  return {
    portalRates: normalizePortalRates(data.portalRates),
    portalKeyInventory: normalizePortalKeyInventory(data.portalKeyInventory),
  };
}

async function updatePortalAccountForEvent(userId: string, mapCodeValue: string, canSpawn: boolean) {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ data: Prisma.JsonValue }[]>`SELECT "data" FROM "CrocsiansSave" WHERE "userId" = ${userId} FOR UPDATE`;
    const data = rows.length > 0 && rows[0].data && typeof rows[0].data === "object" && !Array.isArray(rows[0].data) ? JSON.parse(JSON.stringify(rows[0].data)) as Record<string, unknown> : {};
    const portalRates = normalizePortalRates(data.portalRates);
    const portalKeyInventory = normalizePortalKeyInventory(data.portalKeyInventory);
    const currentRate = portalRates[mapCodeValue] ?? PORTAL_BASE_RATE;
    const portalAppeared = canSpawn && Math.random() * 100 < currentRate;

    if (portalAppeared) {
      const color = PORTAL_COLORS[Math.floor(Math.random() * PORTAL_COLORS.length)];
      const level = MAP_PORTAL_LEVELS[mapCodeValue] ?? 20;
      const colorInventory = portalKeyInventory[color] ?? {};
      colorInventory[level] = (colorInventory[level] ?? 0) + 1;
      portalKeyInventory[color] = colorInventory;
      portalRates[mapCodeValue] = PORTAL_BASE_RATE;
    } else {
      portalRates[mapCodeValue] = Math.min(100, Math.round((currentRate + PORTAL_RATE_STEP) * 10) / 10);
    }

    data.portalRates = portalRates;
    data.portalKeyInventory = portalKeyInventory;
    if (rows.length > 0) await tx.crocsiansSave.update({ where: { userId }, data: { data: data as Prisma.InputJsonObject } });
    else await tx.crocsiansSave.create({ data: { userId, version: 1, data: data as Prisma.InputJsonObject } });
  });
}

async function updatePortalProgressForEvent(players: SessionPlayer[], mapCodeValue: string, canSpawn: boolean) {
  const userIds = [...new Set(players.map((player) => player.userId))];
  await Promise.all(userIds.map((userId) => updatePortalAccountForEvent(userId, mapCodeValue, canSpawn)));
}

async function consumePortalKeys(userId: string, color: PortalColor, level: PortalLevel, quantity: number) {
  return await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ data: Prisma.JsonValue }[]>`SELECT "data" FROM "CrocsiansSave" WHERE "userId" = ${userId} FOR UPDATE`;
    if (rows.length === 0 || !rows[0].data || typeof rows[0].data !== "object" || Array.isArray(rows[0].data)) return null;
    const data = JSON.parse(JSON.stringify(rows[0].data)) as Record<string, unknown>;
    const portalKeyInventory = normalizePortalKeyInventory(data.portalKeyInventory);
    const colorInventory = portalKeyInventory[color] ?? {};
    const owned = colorInventory[level] ?? 0;
    if (owned < quantity) return null;
    colorInventory[level] = owned - quantity;
    portalKeyInventory[color] = colorInventory;
    data.portalKeyInventory = portalKeyInventory;
    await tx.crocsiansSave.update({ where: { userId }, data: { data: data as Prisma.InputJsonObject } });
    return portalKeyInventory;
  });
}

function getSession(map: string) {
  let session = sessions.get(map);
  if (!session) {
    session = { id: crypto.randomUUID(), map, countdown: 5, eventCount: 0, battleActive: false, enemies: [], event: null, eventStartedAt: null, forcedReturnPlayerIds: [], log: "周辺を探索しています", players: new Map(), result: null, nextTickAt: Date.now() + TICK_MS, battlePhase: "players", battlePlayerOrder: [], battleTurnIndex: 0, combatActions: [], combatActionSequence: 0, thiefEyeRareDropBonus: 0, playerSkillUseCount: 0 };
    const dungeon = dungeonFromMap(map);
    if (dungeon) session.dungeon = { ...dungeon, hostClientId: "", started: false, bossActive: false, bossDefeatedAt: null, returnAt: null };
    sessions.set(map, session);
  }
  session.id ??= crypto.randomUUID();
  session.combatActions ??= [];
  session.combatActionSequence ??= 0;
  session.eventStartedAt ??= null;
  session.forcedReturnPlayerIds ??= [];
  session.thiefEyeRareDropBonus ??= 0;
  session.playerSkillUseCount ??= 0;
  normalizeSessionEnemies(session);
  return session;
}

function recommendedLevel(session: Session) {
  return session.dungeon?.level ?? MAPS[mapCode(session.map)].level;
}

function dungeonBadge(session: Session) {
  return session.dungeon ? DUNGEON_BADGES[session.dungeon.color] : null;
}

function dungeonEnemySources(color: DungeonColor) {
  const value = (dungeonEnemyCatalog as Record<string, unknown>)[DUNGEON_DATA_KEYS[color]];
  return Array.isArray(value) ? value as DungeonEnemySource[] : [];
}

function bossEnemySource(color: DungeonColor) {
  const value = (bossEnemyCatalog as Record<string, unknown>)[DUNGEON_DATA_KEYS[color]];
  return value && typeof value === "object" && !Array.isArray(value) ? value as DungeonEnemySource : null;
}

function createDungeonEnemy(source: DungeonEnemySource, level: DungeonLevel, boss = false): SharedEnemy | null {
  const tier = source[String(level) as `${DungeonLevel}`];
  if (!tier) return null;
  const skills = enemySkills({ skills: tier.skills ?? [] });
  const hp = boss ? level * 200 : tier.hp;
  return {
    id: source.imgId,
    name: source.name,
    hp,
    atk: tier.atk,
    def: tier.def,
    exp: tier.exp,
    drop: tier.drop,
    rareDrop: tier.rareDrop,
    gold: tier.gold,
    skills,
    currentHp: hp,
    skillUses: skills.map(() => 0),
  };
}

function resetSessionState(session: Session) {
  session.countdown = 5;
  session.eventCount = 0;
  session.battleActive = false;
  session.enemies = [];
  session.event = null;
  session.eventStartedAt = null;
  session.forcedReturnPlayerIds = [];
  session.log = "周辺を探索しています";
  session.result = null;
  session.nextTickAt = Date.now() + TICK_MS;
  session.battlePhase = "players";
  session.battlePlayerOrder = [];
  session.battleTurnIndex = 0;
  session.combatActions = [];
  session.thiefEyeRareDropBonus = 0;
  clearTemporaryBattleSkills(session);
}

function activePlayers(session: Session) {
  const expiredBefore = Date.now() - (session.dungeon?.started ? 30_000 : PLAYER_TTL_MS);
  return [...session.players.values()].filter((player) => player.updatedAt >= expiredBefore && player.hp > 0 && !player.waiting);
}

function connectedPlayers(session: Session) {
  const expiredBefore = Date.now() - (session.dungeon?.started ? 30_000 : PLAYER_TTL_MS);
  return [...session.players.values()].filter((player) => player.updatedAt >= expiredBefore);
}

function effectiveAttack(session: Session, player: SessionPlayer) {
  if (player.divineDevotionActive) return 1;
  const baseAttack = Number.isFinite(player.baseAtk) ? player.baseAtk : player.atk;
  const devotionBonus = activePlayers(session)
    .filter((candidate) => candidate.id !== player.id && candidate.divineDevotionActive && candidate.divineDevotionTargetId === player.id)
    .reduce((sum, candidate) => sum + candidate.divineDevotionAtkBonus, 0);
  const burnMultiplier = player.statusEffect === "火傷" ? 0.5 : 1;
  return Math.max(1, Math.floor((baseAttack + devotionBonus) * burnMultiplier));
}

function applyPlayerNormalAttack(session: Session, player: SessionPlayer, target: SharedEnemy) {
  const damages = [calculateDamage(effectiveAttack(session, player), target.def)];
  target.currentHp = Math.max(0, target.currentHp - damages[0]);
  const dualWieldLevel = player.job === "職人" ? Math.max(0, Math.min(5, Math.floor(player.skillLevels.dualWield ?? 0))) : 0;
  if (dualWieldLevel > 0 && player.offhandAtk > 0 && target.currentHp > 0) {
    const burnMultiplier = player.statusEffect === "火傷" ? 0.5 : 1;
    const secondDamage = calculateDamage(Math.max(1, Math.floor(player.offhandAtk * burnMultiplier)), target.def);
    target.currentHp = Math.max(0, target.currentHp - secondDamage);
    damages.push(secondDamage);
  }
  return damages;
}

function actionBlockedByStatus(player: SessionPlayer) {
  return (player.statusEffect === "魅了" || player.statusEffect === "凍結" || player.statusEffect === "麻痺") && (player.statusTurns ?? 1) > 0;
}

function consumeBlockedStatusTurn(player: SessionPlayer) {
  const status = player.statusEffect;
  if (status !== "魅了" && status !== "凍結" && status !== "麻痺") return;
  const remaining = Math.max(1, player.statusTurns ?? 1) - 1;
  if (remaining <= 0) {
    player.statusEffect = null;
    player.statusTurns = 0;
  } else {
    player.statusTurns = remaining;
  }
}

function clearTemporaryBattleSkills(session: Session) {
  for (const player of session.players.values()) {
    player.divineDevotionActive = false;
    player.divineDevotionTargetId = null;
    player.divineDevotionAtkBonus = Math.max(0, (Number.isFinite(player.baseAtk) ? player.baseAtk : player.atk) - 1);
    player.strongDutyActive = false;
    player.cardinalBarrier = false;
    player.cardinalTransformed = false;
    player.cardinalStarCrownUsed = false;
  }
  session.playerSkillUseCount = 0;
}

function strongDutyThreatWeight(player: SessionPlayer) {
  return player.strongDutyActive ? Math.max(1, Number.isFinite(player.strongDutyThreatMultiplier) ? player.strongDutyThreatMultiplier : WARRIOR_STRONG_DUTY_THREAT_MULTIPLIER) : 1;
}

function weightedEnemyTarget(session: Session, targets: SessionPlayer[]) {
  const totalWeight = targets.reduce((sum, player) => sum + strongDutyThreatWeight(player), 0);
  let roll = Math.random() * Math.max(1, totalWeight);
  for (const player of targets) {
    roll -= strongDutyThreatWeight(player);
    if (roll < 0) return player;
  }
  return targets[targets.length - 1];
}

function weightedEnemyTargets(session: Session, targets: SessionPlayer[], count: number) {
  const selected: SessionPlayer[] = [];
  const remaining = targets.slice();
  while (selected.length < count && remaining.length > 0) {
    const target = weightedEnemyTarget(session, remaining);
    selected.push(target);
    remaining.splice(remaining.findIndex((entry) => entry.id === target.id), 1);
  }
  return selected;
}

function skillMultiplierFromEffect(skill: EnemySkill, fallback = 1) {
  const match = /([0-9]+(?:\.[0-9]+)?)倍/.exec(skill.effect);
  return match ? Number(match[1]) : fallback;
}

function applyStatusToTargets(targets: SessionPlayer[], status: string) {
  const applied: string[] = [];
  for (const target of targets) {
    if (target.hp <= 0) continue;
    if (target.cardinalStatusResist > 0 && Math.random() < target.cardinalStatusResist) continue;
    target.statusEffect = status;
    target.statusTurns = status === "火傷" ? 3 : status === "凍結" || status === "麻痺" || status === "魅了" ? 1 : 0;
    applied.push(target.name);
  }
  return applied;
}

function applyBattleAutoHeal(session: Session) {
  const healers = activePlayers(session).filter((player) => player.job === "僧侶" && player.autoHealLevel > 0 && player.autoHealRecovery > 0);
  const amount = healers.reduce((sum, player) => sum + player.autoHealRecovery, 0);
  if (amount <= 0) return 0;
  for (const player of activePlayers(session)) player.hp = Math.min(player.maxHp, player.hp + amount);
  return amount;
}

async function halveAccountGold(userId: string) {
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ data: Prisma.JsonValue }[]>`SELECT "data" FROM "CrocsiansSave" WHERE "userId" = ${userId} FOR UPDATE`;
    if (rows.length === 0) return;
    const data = JSON.parse(JSON.stringify(rows[0].data)) as Record<string, unknown>;
    const resources = data.resources && typeof data.resources === "object" && !Array.isArray(data.resources) ? data.resources as Record<string, unknown> : {};
    const gold = typeof resources.gold === "number" && Number.isFinite(resources.gold) ? Math.max(0, Math.floor(resources.gold)) : 0;
    data.resources = { ...resources, gold: Math.floor(gold / 2) };
    await tx.crocsiansSave.update({ where: { userId }, data: { data: data as Prisma.InputJsonObject } });
  });
}

async function accountGold(userId: string) {
  const save = await prisma.crocsiansSave.findUnique({ where: { userId }, select: { data: true } });
  const data = save?.data && typeof save.data === "object" && !Array.isArray(save.data) ? save.data as Record<string, unknown> : {};
  const resources = data.resources && typeof data.resources === "object" && !Array.isArray(data.resources) ? data.resources as Record<string, unknown> : {};
  return typeof resources.gold === "number" && Number.isFinite(resources.gold) ? Math.max(0, Math.floor(resources.gold)) : 0;
}

async function consumeAccountGold(userId: string, amount: number) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ data: Prisma.JsonValue }[]>`SELECT "data" FROM "CrocsiansSave" WHERE "userId" = ${userId} FOR UPDATE`;
    if (!rows[0]?.data || typeof rows[0].data !== "object" || Array.isArray(rows[0].data)) return false;
    const data = JSON.parse(JSON.stringify(rows[0].data)) as Record<string, unknown>;
    const resources = data.resources && typeof data.resources === "object" && !Array.isArray(data.resources) ? data.resources as Record<string, unknown> : {};
    const gold = typeof resources.gold === "number" && Number.isFinite(resources.gold) ? Math.max(0, Math.floor(resources.gold)) : 0;
    if (gold < amount) return false;
    data.resources = { ...resources, gold: gold - amount };
    await tx.crocsiansSave.update({ where: { userId }, data: { data: data as Prisma.InputJsonObject } });
    return true;
  });
}

async function removePlayer(session: Session, clientId: string, expectedUserId?: string) {
  const player = session.players.get(clientId);
  if (!player || (expectedUserId && player.userId !== expectedUserId) || player.departurePenaltyStarted) return;
  if (session.battleActive && !player.waiting) {
    player.departurePenaltyStarted = true;
    try {
      await halveAccountGold(player.userId);
    } catch (error) {
      player.departurePenaltyStarted = false;
      throw error;
    }
  }
  session.players.delete(clientId);
  if (session.dungeon && !session.dungeon.started && session.dungeon.hostClientId === clientId) {
    session.dungeon.hostClientId = connectedPlayers(session)[0]?.id ?? "";
  }
  session.forcedReturnPlayerIds = session.forcedReturnPlayerIds.filter((id) => id !== clientId);
  if (session.players.size === 0) sessions.delete(session.map);
}

async function removeExpiredPlayers(session: Session) {
  const expiredBefore = Date.now() - PLAYER_TTL_MS;
  const expiredIds = [...session.players.values()].filter((player) => player.updatedAt < expiredBefore).map((player) => player.id);
  for (const clientId of expiredIds) await removePlayer(session, clientId);
}

if (!sessionGlobal.crocsiansPenaltySweep) {
  sessionGlobal.crocsiansPenaltySweep = setInterval(() => {
    for (const session of sessions.values()) void removeExpiredPlayers(session).catch(() => {});
  }, 5_000);
}

function calculateDamage(attack: number, defense: number, multiplier = 1) {
  const safeAttack = Number.isFinite(attack) ? attack : 1;
  const safeDefense = Number.isFinite(defense) ? defense : 0;
  return Math.max(1, Math.floor((safeAttack * multiplier) / 2 - safeDefense / 4));
}

function enemySkills(enemy: Pick<SharedEnemy, "skills">) {
  return (Array.isArray(enemy.skills) ? enemy.skills : []).slice(0, 3) as EnemySkill[];
}

function enemySkillMaxUses(skill: EnemySkill) {
  return Math.max(1, Math.floor(Number.isFinite(skill.maxUses) ? skill.maxUses : skill.rarity === "R" ? 2 : 1));
}

function ensureEnemySkillUses(enemy: SharedEnemy) {
  const skills = enemySkills(enemy);
  const previous = Array.isArray(enemy.skillUses) ? enemy.skillUses : [];
  enemy.skillUses = skills.map((_, index) => Math.max(0, Math.floor(Number.isFinite(previous[index]) ? previous[index] : 0)));
  return enemy.skillUses;
}

function enemySkillSpent(enemy: SharedEnemy, skillIndex: number) {
  const skill = enemySkills(enemy)[skillIndex];
  if (!skill) return true;
  const uses = ensureEnemySkillUses(enemy);
  return (uses[skillIndex] ?? 0) >= enemySkillMaxUses(skill);
}

function chooseEnemySkillIndex(enemy: SharedEnemy, boss = false) {
  const skills = enemySkills(enemy);
  if (skills.length === 0) return null;
  const roll = Math.random() * 100;
  const selected = boss
    ? skills.length === 1
      ? roll < 25 ? 0 : null
      : skills.length === 2
        ? roll < 25 ? 0 : roll < 45 ? 1 : null
        : roll < 25 ? 0 : roll < 45 ? 1 : roll < 60 ? 2 : null
    : skills.length === 1
      ? roll < 25 ? 0 : null
      : skills.length === 2
        ? roll < 30 ? 0 : roll < 50 ? 1 : null
        : roll < 35 ? 0 : roll < 60 ? 1 : roll < 75 ? 2 : null;
  if (selected === null || enemySkillSpent(enemy, selected)) return null;
  const uses = ensureEnemySkillUses(enemy);
  uses[selected] = (uses[selected] ?? 0) + 1;
  return selected;
}

function enemyRageMultiplier(enemy: SharedEnemy, skill: EnemySkill) {
  const hpRate = Math.max(0, Math.min(1, enemy.currentHp / Math.max(1, enemy.hp)));
  const minMultiplier = skill.rarity === "R" ? 1.5 : 1.2;
  const maxMultiplier = skill.rarity === "R" ? 3 : 2;
  return minMultiplier + (1 - hpRate) * (maxMultiplier - minMultiplier);
}

function enemyAttackMultiplier(enemy: SharedEnemy, skill: EnemySkill) {
  if (skill.name === "強撃") return skill.rarity === "R" ? 2 : 1.5;
  if (skill.name === "なぎ払い" || skill.name === "薙ぎ払い") return skill.rarity === "R" ? 1.2 : 0.8;
  if (skill.name === "怒りの一撃") return enemyRageMultiplier(enemy, skill);
  return 1;
}

function createSharedEnemy(enemy: Enemy): SharedEnemy {
  const skills = enemySkills(enemy as Pick<SharedEnemy, "skills">);
  return { ...enemy, skills, currentHp: enemy.hp, skillUses: skills.map(() => 0) };
}

function normalizeSessionEnemies(session: Session) {
  session.enemies = (session.enemies ?? []).map((enemy) => {
    const skills = enemySkills(enemy);
    const previous = Array.isArray(enemy.skillUses) ? enemy.skillUses : [];
    return {
      ...enemy,
      skills,
      currentHp: Number.isFinite(enemy.currentHp) ? enemy.currentHp : enemy.hp,
      skillUses: skills.map((_, index) => Math.max(0, Math.floor(Number.isFinite(previous[index]) ? previous[index] : 0))),
    };
  });
}

function treasureDisarmRate(luck: number, recommendedLevel: number, skillBonus = 0) {
  const safeLuck = Number.isFinite(luck) ? luck : 1;
  return Math.max(1, Math.min(99, Math.floor(70 + safeLuck - recommendedLevel * 2 + skillBonus)));
}

function treasureAppearanceRate(players: SessionPlayer[], recommendedLevel: number) {
  const highestLuck = Math.max(1, ...players.map((player) => player.luck));
  const highestTreasureHunt = Math.max(0, ...players.map((player) => player.job === "盗賊" ? player.treasureHunt : 0));
  const effectiveLuck = Math.max(0, highestLuck - recommendedLevel * 2);
  const luckBonus = Math.min(10, Math.floor(effectiveLuck * 0.2));
  return Math.min(50, 5 + luckBonus + highestTreasureHunt * 2);
}

function highestLuckPlayer(players: SessionPlayer[]) {
  return players.slice().sort((left, right) => right.luck - left.luck || left.joinedAt - right.joinedAt || left.id.localeCompare(right.id))[0];
}

function randomChestMaterials(recommendedLevel: number) {
  const rarityWeights: { rarity: Material["rarity"]; weight: number }[] = [
    { rarity: "N", weight: Math.max(10, 100 - recommendedLevel) },
    { rarity: "R", weight: recommendedLevel >= 10 ? 35 + recommendedLevel / 2 : 0 },
    { rarity: "SR", weight: recommendedLevel >= 30 ? recommendedLevel - 10 : 0 },
    { rarity: "SSR", weight: recommendedLevel >= 60 ? recommendedLevel - 50 : 0 },
  ];
  const rewards = new Map<string, { name: string; quantity: number }>();
  const itemCount = 1 + Math.floor(Math.random() * 3);
  for (let index = 0; index < itemCount; index += 1) {
    const totalWeight = rarityWeights.reduce((sum, entry) => sum + entry.weight, 0);
    let roll = Math.random() * totalWeight;
    const selectedRarity = rarityWeights.find((entry) => {
      roll -= entry.weight;
      return roll < 0 && entry.weight > 0;
    })?.rarity ?? "N";
    const pool = MATERIALS.filter((material) => material.rarity === selectedRarity);
    const material = pool[Math.floor(Math.random() * pool.length)];
    const current = rewards.get(material.name);
    rewards.set(material.name, { name: material.name, quantity: (current?.quantity ?? 0) + 1 });
  }
  return [...rewards.values()];
}

function randomChestMaterialsByRecipient(players: SessionPlayer[], materials: { name: string; quantity: number }[]) {
  const rewardsByAccount = new Map<string, { name: string; quantity: number }[]>();
  return Object.fromEntries(players.map((player) => {
    let rewards = rewardsByAccount.get(player.userId);
    if (!rewards) {
      rewards = materials.map((material) => ({ name: material.name, quantity: 4 + Math.floor(Math.random() * 4) }));
      rewardsByAccount.set(player.userId, rewards);
    }
    return [player.id, rewards.map((material) => ({ ...material }))];
  }));
}

function enemyCount(playerCount: number) {
  const capped = Math.min(6, Math.max(1, playerCount));
  const pressure = (capped - 1) / 5;
  const weights = [70 - 60 * pressure, 25, 5 + 30 * pressure, 30 * pressure];
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (let index = 0; index < weights.length; index += 1) {
    cumulative += weights[index];
    if (roll < cumulative) return index + 1;
  }
  return 4;
}

function normalizeRewardMaterials(materials: RewardMaterial[] | undefined) {
  return materials
    ?.map((material) => ({ name: material.name.trim(), quantity: Math.max(0, Math.floor(material.quantity)) }))
    .filter((material) => material.name && material.quantity > 0);
}

function createResult(session: Session, result: Omit<SharedResult, "id" | "createdAt" | "recipientIds">) {
  const materials = normalizeRewardMaterials(result.materials);
  const materialsByRecipient = result.materialsByRecipient
    ? Object.fromEntries(Object.entries(result.materialsByRecipient).map(([playerId, rewards]) => [playerId, normalizeRewardMaterials(rewards) ?? []]))
    : undefined;
  session.result = { ...result, materials, materialsByRecipient, id: crypto.randomUUID(), createdAt: Date.now(), recipientIds: activePlayers(session).map((player) => player.id) };
  session.log = result.message;
}

function partyDamageReduction(session: Session) {
  return Math.max(0, ...activePlayers(session).filter((player) => player.job === "僧侶").map((player) => player.damageReduction));
}

function reducedDamage(session: Session, player: SessionPlayer, amount: number) {
  const blessingReduction = Math.max(player.damageReduction, partyDamageReduction(session));
  const strongDutyReduction = player.strongDutyActive ? (Number.isFinite(player.strongDutyDamageReduction) ? player.strongDutyDamageReduction : WARRIOR_STRONG_DUTY_DAMAGE_REDUCTION) : 0;
  const reduction = Math.min(0.9, blessingReduction + strongDutyReduction);
  return Math.max(1, Math.floor(amount * (1 - reduction)));
}

function enhancedRewardLevel(currentLevel: number) {
  return Math.min(160, currentLevel + 10);
}

async function damagePlayer(session: Session, player: SessionPlayer, amount: number) {
  player.hp = Math.max(0, player.hp - amount);
  if (amount > 0 && player.statusEffect === "魅了") {
    player.statusEffect = null;
    player.statusTurns = 0;
  }
  if (player.hp > 0) return null;
  const candidates = connectedPlayers(session)
    .filter((candidate) => !candidate.waiting && candidate.job === "僧侶" && candidate.autoResurrectLevel > 0 && (candidate.hp > 0 || candidate.id === player.id))
    .sort((left, right) => left.joinedAt - right.joinedAt || left.id.localeCompare(right.id));
  for (const candidate of candidates) {
    const usage = await consumePlayerTrackedSkillUse(session, candidate, candidate.userId, "autoResurrect");
    candidate.autoResurrectUses = usage.skillUses.autoResurrect ?? 0;
    if (!usage.allowed) continue;
    player.hp = player.maxHp;
    return candidate;
  }
  return null;
}

async function applyBurnAfterAction(session: Session, player: SessionPlayer) {
  if (player.statusEffect !== "火傷" || player.hp <= 0) return "";
  await damagePlayer(session, player, Math.max(1, Math.floor(player.maxHp * 0.08)));
  const remaining = Math.max(1, player.statusTurns ?? 3) - 1;
  if (remaining <= 0) {
    player.statusEffect = null;
    player.statusTurns = 0;
    return "。火傷で最大HPの8%ダメージを受け、火傷が解除されました";
  }
  player.statusTurns = remaining;
  return `。火傷で最大HPの8%ダメージ（残り${remaining}回）`;
}

function isMapSharedEvent(event: SharedEvent): event is MapSharedEvent {
  return "outcome" in event;
}

async function resolveMapSharedEvent(session: Session, event: MapSharedEvent, players: SessionPlayer[]) {
  const levelScale = Math.max(1, recommendedLevel(session) / Math.max(1, MAPS[mapCode(session.map)]?.level ?? recommendedLevel(session)));
  const scaledAmount = Math.max(1, Math.floor(event.outcome.amount * levelScale));
  const outcome = { ...event.outcome, amount: scaledAmount };
  if (outcome.kind === "heal") {
    for (const player of players) player.hp = Math.min(player.maxHp, player.hp + outcome.amount);
    createResult(session, { message: `${event.title}が発生し、探索隊全員のHPが${outcome.amount}回復しました` });
  } else if (outcome.kind === "gold") {
    createResult(session, { message: `${event.title}を発見し、探索隊全員が${outcome.amount}Gを入手しました`, gold: outcome.amount });
  } else if (outcome.kind === "damage") {
    createResult(session, { message: `${event.title}が発生し、探索隊全員が最大${outcome.amount}ダメージを受けました（加護による軽減あり）` });
    for (const player of players) await damagePlayer(session, player, reducedDamage(session, player, outcome.amount));
  } else {
    createResult(session, { message: `${event.title}が発生し、探索隊全員が最大${outcome.amount}ダメージを受けました（加護による軽減あり）` });
    for (const player of players) await damagePlayer(session, player, reducedDamage(session, player, outcome.amount));
  }
}

function activateWaitingPlayers(session: Session) {
  for (const player of connectedPlayers(session)) player.waiting = false;
}

async function resolveTreasureEvent(session: Session, player: SessionPlayer, automatic = false, enhanced = false) {
  if (session.event?.id !== "sealedChest") return;
  const actor = player.name;
  const level = recommendedLevel(session);
  const rate = treasureDisarmRate(player.luck, level, player.treasureDisarmBonus);
  const action = automatic ? `10秒が経過したため、LUCが最も高い${actor}が自動で罠の解除を試み` : `${actor}が罠の解除を試み`;
  if (Math.random() * 100 < rate) {
    const rewardLevel = enhanced ? enhancedRewardLevel(level) : level;
    const materials = randomChestMaterials(rewardLevel);
    const recipients = activePlayers(session);
    const materialsByRecipient = randomChestMaterialsByRecipient(recipients, materials);
    const badge = dungeonBadge(session);
    if (badge) {
      for (const rewards of Object.values(materialsByRecipient)) rewards.push({ name: badge, quantity: level });
    }
    const materialSummary = materials.map((material) => material.name).join("、");
    createResult(session, { message: `${action}て成功（成功率${rate}%）。全員が60Gと${materialSummary}を各4～7個入手しました${badge ? `。追加で${badge}×${level}` : ""}${enhanced ? "（嘘っぱちの賛歌で報酬ランク+1）" : ""}`, gold: 60, materialsByRecipient });
  } else {
    for (const target of activePlayers(session)) await damagePlayer(session, target, reducedDamage(session, target, 12));
    createResult(session, { message: `${action}ましたが失敗（成功率${rate}%）。宝箱の罠が作動し、全員が12ダメージを受けました` });
  }
  session.event = null;
  session.countdown = 6 + Math.floor(Math.random() * 6);
  activateWaitingPlayers(session);
}

function recordCombatAction(session: Session, player: SessionPlayer, targetEnemyIds: number[]) {
  session.combatActionSequence = (session.combatActionSequence ?? 0) + 1;
  session.combatActions.push({ id: session.combatActionSequence, createdAt: Date.now(), attackerId: player.id, targetEnemyIds, participantIds: activePlayers(session).map((entry) => entry.id), weaponSe: player.weaponSe ?? "blow" });
  session.combatActions = session.combatActions.slice(-32);
}

function recordEnemyCombatAction(session: Session, enemy: SharedEnemy, targets: SessionPlayer | SessionPlayer[]) {
  session.combatActionSequence = (session.combatActionSequence ?? 0) + 1;
  const targetList = Array.isArray(targets) ? targets : [targets];
  const participantIds = [...new Set([...activePlayers(session).map((entry) => entry.id), ...targetList.map((target) => target.id)])];
  session.combatActions.push({ id: session.combatActionSequence, createdAt: Date.now(), attackerId: `enemy:${enemy.id}`, targetEnemyIds: [], targetPlayerIds: targetList.map((target) => target.id), participantIds, weaponSe: "enemy" });
  session.combatActions = session.combatActions.slice(-32);
}

async function applyEnemyDamageToTarget(session: Session, enemy: SharedEnemy, target: SessionPlayer, multiplier = 1) {
  if (target.evasionRate > 0 && Math.random() < target.evasionRate) return `${target.name}が回避`;
  if (target.cardinalBarrier) {
    target.cardinalBarrier = false;
    return `${target.name}のバリアが攻撃を無効化`;
  }
  const damage = reducedDamage(session, target, calculateDamage(enemy.atk, target.def, multiplier));
  const resurrector = await damagePlayer(session, target, damage);
  let message = resurrector ? `${target.name}に${damage}ダメージ（${resurrector.name}のオートリザレクトで復活）` : `${target.name}に${damage}ダメージ`;
  if (target.hp > 0 && target.counterAttackRate > 0 && Math.random() < target.counterAttackRate) {
    const counterDamage = calculateDamage(effectiveAttack(session, target), enemy.def);
    enemy.currentHp = Math.max(0, enemy.currentHp - counterDamage);
    recordCombatAction(session, target, [enemy.id]);
    message += `。${target.name}が反撃し、${enemy.name}に${counterDamage}ダメージ`;
  }
  return message;
}

async function executeEnemyNormalAttack(session: Session, enemy: SharedEnemy, targets: SessionPlayer[]) {
  const target = weightedEnemyTarget(session, targets);
  recordEnemyCombatAction(session, enemy, target);
  const result = await applyEnemyDamageToTarget(session, enemy, target);
  session.log = result === `${target.name}が回避` ? `${enemy.name}の攻撃を${result}` : `${enemy.name}が${result}`;
}

async function executeBossSkill(session: Session, enemy: SharedEnemy, skill: EnemySkill, targets: SessionPlayer[]) {
  const multiplier = skill.name === "怒りの一撃" ? enemyRageMultiplier(enemy, skill) : skillMultiplierFromEffect(skill, enemyAttackMultiplier(enemy, skill));
  if (skill.name === "大地の怒り") {
    const hitTargets: SessionPlayer[] = [];
    const results: string[] = [];
    for (let hit = 0; hit < 4; hit += 1) {
      const livingTargets = targets.filter((target) => target.hp > 0);
      if (livingTargets.length === 0) break;
      const target = weightedEnemyTarget(session, livingTargets);
      hitTargets.push(target);
      results.push(await applyEnemyDamageToTarget(session, enemy, target, multiplier));
    }
    const uniqueTargets = [...new Map(hitTargets.map((target) => [target.id, target])).values()];
    recordEnemyCombatAction(session, enemy, uniqueTargets);
    session.log = `${enemy.name}が${skill.name}${skill.rarity}を発動。${results.join(" / ")}`;
    return;
  }
  const targetList = skill.name === "ドラゴンブレス" || skill.name === "ブリザード" || skill.name === "チャーム"
      ? targets
      : skill.name === "落雷"
        ? weightedEnemyTargets(session, targets, 2)
        : [weightedEnemyTarget(session, targets)];
  const uniqueTargets = [...new Map(targetList.map((target) => [target.id, target])).values()];
  recordEnemyCombatAction(session, enemy, uniqueTargets);
  const statusCandidates: SessionPlayer[] = [];
  const results: string[] = [];

  for (const target of targetList) {
    const result = await applyEnemyDamageToTarget(session, enemy, target, multiplier);
    results.push(result);
    if (!result.includes("回避") && !result.includes("バリア") && !statusCandidates.some((entry) => entry.id === target.id)) statusCandidates.push(target);
  }

  let status: string | null = null;
  let statusTargets: SessionPlayer[] = [];
  if (skill.name === "ドラゴンブレス") {
    status = "火傷";
    statusTargets = skill.effect.includes("2人") ? weightedEnemyTargets(session, statusCandidates, 2) : statusCandidates;
  } else if (skill.name === "落雷") {
    status = "麻痺";
    statusTargets = statusCandidates;
  } else if (skill.name === "ブリザード") {
    status = "凍結";
    statusTargets = weightedEnemyTargets(session, statusCandidates, 2);
  } else if (skill.name === "チャーム") {
    status = "魅了";
    statusTargets = statusCandidates;
  }

  const statusNames = status ? applyStatusToTargets(statusTargets, status) : [];
  session.log = `${enemy.name}が${skill.name}${skill.rarity}を発動。${results.join(" / ")}${status && statusNames.length > 0 ? `。${statusNames.join("、")}が${status}状態になりました` : ""}`;
}

async function executeEnemySkill(session: Session, enemy: SharedEnemy, skillIndex: number, targets: SessionPlayer[]) {
  const skill = enemySkills(enemy)[skillIndex];
  if (!skill) {
    await executeEnemyNormalAttack(session, enemy, targets);
    return;
  }
  if (skill.name === "グループヒール") {
    const amount = enemy.id * (skill.rarity === "R" ? 4 : 2);
    const healTargets = session.enemies.filter((entry) => entry.currentHp > 0);
    let totalRecovery = 0;
    for (const target of healTargets) {
      const before = target.currentHp;
      target.currentHp = Math.min(target.hp, target.currentHp + amount);
      totalRecovery += target.currentHp - before;
    }
    session.log = `${enemy.name}が${skill.name}${skill.rarity}を発動。敵全体を${amount}回復しました${totalRecovery === 0 ? "（全員HP満タン）" : ""}`;
    return;
  }
  if (session.dungeon?.bossActive) {
    await executeBossSkill(session, enemy, skill, targets);
    return;
  }
  const multiplier = enemyAttackMultiplier(enemy, skill);
  const targetList = skill.name === "なぎ払い" || skill.name === "薙ぎ払い" ? targets : [weightedEnemyTarget(session, targets)];
  recordEnemyCombatAction(session, enemy, targetList);
  const results: string[] = [];
  for (const target of targetList) results.push(await applyEnemyDamageToTarget(session, enemy, target, multiplier));
  session.log = `${enemy.name}が${skill.name}${skill.rarity}を発動。${results.join(" / ")}`;
}

function battleRewards(session: Session) {
  const players = activePlayers(session);
  const baseGold = session.enemies.reduce((sum, enemy) => sum + enemy.gold, 0);
  const thiefEyeRareDropBonus = Math.max(0, Math.min(1, session.thiefEyeRareDropBonus ?? 0));
  const materialsByRecipient = Object.fromEntries(players.map((player) => {
    const items = new Map<string, { name: string; quantity: number }>();
    const add = (name: string) => {
      const normalizedName = name.trim();
      if (!normalizedName) return;
      items.set(normalizedName, { name: normalizedName, quantity: (items.get(normalizedName)?.quantity ?? 0) + 1 });
    };
    for (const enemy of session.enemies) {
      add(enemy.drop);
      if (Math.random() < Math.min(1, RARE_DROP_RATE + player.rareDropBonus + thiefEyeRareDropBonus)) add(enemy.rareDrop);
    }
    return [player.id, [...items.values()]];
  }));
  const goldByRecipient = Object.fromEntries(players.map((player) => [player.id, Math.floor(baseGold * (1 + player.goldBonus))]));
  return { goldByRecipient, exp: session.enemies.reduce((sum, enemy) => sum + enemy.exp, 0), materialsByRecipient, baseGold };
}

async function applyEternalMercy(session: Session) {
  const usersToRefund = new Set<string>();
  const activatedPlayers: string[] = [];
  for (const player of activePlayers(session).filter((entry) => entry.equippedCardinal === "elizabeth" && (entry.cardinalLevels.elizabeth ?? 0) > 0)) {
    const usage = await consumePlayerTrackedSkillUse(session, player, player.userId, "eternalMercy");
    if (!usage.allowed) continue;
    activatedPlayers.push(player.name);
    if (session.dungeon?.started) {
      const uses = session.dungeonSkillUses?.[player.id] ?? {};
      for (const skillId of Object.keys(uses)) {
        if ((CARDINAL_SKILL_IDS as readonly string[]).includes(skillId)) continue;
        uses[skillId] = Math.max(0, (uses[skillId] ?? 0) - 1);
        if (uses[skillId] === 0) delete uses[skillId];
      }
    } else {
      usersToRefund.add(player.userId);
    }
  }
  await Promise.all([...usersToRefund].map((userId) => refundSkillUses(userId, [...CARDINAL_SKILL_IDS])));
  return activatedPlayers;
}

async function finishBattle(session: Session) {
  const rewards = battleRewards(session);
  const autoHealAmount = applyBattleAutoHeal(session);
  const mercyPlayers = await applyEternalMercy(session);
  const mercyMessage = mercyPlayers.length > 0 ? `。${mercyPlayers.join("、")}の慈悲よ永久にでスキル使用回数が回復しました` : "";
  const bossClear = session.dungeon?.bossActive === true;
  if (bossClear && session.dungeon) {
    const badge = dungeonBadge(session);
    if (badge) {
      for (const rewardsForPlayer of Object.values(rewards.materialsByRecipient)) rewardsForPlayer.push({ name: badge, quantity: session.dungeon.level * 5 });
    }
    session.dungeon.bossActive = false;
    session.dungeon.bossDefeatedAt = Date.now();
    session.dungeon.returnAt = Date.now() + 10_000;
  }
  session.battleActive = false;
  session.battlePlayerOrder = [];
  session.battleTurnIndex = 0;
  session.countdown = bossClear ? 10 : 7 + Math.floor(Math.random() * 5);
  createResult(session, { exp: rewards.exp, goldByRecipient: rewards.goldByRecipient, materialsByRecipient: rewards.materialsByRecipient, message: bossClear ? `ダンジョンボスを撃破。追加報酬を獲得しました。10秒後に街へ帰還します${autoHealAmount > 0 ? `。オートヒールで全員のHPが${autoHealAmount}回復しました` : ""}${mercyMessage}` : `戦闘に勝利。${rewards.exp}EXP / 基本${rewards.baseGold}Gを獲得しました${autoHealAmount > 0 ? `。オートヒールで全員のHPが${autoHealAmount}回復しました` : ""}${mercyMessage}` });
  session.thiefEyeRareDropBonus = 0;
  clearTemporaryBattleSkills(session);
  activateWaitingPlayers(session);
}

async function startEncounter(session: Session) {
  if (session.dungeon && !session.dungeon.started) return;
  if (session.dungeon?.returnAt || session.dungeon?.bossDefeatedAt) return;
  const definition = session.dungeon ? { level: session.dungeon.level, enemyFrom: 1, enemyTo: 1 } : MAPS[mapCode(session.map)];
  const code = mapCode(session.map);
  const players = activePlayers(session);
  session.eventCount += 1;
  if (session.dungeon && session.eventCount >= 30) {
    const source = bossEnemySource(session.dungeon.color);
    const boss = source ? createDungeonEnemy(source, session.dungeon.level, true) : null;
    if (!boss) {
      session.log = "ボスデータを読み込めませんでした";
      session.countdown = 10;
      return;
    }
    session.enemies = [boss];
    session.dungeon.bossActive = true;
    clearTemporaryBattleSkills(session);
    session.thiefEyeRareDropBonus = 0;
    session.battleActive = true;
    session.battlePhase = "players";
    session.battlePlayerOrder = players.slice().sort((left, right) => right.luck - left.luck || left.joinedAt - right.joinedAt || left.id.localeCompare(right.id)).map((player) => player.id);
    session.battleTurnIndex = 0;
    session.log = `${boss.name}が出現。ダンジョン最奥のボス戦闘を開始します`;
    return;
  }
  const chestEvent = EVENTS.find((event) => event.id === "sealedChest")!;
  if (Math.random() * 100 < treasureAppearanceRate(players, definition.level)) {
    if (!session.dungeon) await updatePortalProgressForEvent(players, code, true);
    session.event = chestEvent;
    session.countdown = CHEST_AUTO_RESOLVE_SECONDS;
    session.log = `罠付きの宝箱を発見しました。${CHEST_AUTO_RESOLVE_SECONDS}秒以内に誰か一人が罠の解除を試みてください`;
    return;
  }
  if (Math.random() < 0.58) {
    if (!session.dungeon) await updatePortalProgressForEvent(players, code, false);
    const selected = session.dungeon
      ? dungeonEnemySources(session.dungeon.color).map((source) => createDungeonEnemy(source, session.dungeon!.level)).filter((enemy): enemy is SharedEnemy => enemy !== null).sort(() => Math.random() - 0.5).slice(0, enemyCount(players.length))
      : enemyCatalog.filter((enemy) => enemy.id >= definition.enemyFrom && enemy.id <= definition.enemyTo).sort(() => Math.random() - 0.5).slice(0, enemyCount(players.length)).map(createSharedEnemy);
    session.enemies = selected;
    clearTemporaryBattleSkills(session);
    session.thiefEyeRareDropBonus = 0;
    session.battleActive = true;
    session.battlePhase = "players";
    session.battlePlayerOrder = players.slice().sort((left, right) => right.luck - left.luck || left.joinedAt - right.joinedAt || left.id.localeCompare(right.id)).map((player) => player.id);
    session.battleTurnIndex = 0;
    session.log = `${selected.map((enemy) => enemy.name).join("、")}が出現。共闘を開始します`;
    return;
  }
  if (!session.dungeon) await updatePortalProgressForEvent(players, code, true);
  const mapEventsWithoutStatus = (MAP_EVENTS[mapCode(session.map)] ?? []).filter((event) => event.outcome.kind !== "status");
  const ordinaryEvents: SharedEvent[] = [...EVENTS.filter((event) => event.id !== "sealedChest"), ...mapEventsWithoutStatus];
  const event = ordinaryEvents[Math.floor(Math.random() * ordinaryEvents.length)];
  session.event = event;
  if (isMapSharedEvent(event)) {
    await resolveMapSharedEvent(session, event, players);
  } else if (event.id === "herbGrove") {
    createResult(session, { message: "薬草の群生地で、全員が薬草を6個入手しました", materials: [{ name: "薬草", quantity: 6 }] });
  } else if (event.id === "abandonedCamp") {
    for (const player of players) player.hp = Math.min(player.maxHp, player.hp + 30);
    createResult(session, { message: "放棄された野営地で全員のHPが30回復し、回復薬を1個入手しました", potion: 1 });
  } else if (event.id === "ancientShrine") {
    for (const player of players) player.hp = Math.min(player.maxHp, player.hp + 15);
    createResult(session, { message: "古びた祠の加護で全員のHPが15回復し、状態異常が解除されました", clearStatus: true });
  } else if (event.id === "caveIn") {
    createResult(session, { message: "崩落事故が発生し、探索隊全員が最大20ダメージを受けました（加護による軽減あり）" });
    for (const player of players) await damagePlayer(session, player, reducedDamage(session, player, 20));
  }
  session.event = null;
  session.countdown = 6 + Math.floor(Math.random() * 6);
  activateWaitingPlayers(session);
}

async function battleTick(session: Session) {
  if (session.enemies.every((enemy) => enemy.currentHp === 0)) {
    await finishBattle(session);
    return;
  }
  const players = activePlayers(session);
  if (players.length === 0) return;
  if (!session.battlePhase) {
    session.battlePhase = "players";
    session.battlePlayerOrder = players.slice().sort((left, right) => right.luck - left.luck || left.joinedAt - right.joinedAt || left.id.localeCompare(right.id)).map((player) => player.id);
    session.battleTurnIndex = 0;
  }

  if (session.battlePhase === "players") {
    while (session.battleTurnIndex < session.battlePlayerOrder.length) {
      const playerId = session.battlePlayerOrder[session.battleTurnIndex];
      session.battleTurnIndex += 1;
      const player = players.find((entry) => entry.id === playerId);
      if (!player) continue;
      if (actionBlockedByStatus(player)) {
        session.log = `${player.name}は${player.statusEffect}状態で行動できません`;
        consumeBlockedStatusTurn(player);
        return;
      }
      const target = session.enemies.find((enemy) => enemy.currentHp > 0);
      if (!target) {
        await finishBattle(session);
        return;
      }
      const damages = applyPlayerNormalAttack(session, player, target);
      recordCombatAction(session, player, [target.id]);
      session.log = `${player.name}が${target.name}に${damages.join("、")}ダメージ`;
      session.log += await applyBurnAfterAction(session, player);
      if (session.enemies.every((enemy) => enemy.currentHp === 0)) await finishBattle(session);
      return;
    }
    session.battlePhase = "enemies";
    session.battleTurnIndex = 0;
  }

  const enemyActionCount = session.dungeon?.bossActive ? session.enemies.length * 2 : session.enemies.length;
  while (session.battleTurnIndex < enemyActionCount) {
    const enemy = session.enemies[session.battleTurnIndex % session.enemies.length];
    session.battleTurnIndex += 1;
    if (enemy.currentHp === 0) continue;
    const targets = activePlayers(session);
    if (targets.length === 0) return;
    const skillIndex = chooseEnemySkillIndex(enemy, session.dungeon?.bossActive === true);
    if (skillIndex === null) await executeEnemyNormalAttack(session, enemy, targets);
    else await executeEnemySkill(session, enemy, skillIndex, targets);
    if (session.enemies.every((entry) => entry.currentHp === 0)) await finishBattle(session);
    return;
  }

  const nextRoundPlayers = activePlayers(session);
  session.battlePhase = "players";
  session.battlePlayerOrder = nextRoundPlayers.slice().sort((left, right) => right.luck - left.luck || left.joinedAt - right.joinedAt || left.id.localeCompare(right.id)).map((player) => player.id);
  session.battleTurnIndex = 0;
  if (session.battlePlayerOrder.length > 0) {
    const player = nextRoundPlayers.find((entry) => entry.id === session.battlePlayerOrder[0]);
    session.battleTurnIndex = 1;
    if (!player) return;
    if (actionBlockedByStatus(player)) {
      session.log = `${player.name}は${player.statusEffect}状態で行動できません`;
      consumeBlockedStatusTurn(player);
      return;
    }
    const target = session.enemies.find((enemy) => enemy.currentHp > 0);
    if (!target) {
      await finishBattle(session);
      return;
    }
    const damages = applyPlayerNormalAttack(session, player, target);
    recordCombatAction(session, player, [target.id]);
    session.log = `${player.name}が${target.name}に${damages.join("、")}ダメージ`;
    session.log += await applyBurnAfterAction(session, player);
    if (session.enemies.every((enemy) => enemy.currentHp === 0)) await finishBattle(session);
  }
}

async function advance(session: Session) {
  if (connectedPlayers(session).length === 0) {
    resetSessionState(session);
    return;
  }
  const now = Date.now();
  if (session.dungeon?.returnAt) {
    session.countdown = Math.max(0, Math.ceil((session.dungeon.returnAt - now) / 1000));
    if (now >= session.dungeon.returnAt) {
      session.forcedReturnPlayerIds = connectedPlayers(session).map((player) => player.id);
      session.log = "ダンジョンアタックが完了し、PT全員が街へ帰還しました";
    }
    return;
  }
  if (session.dungeon && !session.dungeon.started) return;
  if (session.event?.id === "sealedChest" && session.eventStartedAt !== null && now - session.eventStartedAt >= CHEST_TIMEOUT_MS) {
    session.forcedReturnPlayerIds = connectedPlayers(session).map((player) => player.id);
    session.event = null;
    session.eventStartedAt = null;
    session.countdown = 10;
    session.log = "宝箱が5分間放置されたため、探索隊は街へ帰還しました";
    return;
  }
  let steps = 0;
  while (session.nextTickAt <= now && steps < 5) {
    session.nextTickAt += TICK_MS;
    steps += 1;
    if (session.event?.id === "sealedChest") {
      if (session.countdown > 1) session.countdown -= 1;
      else {
        session.countdown = 0;
        const player = highestLuckPlayer(activePlayers(session));
        if (player) await resolveTreasureEvent(session, player, true);
      }
      continue;
    }
    if (session.event) continue;
    if (session.battleActive) await battleTick(session);
    else if (session.countdown > 1) session.countdown -= 1;
    else {
      session.countdown = 0;
      await startEncounter(session);
    }
  }
}

async function snapshot(session: Session, userId?: string) {
  await advance(session);
  const portalState = userId ? await readPortalAccountState(userId) : undefined;
  return {
    sessionId: session.id,
    countdown: session.countdown,
    eventCount: session.eventCount,
    battleActive: session.battleActive,
    enemies: session.enemies,
    event: session.event,
    forcedReturnPlayerIds: session.forcedReturnPlayerIds,
    log: session.log,
    players: connectedPlayers(session).map((player) => ({
      id: player.id,
      name: player.name,
      job: player.job,
      level: player.level,
      hp: player.hp,
      maxHp: player.maxHp,
      statusEffect: player.statusEffect ?? null,
      atk: effectiveAttack(session, player),
      def: player.def,
      luck: player.luck,
      skillLevels: player.skillLevels,
      cardinalLevels: player.cardinalLevels,
      equippedCardinal: player.equippedCardinal,
      equippedWeapon: player.equippedWeapon,
      equippedArmor: player.equippedArmor,
      equippedWeaponHighQuality: player.equippedWeaponHighQuality,
      equippedArmorHighQuality: player.equippedArmorHighQuality,
      treasureHunt: player.treasureHunt,
      autoHealLevel: player.autoHealLevel,
      autoHealRecovery: player.autoHealRecovery,
      autoResurrectLevel: player.autoResurrectLevel,
      autoResurrectUses: player.autoResurrectUses,
      divineDevotionLevel: player.divineDevotionLevel,
      divineDevotionAtkBonus: player.divineDevotionActive ? player.divineDevotionAtkBonus : 0,
      strongDutyLevel: player.strongDutyLevel,
      strongDutyThreatMultiplier: player.strongDutyActive ? player.strongDutyThreatMultiplier : 1,
      strongDutyDamageReduction: player.strongDutyActive ? player.strongDutyDamageReduction : 0,
      counterAttackRate: player.counterAttackRate,
      evasionRate: player.evasionRate,
      safeFleeLevel: player.safeFleeLevel,
      falsePraiseLevel: player.falsePraiseLevel,
      falsePraiseUses: player.falsePraiseUses,
      icon: player.icon,
      joinedAt: player.joinedAt,
      waiting: player.waiting,
    })),
    result: session.result,
    combatActions: session.combatActions,
    dungeon: session.dungeon ? { ...session.dungeon, returnRemaining: session.dungeon.returnAt ? Math.max(0, Math.ceil((session.dungeon.returnAt - Date.now()) / 1000)) : null } : null,
    serverTime: Date.now(),
    portalRates: portalState?.portalRates,
    portalKeyInventory: portalState?.portalKeyInventory,
  };
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  if (searchParams.get("populations") === "1") {
    const user = await getCurrentUser();
    const portalState = user ? await readPortalAccountState(user.id) : undefined;
    for (const session of [...sessions.values()]) await removeExpiredPlayers(session);
    const populations = Object.fromEntries(Object.keys(MAPS).map((code) => {
      const session = sessions.get(`explore:${code}`);
      return [code, session ? connectedPlayers(session).length : 0];
    }));
    const dungeonParties = [...sessions.values()]
      .filter((session) => session.dungeon && !session.dungeon.started)
      .map((session) => {
        const players = connectedPlayers(session);
        const host = players.find((player) => player.id === session.dungeon?.hostClientId);
        return {
          map: session.map,
          color: session.dungeon!.color,
          level: session.dungeon!.level,
          hostName: host?.name ?? "冒険者",
          memberCount: players.length,
          maxMembers: 4,
        };
      });
    return Response.json({ populations, dungeonParties, portalRates: portalState?.portalRates, portalKeyInventory: portalState?.portalKeyInventory }, { headers: { "cache-control": "no-store" } });
  }
  const map = searchParams.get("map");
  if (!validMap(map)) return Response.json({ error: "マップ指定が不正です" }, { status: 400 });
  const user = await getCurrentUser();
  let session = getSession(map);
  await removeExpiredPlayers(session);
  session = sessions.get(map) ?? getSession(map);
  return Response.json(await snapshot(session, user?.id), { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || !validMap(body.map) || typeof body.clientId !== "string") return Response.json({ error: "リクエストが不正です" }, { status: 400 });
  if (body.leave === true) {
    const leavingSession = sessions.get(body.map);
    if (leavingSession) await removePlayer(leavingSession, body.clientId, user.id);
    return Response.json({ ok: true });
  }
  let session = getSession(body.map);
  await removeExpiredPlayers(session);
  session = sessions.get(body.map) ?? getSession(body.map);
  if (body.action === "heartbeat" && connectedPlayers(session).length === 0) {
    sessions.delete(body.map);
    session = getSession(body.map);
  }
  await advance(session);
  const action = body.action;
  let skillUsage: SkillUsageSnapshot | undefined;
  let skillActionApplied: boolean | undefined;
  let skillActionError: string | undefined;
  if (action === "heartbeat") {
    const current = session.players.get(body.clientId);
    if (current && current.userId !== user.id) return Response.json({ error: "探索セッションの所有者が一致しません" }, { status: 403 });
    if (session.dungeon && !current) {
      if (session.dungeon.started) return Response.json({ error: "開始済みのダンジョンには途中参加できません" }, { status: 403 });
      if (connectedPlayers(session).length >= 4) return Response.json({ error: "このPTは満員です" }, { status: 409 });
    }
    skillUsage = session.dungeon?.started && current
      ? { skillUses: (session.dungeonSkillUses?.[current.id] ?? {}) as SkillUsageSnapshot["skillUses"], skillUsesResetAt: null, serverTime: Date.now() }
      : await getSkillUsage(user.id);
    const level = typeof body.level === "number" ? Math.max(1, Math.min(100, Math.floor(body.level))) : current?.level ?? 1;
    const maxHp = typeof body.maxHp === "number" ? Math.max(1, Math.min(1_000_000, Math.floor(body.maxHp))) : current?.maxHp ?? 100;
    const skillLevels = profileSkillLevels(body.skillLevels);
    const cardinalLevels = profileCardinalLevels(body.cardinalLevels);
    const equippedCardinal = cardinalId(body.equippedCardinal);
    const transformed = current?.cardinalTransformed === true && session.battleActive;
    const baseAtk = transformed ? current.baseAtk : typeof body.atk === "number" ? Math.max(1, Math.min(1_000_000, Math.floor(body.atk))) : current?.baseAtk ?? current?.atk ?? level * 4;
    const autoHealLevel = typeof body.autoHealLevel === "number" ? Math.max(0, Math.min(5, Math.floor(body.autoHealLevel))) : current?.autoHealLevel ?? 0;
    const divineDevotionLevel = typeof body.divineDevotionLevel === "number" ? Math.max(0, Math.min(1, Math.floor(body.divineDevotionLevel))) : current?.divineDevotionLevel ?? 0;
    const strongDutyLevel = typeof body.strongDutyLevel === "number" ? Math.max(0, Math.min(1, Math.floor(body.strongDutyLevel))) : current?.strongDutyLevel ?? 0;
    const counterAttackRate = typeof body.counterAttackRate === "number" ? Math.max(0, Math.min(WARRIOR_COUNTER_RATE_PER_LEVEL * 5, body.counterAttackRate)) : current?.counterAttackRate ?? 0;
    const evasionRate = typeof body.evasionRate === "number" ? Math.max(0, Math.min(THIEF_EVASION_RATE_PER_LEVEL * 5, body.evasionRate)) : current?.evasionRate ?? 0;
    const safeFleeLevel = typeof body.safeFleeLevel === "number" ? Math.max(0, Math.min(1, Math.floor(body.safeFleeLevel))) : current?.safeFleeLevel ?? 0;
    const iconRecord = await prisma.crocsiansCharacterIcon.findUnique({ where: { userId: user.id }, select: { updatedAt: true } });
    const serverIcon = iconRecord ? `/api/crocsians/icon?userId=${encodeURIComponent(user.id)}&v=${iconRecord.updatedAt.getTime()}` : null;
    session.players.set(body.clientId, {
      id: body.clientId,
      userId: user.id,
      name: typeof body.name === "string" ? body.name.slice(0, 16) : current?.name ?? "冒険者",
      job: typeof body.job === "string" ? body.job.slice(0, 12) : current?.job ?? "冒険者",
      level,
      hp: Math.min(transformed ? current.maxHp : maxHp, current?.hp ?? (typeof body.hp === "number" ? Math.max(0, Math.floor(body.hp)) : maxHp)),
      maxHp: transformed ? current.maxHp : maxHp,
      atk: baseAtk,
      offhandAtk: typeof body.offhandAtk === "number" ? Math.max(0, Math.min(1_000_000, Math.floor(body.offhandAtk))) : current?.offhandAtk ?? 0,
      baseAtk,
      def: transformed ? current.def : typeof body.def === "number" ? Math.max(0, Math.min(1_000_000, Math.floor(body.def))) : current?.def ?? level * 3,
      luck: transformed ? current.luck : typeof body.luck === "number" ? Math.max(1, Math.min(1_000_000, Math.floor(body.luck))) : current?.luck ?? level * 2,
      skillLevels,
      cardinalLevels,
      equippedCardinal: equippedCardinal && (cardinalLevels[equippedCardinal] ?? 0) > 0 ? equippedCardinal : null,
      equippedWeapon: equipmentName(body.equippedWeapon),
      equippedArmor: equipmentName(body.equippedArmor),
      equippedWeaponHighQuality: body.equippedWeaponHighQuality === true,
      equippedArmorHighQuality: body.equippedArmorHighQuality === true,
      treasureHunt: typeof body.treasureHunt === "number" ? Math.max(0, Math.min(5, Math.floor(body.treasureHunt))) : current?.treasureHunt ?? 0,
      treasureDisarmBonus: typeof body.treasureDisarmBonus === "number" ? Math.max(0, Math.min(100, Math.floor(body.treasureDisarmBonus))) : current?.treasureDisarmBonus ?? 0,
      damageReduction: typeof body.damageReduction === "number" ? Math.max(0, Math.min(0.8, body.damageReduction)) : current?.damageReduction ?? 0,
      autoHealLevel,
      autoHealRecovery: Math.floor(level * autoHealLevel * PRIEST_AUTO_HEAL_RECOVERY_MULTIPLIER),
      autoResurrectLevel: typeof body.autoResurrectLevel === "number" ? Math.max(0, Math.min(5, Math.floor(body.autoResurrectLevel))) : current?.autoResurrectLevel ?? 0,
      autoResurrectUses: skillUsage.skillUses.autoResurrect ?? 0,
      divineDevotionLevel,
      divineDevotionAtkBonus: Math.max(0, baseAtk - 1),
      divineDevotionActive: current?.divineDevotionActive ?? false,
      divineDevotionTargetId: current?.divineDevotionTargetId ?? null,
      strongDutyLevel,
      strongDutyThreatMultiplier: WARRIOR_STRONG_DUTY_THREAT_MULTIPLIER,
      strongDutyDamageReduction: WARRIOR_STRONG_DUTY_DAMAGE_REDUCTION,
      strongDutyActive: current?.strongDutyActive ?? false,
      counterAttackRate,
      evasionRate,
      safeFleeLevel,
      falsePraiseLevel: typeof body.falsePraiseLevel === "number" ? Math.max(0, Math.min(5, Math.floor(body.falsePraiseLevel))) : current?.falsePraiseLevel ?? 0,
      falsePraiseUses: skillUsage.skillUses.falsePraise ?? 0,
      goldBonus: typeof body.goldBonus === "number" ? Math.max(0, Math.min(1, body.goldBonus)) : current?.goldBonus ?? 0,
      rareDropBonus: typeof body.rareDropBonus === "number" ? Math.max(0, Math.min(0.1, body.rareDropBonus)) : current?.rareDropBonus ?? 0,
      cardinalStatusResist: typeof body.cardinalStatusResist === "number" ? Math.max(0, Math.min(0.8, body.cardinalStatusResist)) : current?.cardinalStatusResist ?? 0,
      cardinalAccuracyBonus: typeof body.cardinalAccuracyBonus === "number" ? Math.max(0, Math.min(0.5, body.cardinalAccuracyBonus)) : current?.cardinalAccuracyBonus ?? 0,
      cardinalBarrier: current?.cardinalBarrier ?? false,
      cardinalTransformed: current?.cardinalTransformed ?? false,
      cardinalStarCrownUsed: current?.cardinalStarCrownUsed ?? false,
      weaponSe: body.weaponSe === "slash" || body.weaponSe === "slash2" || body.weaponSe === "strike" || body.weaponSe === "magic" || body.weaponSe === "dark-magic" || body.weaponSe === "dark-magic2" ? body.weaponSe : "blow",
      icon: serverIcon,
      joinedAt: current?.joinedAt ?? Date.now(),
      updatedAt: Date.now(),
      waiting: current?.waiting ?? (session.battleActive || session.event !== null),
    });
    if (session.dungeon && !session.dungeon.hostClientId) {
      session.dungeon.hostClientId = body.clientId;
      session.log = `${typeof body.name === "string" ? body.name.slice(0, 16) : "冒険者"}がPT募集を開始しました`;
    }
  } else if (action === "startDungeon") {
    const player = session.players.get(body.clientId);
    if (!session.dungeon || !player || session.dungeon.hostClientId !== body.clientId) {
      return Response.json({ error: "ホストのみダンジョンアタックを開始できます" }, { status: 403 });
    }
    if (session.dungeon.started) return Response.json(await snapshot(session, user.id));
    const storageLevel = DUNGEON_LEVEL_TO_PORTAL_LEVEL[session.dungeon.level];
    const consumedKeys = await consumePortalKeys(user.id, session.dungeon.color, storageLevel, 4);
    if (!consumedKeys) {
      return Response.json({ error: "ダンジョンアタック開始にはホストの転移キーが4本必要です" }, { status: 409 });
    }
    session.dungeon.started = true;
    session.dungeonSkillUses = {};
    session.countdown = 3;
    session.nextTickAt = Date.now() + TICK_MS;
    session.log = `${player.name}がダンジョンアタックを開始しました`;
    for (const member of session.players.values()) {
      member.waiting = false;
      member.hp = member.maxHp;
      member.joinedAt = Date.now();
    }
  } else if (action === "kickDungeonMember") {
    const targetClientId = typeof body.targetClientId === "string" ? body.targetClientId : "";
    if (!session.dungeon || session.dungeon.hostClientId !== body.clientId) return Response.json({ error: "ホストのみPTメンバーを除外できます" }, { status: 403 });
    if (session.dungeon.started) return Response.json({ error: "ダンジョンアタック開始後は除外できません" }, { status: 409 });
    if (targetClientId && targetClientId !== session.dungeon.hostClientId) {
      session.forcedReturnPlayerIds.push(targetClientId);
      session.players.delete(targetClientId);
      session.log = "ホストがPTメンバーを除外しました";
    }
  } else if (!session.players.has(body.clientId)) {
    return Response.json({ error: "探索セッションに参加していません" }, { status: 403 });
  } else if (session.players.get(body.clientId)?.waiting) {
    return Response.json({ error: "現在のイベント終了まで待機中です" }, { status: 409 });
  } else if (action === "skill") {
    const player = session.players.get(body.clientId)!;
    const skillId = typeof body.skillId === "string" ? body.skillId : null;
    const warriorDamageSkillIds = ["powerStrike", "sweepingBlow", "rageStrike", "flurry"];
    if (actionBlockedByStatus(player)) {
      skillActionApplied = false;
      skillActionError = `${player.statusEffect}状態のため行動できません`;
      consumeBlockedStatusTurn(player);
      skillUsage = await getSkillUsage(user.id);
    } else if (!session.battleActive) {
      skillActionApplied = false;
      skillActionError = "戦闘中ではありません";
      skillUsage = await getSkillUsage(user.id);
    } else if (skillId === "moneyStrike") {
      if (player.job !== "商人") {
        skillActionApplied = false;
        skillActionError = "札束で殴るは商人専用です";
        skillUsage = await getSkillUsage(user.id);
      } else {
        const usage = await consumePlayerTrackedSkillUse(session, player, user.id, "moneyStrike");
        skillUsage = usage;
        skillActionApplied = usage.allowed;
        if (!usage.allowed) skillActionError = usage.skillLevel === 0 ? "札束で殴るを習得していません" : "札束で殴るの使用回数がありません";
        else {
          const target = session.enemies.find((enemy) => enemy.currentHp > 0)!;
          const gold = await accountGold(user.id);
          const thresholds = [100_000, 500_000, 1_000_000, 3_000_000, 10_000_000];
          const maximums = [2, 2.3, 2.7, 3.1, 3.5];
          const multiplier = 1 + (maximums[usage.skillLevel - 1] - 1) * Math.min(1, gold / thresholds[usage.skillLevel - 1]);
          const damage = calculateDamage(effectiveAttack(session, player), target.def, multiplier);
          target.currentHp = Math.max(0, target.currentHp - damage);
          recordCombatAction(session, player, [target.id]);
          session.log = `${player.name}が札束で殴り、${target.name}に${damage}ダメージ（所持${gold}G）`;
          if (session.enemies.every((enemy) => enemy.currentHp === 0)) await finishBattle(session);
        }
      }
    } else if (skillId === "brightenUp") {
      const targets = activePlayers(session);
      const level = Math.max(0, Math.min(5, Math.floor(player.skillLevels.brightenUp ?? 0)));
      const cost = [1_000, 5_000, 10_000, 30_000, 100_000][level - 1] ?? Number.MAX_SAFE_INTEGER;
      if (player.job !== "商人") {
        skillActionApplied = false;
        skillActionError = "どうだ明るくなったろうは商人専用です";
        skillUsage = await getSkillUsage(user.id);
      } else if (targets.every((target) => target.hp >= target.maxHp)) {
        skillActionApplied = false;
        skillActionError = "回復対象がいません";
        skillUsage = await getSkillUsage(user.id);
      } else if (await accountGold(user.id) < cost) {
        skillActionApplied = false;
        skillActionError = "GOLDが不足しています";
        skillUsage = await getSkillUsage(user.id);
      } else {
        const usage = await consumePlayerTrackedSkillUse(session, player, user.id, "brightenUp");
        skillUsage = usage;
        skillActionApplied = usage.allowed;
        if (!usage.allowed) skillActionError = usage.skillLevel === 0 ? "どうだ明るくなったろうを習得していません" : "どうだ明るくなったろうの使用回数がありません";
        else if (!await consumeAccountGold(user.id, cost)) {
          skillActionApplied = false;
          skillActionError = "GOLDが不足しています";
        } else {
          const amount = Math.floor(player.level * usage.skillLevel * 0.5);
          for (const target of targets) target.hp = Math.min(target.maxHp, target.hp + amount);
          session.log = `${player.name}が${cost}Gを燃やし、探索隊全員のHPを${amount}回復しました`;
        }
      }
    } else if (skillId && warriorDamageSkillIds.includes(skillId)) {
      if (player.job !== "戦士") {
        skillActionApplied = false;
        skillActionError = "この戦闘スキルは戦士専用です";
        skillUsage = await getSkillUsage(user.id);
      } else {
        const usage = await consumePlayerTrackedSkillUse(session, player, user.id, skillId);
        skillUsage = usage;
        skillActionApplied = usage.allowed;
        if (!usage.allowed) skillActionError = usage.skillLevel === 0 ? "スキルを習得していません" : "スキルの使用回数がありません";
        else if (skillId === "flurry") {
          const damages: number[] = [];
          const targetIds: number[] = [];
          const multiplier = 0.65 + (usage.skillLevel - 1) * 0.15;
          for (let attack = 0; attack < 4; attack += 1) {
            const living = session.enemies.filter((enemy) => enemy.currentHp > 0);
            if (living.length === 0) break;
            const target = living[Math.floor(Math.random() * living.length)];
            const damage = calculateDamage(effectiveAttack(session, player), target.def, multiplier);
            target.currentHp = Math.max(0, target.currentHp - damage);
            damages.push(damage);
            targetIds.push(target.id);
          }
          recordCombatAction(session, player, targetIds);
          session.log = `${player.name}が無双乱撃で${damages.join("、")}ダメージ`;
          if (session.enemies.every((enemy) => enemy.currentHp === 0)) await finishBattle(session);
        } else {
          const multiplier = skillId === "rageStrike"
            ? (1.4 + (1 - player.hp / player.maxHp) * 1.6) * (1 + (usage.skillLevel - 1) * 0.15)
            : (skillId === "powerStrike" ? 1.8 : 0.9) * (1 + (usage.skillLevel - 1) * 0.2);
          const targets = skillId === "sweepingBlow" ? session.enemies.filter((enemy) => enemy.currentHp > 0) : session.enemies.filter((enemy) => enemy.currentHp > 0).slice(0, 1);
          const damages = targets.map((enemy) => {
            const damage = calculateDamage(effectiveAttack(session, player), enemy.def, multiplier);
            enemy.currentHp = Math.max(0, enemy.currentHp - damage);
            return damage;
          });
          recordCombatAction(session, player, targets.map((enemy) => enemy.id));
          session.log = `${player.name}がスキルで${damages.join("、")}ダメージ`;
          if (session.enemies.every((enemy) => enemy.currentHp === 0)) await finishBattle(session);
        }
      }
    } else if (skillId === "strongDuty") {
      if (player.job !== "戦士" || player.strongDutyLevel < 1) {
        skillActionApplied = false;
        skillActionError = "強者の務めは戦士専用です";
        skillUsage = await getSkillUsage(user.id);
      } else {
        const usage = await consumePlayerTrackedSkillUse(session, player, user.id, "strongDuty");
        skillUsage = usage;
        skillActionApplied = usage.allowed;
        if (!usage.allowed) skillActionError = usage.skillLevel === 0 ? "強者の務めを習得していません" : "強者の務めの使用回数がありません";
        else {
          player.strongDutyActive = true;
          player.strongDutyLevel = 1;
          player.strongDutyThreatMultiplier = WARRIOR_STRONG_DUTY_THREAT_MULTIPLIER;
          player.strongDutyDamageReduction = WARRIOR_STRONG_DUTY_DAMAGE_REDUCTION;
          session.log = `${player.name}が強者の務めを発動。単体攻撃を引き受けやすくなり、受けるダメージを10%軽減します`;
        }
      }
    } else if (skillId === "divineDevotion") {
      const targets = activePlayers(session).filter((candidate) => candidate.id !== player.id);
      const target = targets.slice().sort((left, right) => effectiveAttack(session, right) - effectiveAttack(session, left) || left.joinedAt - right.joinedAt || left.id.localeCompare(right.id))[0];
      if (player.job !== "僧侶" || player.divineDevotionLevel < 1) {
        skillActionApplied = false;
        skillActionError = "御心による献身は僧侶専用です";
        skillUsage = await getSkillUsage(user.id);
      } else if (!target) {
        skillActionApplied = false;
        skillActionError = "ATKを上乗せする対象がいません";
        skillUsage = await getSkillUsage(user.id);
      } else {
        const usage = await consumePlayerTrackedSkillUse(session, player, user.id, "divineDevotion");
        skillUsage = usage;
        skillActionApplied = usage.allowed;
        if (!usage.allowed) skillActionError = usage.skillLevel === 0 ? "御心による献身を習得していません" : "御心による献身の使用回数がありません";
        else {
          const donation = Math.max(0, (Number.isFinite(player.baseAtk) ? player.baseAtk : player.atk) - 1);
          player.divineDevotionActive = true;
          player.divineDevotionTargetId = target.id;
          player.divineDevotionAtkBonus = donation;
          session.log = `${player.name}が御心による献身を発動。自身のATKを1にし、${target.name}へATK+${donation}を上乗せしました`;
        }
      }
    } else if (skillId === "trapDisarm") {
      if (player.job !== "盗賊") {
        skillActionApplied = false;
        skillActionError = "盗人の眼力は盗賊専用です";
        skillUsage = await getSkillUsage(user.id);
      } else {
        const usage = await consumePlayerTrackedSkillUse(session, player, user.id, "trapDisarm");
        skillUsage = usage;
        skillActionApplied = usage.allowed;
        if (!usage.allowed) skillActionError = usage.skillLevel === 0 ? "盗人の眼力を習得していません" : "盗人の眼力の使用回数がありません";
        else {
          const bonus = usage.skillLevel * 0.04;
          session.thiefEyeRareDropBonus = Math.max(session.thiefEyeRareDropBonus ?? 0, bonus);
          session.log = `${player.name}が盗人の眼力を発動。戦闘中の全員のレアドロップ率が${Math.round((session.thiefEyeRareDropBonus ?? 0) * 100)}%上昇します`;
        }
      }
    } else if (skillId === "dangerSense") {
      const target = session.enemies.find((enemy) => enemy.currentHp > 0);
      if (player.job !== "盗賊") {
        skillActionApplied = false;
        skillActionError = "クリティカルフットは盗賊専用です";
        skillUsage = await getSkillUsage(user.id);
      } else if (!target) {
        skillActionApplied = false;
        skillActionError = "攻撃対象がいません";
        skillUsage = await getSkillUsage(user.id);
      } else {
        const usage = await consumePlayerTrackedSkillUse(session, player, user.id, "dangerSense");
        skillUsage = usage;
        skillActionApplied = usage.allowed;
        if (!usage.allowed) skillActionError = usage.skillLevel === 0 ? "クリティカルフットを習得していません" : "クリティカルフットの使用回数がありません";
        else {
          const successRate = usage.skillLevel * 0.15;
          const success = Math.random() < successRate;
          const damage = success ? calculateDamage(effectiveAttack(session, player), target.def, 3) : 1;
          target.currentHp = Math.max(0, target.currentHp - damage);
          recordCombatAction(session, player, [target.id]);
          session.log = success
            ? `${player.name}がクリティカルフットに成功し、${target.name}に${damage}ダメージ`
            : `${player.name}のクリティカルフットは空振りし、${target.name}に1ダメージ`;
          if (session.enemies.every((enemy) => enemy.currentHp === 0)) await finishBattle(session);
        }
      }
    } else if (skillId === "safeFlee") {
      if (player.job !== "盗賊" || player.safeFleeLevel < 1) {
        skillActionApplied = false;
        skillActionError = "逃げるがマシは盗賊専用です";
        skillUsage = await getSkillUsage(user.id);
      } else if (session.dungeon?.bossActive) {
        skillActionApplied = false;
        skillActionError = "ダンジョンボス戦では逃げるがマシは発動できません";
        skillUsage = await getSkillUsage(user.id);
      } else {
        const usage = await consumePlayerTrackedSkillUse(session, player, user.id, "safeFlee");
        skillUsage = usage;
        skillActionApplied = usage.allowed;
        if (!usage.allowed) skillActionError = usage.skillLevel === 0 ? "逃げるがマシを習得していません" : "逃げるがマシの使用回数がありません";
        else {
          const escapedPlayers = activePlayers(session).map((entry) => entry.name).join("、");
          session.battleActive = false;
          session.enemies = [];
          session.battlePlayerOrder = [];
          session.battleTurnIndex = 0;
          session.countdown = 6 + Math.floor(Math.random() * 6);
          createResult(session, { message: `${player.name}が逃げるがマシを発動。${escapedPlayers || "探索隊"}は敵から逃走しました` });
          clearTemporaryBattleSkills(session);
          activateWaitingPlayers(session);
        }
      }
    } else if (skillId && (CARDINAL_SKILL_IDS as readonly string[]).includes(skillId)) {
      const cardinal = CARDINAL_SKILL_TO_ID[skillId as keyof typeof CARDINAL_SKILL_TO_ID];
      const cardinalLevel = player.equippedCardinal === cardinal ? player.cardinalLevels[cardinal] ?? 0 : 0;
      if (cardinalLevel < 1) {
        skillActionApplied = false;
        skillActionError = "対応する枢機卿を装備していません";
        skillUsage = await getSkillUsage(user.id);
      } else if (skillId === "starCrown" && player.cardinalStarCrownUsed) {
        skillActionApplied = false;
        skillActionError = "宇宙からの宝冠は一度の戦闘で一度のみ使用できます";
        skillUsage = await getSkillUsage(user.id);
      } else if (skillId === "borrowPower" && player.cardinalTransformed) {
        skillActionApplied = false;
        skillActionError = "少し力を貸せは一度の戦闘で一度のみ使用できます";
        skillUsage = await getSkillUsage(user.id);
      } else if (skillId === "borrowPower" && !activePlayers(session).some((candidate) => candidate.id === body.targetPlayerId && candidate.id !== player.id)) {
        skillActionApplied = false;
        skillActionError = "変身対象がいません";
        skillUsage = await getSkillUsage(user.id);
      } else if (skillId === "eternalMercy") {
        skillActionApplied = false;
        skillActionError = "慈悲よ永久には戦闘後に自動発動します";
        skillUsage = await getSkillUsage(user.id);
      } else {
        const usage = await consumePlayerTrackedSkillUse(session, player, user.id, skillId);
        skillUsage = usage;
        skillActionApplied = usage.allowed;
        if (!usage.allowed) skillActionError = usage.skillLevel === 0 ? "枢機卿スキルを使用できません" : "枢機卿スキルの使用回数がありません";
        else if (skillId === "bloodWine") {
          const target = session.enemies.find((enemy) => enemy.currentHp > 0);
          if (!target) skillActionError = "攻撃対象がいません";
          else {
            const multiplier = 1 + cardinalLevel * 0.2;
            const damage = calculateDamage(effectiveAttack(session, player), target.def, multiplier);
            target.currentHp = Math.max(0, target.currentHp - damage);
            player.hp = Math.min(player.maxHp, player.hp + Math.floor(damage * 0.3));
            recordCombatAction(session, player, [target.id]);
            session.log = `${player.name}が返り血をワインにを発動し、${target.name}に${damage}ダメージ。HPを${Math.floor(damage * 0.3)}回復しました`;
            if (session.enemies.every((enemy) => enemy.currentHp === 0)) await finishBattle(session);
          }
        } else if (skillId === "holyBread") {
          for (const target of activePlayers(session)) target.cardinalBarrier = true;
          session.log = `${player.name}がパンを神の子の肉にを発動。探索者全員に一度きりのバリアを付与しました`;
        } else if (skillId === "starCrown") {
          const target = session.enemies.find((enemy) => enemy.currentHp > 0);
          if (!target) skillActionError = "攻撃対象がいません";
          else {
            const multiplier = 1 + 0.02 * cardinalLevel * (session.playerSkillUseCount ?? 0);
            const damage = calculateDamage(effectiveAttack(session, player), target.def, multiplier);
            target.currentHp = Math.max(0, target.currentHp - damage);
            player.cardinalStarCrownUsed = true;
            recordCombatAction(session, player, [target.id]);
            session.log = `${player.name}が宇宙からの宝冠を発動し、${target.name}に${damage}ダメージ（スキル使用${session.playerSkillUseCount ?? 0}回）`;
            if (session.enemies.every((enemy) => enemy.currentHp === 0)) await finishBattle(session);
          }
        } else if (skillId === "borrowPower") {
          const targetId = typeof body.targetPlayerId === "string" ? body.targetPlayerId : "";
          const target = activePlayers(session).find((candidate) => candidate.id === targetId && candidate.id !== player.id);
          if (!target) {
            skillActionApplied = false;
            skillActionError = "変身対象がいません";
          } else {
            player.maxHp = target.maxHp;
            player.hp = Math.min(player.hp, player.maxHp);
            player.atk = target.atk;
            player.baseAtk = Number.isFinite(target.baseAtk) ? target.baseAtk : target.atk;
            player.def = target.def;
            player.luck = target.luck;
            player.cardinalTransformed = true;
            session.log = `${player.name}が少し力を貸せを発動し、${target.name}のステータスを写し取りました`;
          }
        }
      }
    } else {
      skillActionApplied = false;
      skillActionError = "このスキルは使用できません";
      skillUsage = await getSkillUsage(user.id);
    }
  } else if (action === "potion") {
    const player = session.players.get(body.clientId)!;
    if (session.dungeon) {
      skillActionApplied = false;
      skillActionError = "ダンジョンアタック中は回復薬を使用できません";
      skillUsage = await getSkillUsage(user.id);
    } else {
      player.hp = Math.min(player.maxHp, player.hp + 28);
      session.log = `${player.name}が回復薬を使い、HPを28回復しました`;
    }
  } else if (action === "heal") {
    const caster = session.players.get(body.clientId)!;
    const targetId = typeof body.targetPlayerId === "string" ? body.targetPlayerId : body.clientId;
    const target = activePlayers(session).find((player) => player.id === targetId);
    if (actionBlockedByStatus(caster)) {
      skillActionApplied = false;
      skillActionError = `${caster.statusEffect}状態のため行動できません`;
      consumeBlockedStatusTurn(caster);
      skillUsage = await getSkillUsage(user.id);
    } else if (caster.job !== "僧侶" || !target || target.hp >= target.maxHp) {
      skillActionApplied = false;
      skillActionError = caster.job !== "僧侶" ? "このスキルは僧侶専用です" : "回復対象がいません";
      skillUsage = await getSkillUsage(user.id);
    } else {
      const usage = await consumePlayerTrackedSkillUse(session, caster, user.id, "heal");
      skillUsage = usage;
      skillActionApplied = usage.allowed;
      if (!usage.allowed) skillActionError = usage.skillLevel === 0 ? "ヒールを習得していません" : "ヒールの使用回数がありません";
      else {
        const amount = Math.floor(PRIEST_HEAL_INITIAL_RECOVERY + caster.level * usage.skillLevel);
        target.hp = Math.min(target.maxHp, target.hp + amount);
        session.log = `${caster.name}が${target.name}のHPを${amount}回復しました`;
      }
    }
  } else if (action === "groupHeal") {
    const caster = session.players.get(body.clientId)!;
    const targets = activePlayers(session);
    if (actionBlockedByStatus(caster)) {
      skillActionApplied = false;
      skillActionError = `${caster.statusEffect}状態のため行動できません`;
      consumeBlockedStatusTurn(caster);
      skillUsage = await getSkillUsage(user.id);
    } else if (caster.job !== "僧侶" || targets.every((player) => player.hp >= player.maxHp)) {
      skillActionApplied = false;
      skillActionError = caster.job !== "僧侶" ? "このスキルは僧侶専用です" : "回復対象がいません";
      skillUsage = await getSkillUsage(user.id);
    } else {
      const usage = await consumePlayerTrackedSkillUse(session, caster, user.id, "groupHeal");
      skillUsage = usage;
      skillActionApplied = usage.allowed;
      if (!usage.allowed) skillActionError = usage.skillLevel === 0 ? "グループヒールを習得していません" : "グループヒールの使用回数がありません";
      else {
        const amount = Math.floor(PRIEST_GROUP_HEAL_INITIAL_RECOVERY + caster.level * usage.skillLevel * 0.5);
        for (const target of targets) target.hp = Math.min(target.maxHp, target.hp + amount);
        session.log = `${caster.name}が探索隊全員のHPを${amount}回復しました`;
      }
    }
  } else if (action === "cure") {
    const caster = session.players.get(body.clientId)!;
    if (actionBlockedByStatus(caster)) {
      skillActionApplied = false;
      skillActionError = `${caster.statusEffect}状態のため行動できません`;
      consumeBlockedStatusTurn(caster);
      skillUsage = await getSkillUsage(user.id);
    } else if (caster.job !== "僧侶") {
      skillActionApplied = false;
      skillActionError = "このスキルは僧侶専用です";
      skillUsage = await getSkillUsage(user.id);
    } else {
      const usage = await consumePlayerTrackedSkillUse(session, caster, user.id, "cure");
      skillUsage = usage;
      skillActionApplied = usage.allowed;
      if (!usage.allowed) skillActionError = usage.skillLevel === 0 ? "キュアを習得していません" : "キュアの使用回数がありません";
      else createResult(session, { message: `${caster.name}がキュアを発動し、探索隊全員の状態異常を解除しました`, clearStatus: true });
    }
  } else if (action === "enhancedTreasure" && session.event?.id === "sealedChest") {
    const player = session.players.get(body.clientId)!;
    if (player.job !== "盗賊" || player.falsePraiseLevel < 1) {
      skillActionApplied = false;
      skillActionError = "嘘っぱちの賛歌は盗賊専用です";
      skillUsage = await getSkillUsage(user.id);
    } else {
      const usage = await consumePlayerTrackedSkillUse(session, player, user.id, "falsePraise");
      skillUsage = usage;
      player.falsePraiseUses = usage.skillUses.falsePraise ?? 0;
      skillActionApplied = usage.allowed;
      if (!usage.allowed) skillActionError = usage.skillLevel === 0 ? "嘘っぱちの賛歌を習得していません" : "嘘っぱちの賛歌の使用回数がありません";
      else await resolveTreasureEvent(session, player, false, true);
    }
  } else if (action === "treasure" && session.event?.id === "sealedChest") {
    const player = session.players.get(body.clientId)!;
    await resolveTreasureEvent(session, player);
  }
  const currentPlayer = session.players.get(body.clientId);
  if (skillActionApplied === true && currentPlayer && (action === "skill" || action === "heal" || action === "groupHeal" || action === "cure")) {
    session.log += await applyBurnAfterAction(session, currentPlayer);
  }
  const latestSkillUsage = session.dungeon?.started && currentPlayer
    ? { skillUses: (session.dungeonSkillUses?.[currentPlayer.id] ?? {}) as SkillUsageSnapshot["skillUses"], skillUsesResetAt: null, serverTime: Date.now() }
    : await getSkillUsage(user.id);
  return Response.json({ ...await snapshot(session, user.id), ...skillUsage, ...latestSkillUsage, ...(skillActionApplied === undefined ? {} : { skillActionApplied, skillActionError }) });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "ログインが必要です" }, { status: 401 });
  const body = await request.json().catch(() => null) as { map?: unknown; clientId?: unknown } | null;
  if (body && validMap(body.map) && typeof body.clientId === "string") {
    const session = sessions.get(body.map);
    if (session) await removePlayer(session, body.clientId, user.id);
  }
  return Response.json({ ok: true });
}
