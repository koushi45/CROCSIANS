import { prisma } from "@/server/db/prisma";
import materialCatalog from "@/features/crocsians/materials.json";
import weaponCatalog from "@/features/crocsians/weapons.json";
import armorCatalog from "@/features/crocsians/armors.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ItemType = "MATERIAL" | "WEAPON" | "ARMOR" | "SUPPLY";
type CatalogItem = { id: number; name: string; sellPrice: number };

const catalogs: Record<ItemType, CatalogItem[]> = {
  MATERIAL: materialCatalog,
  WEAPON: weaponCatalog,
  ARMOR: armorCatalog,
  SUPPLY: [{ id: 1, name: "回復薬", sellPrice: 60 }, { id: 2, name: "免罪符", sellPrice: 1_000_000 }],
};

function taxRate(level: number) {
  const safeLevel = Math.max(1, Math.floor(level));
  const reduction = Math.min(safeLevel - 1, 4) * 0.02 + Math.max(0, Math.min(safeLevel, 10) - 5) * 0.014;
  return Math.max(1.05, Math.round((1.2 - reduction) * 100) / 100);
}

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function itemType(value: unknown): ItemType | null {
  return value === "MATERIAL" || value === "WEAPON" || value === "ARMOR" || value === "SUPPLY" ? value : null;
}

function catalogItem(type: ItemType, id: unknown) {
  if (typeof id !== "number") return null;
  return catalogs[type].find((item) => item.id === Math.floor(id)) ?? null;
}

async function marketLevel() {
  return (await prisma.crocsiansMarketSetting.upsert({ where: { id: 1 }, create: { id: 1, level: 1 }, update: {} })).level;
}

export async function GET(request: Request) {
  const playerId = text(new URL(request.url).searchParams.get("playerId"), 80);
  if (!playerId) return Response.json({ error: "プレイヤーIDが必要です" }, { status: 400 });
  const level = await marketLevel();
  const [listings, ownListings, logs, pending] = await Promise.all([
    prisma.crocsiansMarketListing.findMany({ where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.crocsiansMarketListing.findMany({ where: { sellerId: playerId }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.crocsiansTradeLog.findMany({ where: { OR: [{ sellerId: playerId }, { buyerId: playerId }] }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.crocsiansMarketListing.aggregate({ where: { sellerId: playerId, status: "SOLD", sellerClaimed: false }, _sum: { price: true } }),
  ]);
  return Response.json({ level, taxRate: taxRate(level), listings, ownListings, logs, pendingGold: pending._sum.price ?? 0 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "リクエストが不正です" }, { status: 400 });
  const action = body.action;
  const playerId = text(body.playerId, 80);
  const playerName = text(body.playerName, 16) || "冒険者";
  if (!playerId) return Response.json({ error: "プレイヤーIDが必要です" }, { status: 400 });

  if (action === "list") {
    const type = itemType(body.itemType);
    const item = type ? catalogItem(type, body.itemId) : null;
    const quantity = typeof body.quantity === "number" ? Math.max(1, Math.min(999, Math.floor(body.quantity))) : 0;
    const price = typeof body.price === "number" ? Math.floor(body.price) : 0;
    if (!type || !item || quantity < 1) return Response.json({ error: "商品指定が不正です" }, { status: 400 });
    const npcPrice = item.sellPrice * quantity;
    if (price < npcPrice) return Response.json({ error: `価格はNPC買取価格${npcPrice}G以上にしてください` }, { status: 400 });
    if (price > 1_000_000_000) return Response.json({ error: "価格が高すぎます" }, { status: 400 });
    const listing = await prisma.crocsiansMarketListing.create({ data: { sellerId: playerId, sellerName: playerName, itemType: type, itemId: item.id, itemName: item.name, quantity, price, npcPrice } });
    return Response.json({ listing }, { status: 201 });
  }

  if (action === "withdraw") {
    const listingId = text(body.listingId, 80);
    const result = await prisma.crocsiansMarketListing.updateMany({ where: { id: listingId, sellerId: playerId, status: "ACTIVE" }, data: { status: "WITHDRAWN", withdrawnAt: new Date() } });
    if (result.count !== 1) return Response.json({ error: "出品中の商品が見つかりません" }, { status: 409 });
    const listing = await prisma.crocsiansMarketListing.findUniqueOrThrow({ where: { id: listingId } });
    return Response.json({ listing });
  }

  if (action === "buy") {
    const listingId = text(body.listingId, 80);
    const buyerGold = typeof body.buyerGold === "number" ? Math.max(0, Math.floor(body.buyerGold)) : 0;
    try {
      const purchased = await prisma.$transaction(async (tx) => {
        const listing = await tx.crocsiansMarketListing.findUnique({ where: { id: listingId } });
        if (!listing || listing.status !== "ACTIVE") throw new Error("SOLD");
        if (listing.sellerId === playerId) throw new Error("SELF");
        const level = (await tx.crocsiansMarketSetting.upsert({ where: { id: 1 }, create: { id: 1, level: 1 }, update: {} })).level;
        const rate = taxRate(level);
        const buyerPaid = Math.ceil(listing.price * rate);
        if (buyerGold < buyerPaid) throw new Error("GOLD");
        const locked = await tx.crocsiansMarketListing.updateMany({ where: { id: listing.id, status: "ACTIVE" }, data: { status: "SOLD", buyerId: playerId, buyerName: playerName, taxRate: rate, buyerPaid, soldAt: new Date() } });
        if (locked.count !== 1) throw new Error("SOLD");
        await tx.crocsiansTradeLog.create({ data: { listingId: listing.id, sellerId: listing.sellerId, sellerName: listing.sellerName, buyerId: playerId, buyerName: playerName, itemType: listing.itemType, itemId: listing.itemId, itemName: listing.itemName, quantity: listing.quantity, price: listing.price, taxRate: rate, buyerPaid, taxAmount: buyerPaid - listing.price } });
        return { ...listing, taxRate: rate, buyerPaid };
      });
      return Response.json({ listing: purchased });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "GOLD") return Response.json({ error: "所持金が足りません" }, { status: 400 });
      if (message === "SELF") return Response.json({ error: "自分の出品は購入できません" }, { status: 400 });
      if (message === "SOLD") return Response.json({ error: "この商品はすでに購入または取り下げされています" }, { status: 409 });
      throw error;
    }
  }

  if (action === "claim") {
    const claimed = await prisma.$queryRaw<{ price: number }[]>`
      UPDATE "CrocsiansMarketListing"
      SET "sellerClaimed" = true
      WHERE "sellerId" = ${playerId} AND "status" = 'SOLD'::"CrocsiansMarketListingStatus" AND "sellerClaimed" = false
      RETURNING "price"
    `;
    return Response.json({ gold: claimed.reduce((sum, listing) => sum + listing.price, 0) });
  }

  return Response.json({ error: "操作が不正です" }, { status: 400 });
}
