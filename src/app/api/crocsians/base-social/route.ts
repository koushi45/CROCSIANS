import { getCurrentUser } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { getPlayerProgress } from "@/features/crocsians/progression";
import type { Prisma } from "@/generated/prisma/client";
import { SOCIAL_WORD_CATEGORIES, SOCIAL_WORD_CATEGORY_MAP, type SocialWordCategoryId } from "@/features/crocsians/social-vocabulary";
import conversationCatalog from "@/features/crocsians/social-conversations.json";
import categoryConversationCatalog from "@/features/crocsians/social-category-conversations.json";
import relationshipConversationCatalog from "@/features/crocsians/social-relationship-conversations-v2.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_STOCK_COUNT = 24;
const CRAFTING_BUILDINGS = new Set(["weapon", "armor", "apothecary", "furnace", "fountain", "garden", "gazebo", "clockTower", "monument", "pond", "marketStall", "campfire", "flowerArch", "streetLamp", "storageShed", "courtyard"]);
const SOCIAL_ACTIVITIES = ["dance", "sing", "listenSong", "speech", "listenSpeech", "nap", "workout", "talk"] as const;
type RelationshipKind = "friendship" | "rivalry" | "romance";

function renderConversationLines(lines: readonly string[], values: Record<string, string>) {
  return lines.map((line) => Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), line));
}

async function rememberWord(tx: Prisma.TransactionClient, userId: string, category: string, word: string, learnedFromUserId: string | null, favorite = false) {
  const existing = await tx.crocsiansCharacterWord.findUnique({ where: { userId_category_word: { userId, category, word } } });
  if (existing) {
    if (favorite && !existing.favorite) return tx.crocsiansCharacterWord.update({ where: { id: existing.id }, data: { favorite: true } });
    return existing;
  }
  const words = await tx.crocsiansCharacterWord.findMany({ where: { userId, category }, orderBy: { learnedAt: "asc" } });
  if (words.length >= 3) {
    const replaceable = words.find((entry) => !entry.favorite);
    if (!replaceable) return null;
    await tx.crocsiansCharacterWord.delete({ where: { id: replaceable.id } });
  }
  return tx.crocsiansCharacterWord.create({ data: { userId, category, word, learnedFromUserId, favorite } });
}

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
  const [interactions, socialRows, learnedWords, conversationRows] = await Promise.all([
    ownerIds.length ? prisma.crocsiansBaseInteraction.findMany({ where: { ownerId: { in: ownerIds } }, select: { ownerId: true, visitorId: true, liked: true, favorited: true } }) : [],
    prisma.crocsiansSocialRelationship.findMany({ orderBy: { updatedAt: "desc" }, take: 200 }),
    prisma.crocsiansCharacterWord.findMany({ where: { userId: user.id }, orderBy: { learnedAt: "desc" } }),
    prisma.crocsiansConversationLog.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
  ]);
  const personById = new Map(saves.map((save) => [save.userId, characterSummary(save.userId, save.data, save.user.crocsiansCharacterIcon?.updatedAt)]));
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
  if (selectedSave.userId === user.id) personById.set(user.id, characterSummary(user.id, selectedSave.data, selectedSave.user.crocsiansCharacterIcon?.updatedAt));

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
    relationships: socialRows.map((row) => ({
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      userId: row.fromUserId === user.id ? row.toUserId : row.fromUserId,
      friendship: row.friendship,
      rivalry: row.rivalry,
      romance: row.romance,
      interactionCount: row.interactionCount,
      lastActivity: row.lastActivity,
      lastInteractionAt: row.lastInteractionAt?.toISOString() ?? null,
      friendshipStage: row.friendshipStage,
      rivalryStage: row.rivalryStage,
      romanceStage: row.romanceStage,
      romanceActive: row.romanceActive,
      femaleRoleUserId: row.femaleRoleUserId,
      maleRoleUserId: row.maleRoleUserId,
      breakupCount: row.breakupCount,
      married: row.married,
      marriedAt: row.marriedAt?.toISOString() ?? null,
    })),
    learnedWords: learnedWords.map((entry) => ({ id: entry.id, category: entry.category, word: entry.word, favorite: entry.favorite, learnedFromUserId: entry.learnedFromUserId, learnedAt: entry.learnedAt.toISOString() })),
    conversationLogs: conversationRows.map((entry) => ({ id: entry.id, speaker: personById.get(entry.speakerId)?.name ?? "冒険者", listener: personById.get(entry.listenerId)?.name ?? "冒険者", speakerId: entry.speakerId, listenerId: entry.listenerId, category: entry.category, word: entry.word, message: entry.message, eventType: entry.eventType, relationshipKind: entry.relationshipKind, relationshipStage: entry.relationshipStage, createdAt: entry.createdAt.toISOString() })),
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
  if (action === "favoriteWord") {
    const wordId = typeof body?.wordId === "string" ? body.wordId : "";
    const word = await prisma.crocsiansCharacterWord.findFirst({ where: { id: wordId, userId: user.id } });
    if (!word) return Response.json({ error: "言葉が見つかりません。" }, { status: 404 });
    const favorite = body?.favorite === true;
    if (favorite) {
      const favoriteCount = await prisma.crocsiansCharacterWord.count({ where: { userId: user.id, category: word.category, favorite: true } });
      if (favoriteCount >= 3) return Response.json({ error: "このカテゴリーのお気に入りは3つまでです。" }, { status: 409 });
    }
    const updated = await prisma.crocsiansCharacterWord.update({ where: { id: word.id }, data: { favorite } });
    return Response.json({ ok: true, word: { id: updated.id, favorite: updated.favorite } });
  }
  if (action === "requestTeachPrompt") {
    const candidate = await prisma.crocsiansSave.findUnique({ where: { userId: user.id }, select: { userId: true, data: true, user: { select: { crocsiansCharacterIcon: { select: { updatedAt: true } } } } } });
    if (!candidate) return Response.json({ teachPrompt: null });
    const [category, categoryLabel] = SOCIAL_WORD_CATEGORIES[Math.floor(Math.random() * SOCIAL_WORD_CATEGORIES.length)];
    return Response.json({ teachPrompt: { character: characterSummary(candidate.userId, candidate.data, candidate.user.crocsiansCharacterIcon?.updatedAt), category, categoryLabel, question: `${categoryLabel}の言葉について教えて！` } });
  }
  const ownerId = typeof body?.ownerId === "string" ? body.ownerId : "";
  if (!ownerId || (ownerId === user.id && action !== "teachWord")) return Response.json({ error: "対象の拠点を指定してください。" }, { status: 400 });
  const ownerSave = await prisma.crocsiansSave.findUnique({ where: { userId: ownerId }, select: { userId: true, data: true } });
  if (!ownerSave) return Response.json({ error: "拠点が見つかりません。" }, { status: 404 });

  if (action === "teachWord") {
    const category = typeof body?.category === "string" ? body.category as SocialWordCategoryId : "";
    const word = typeof body?.word === "string" ? body.word.trim().replace(/\s+/g, " ").slice(0, 40) : "";
    if (!category || !(category in SOCIAL_WORD_CATEGORY_MAP) || !word) return Response.json({ error: "カテゴリーに合う言葉を入力してください。" }, { status: 400 });
    const learned = await prisma.$transaction((tx) => rememberWord(tx, ownerId, category, word, user.id, true));
    if (!learned) return Response.json({ error: "お気に入りの言葉を3つ覚えているため、新しい言葉を覚えられません。" }, { status: 409 });
    return Response.json({ ok: true, learned: { category, word: learned.word }, message: `「${word}」を覚えた！ 教えてくれてありがとう！` });
  }

  if (action === "socialize") {
    const actorAId = typeof body?.actorAId === "string" ? body.actorAId : user.id;
    if (actorAId === ownerId) return Response.json({ error: "交流には異なる二人を指定してください。" }, { status: 400 });
    const actorASave = actorAId === user.id ? await prisma.crocsiansSave.findUnique({ where: { userId: user.id }, select: { userId: true, data: true } }) : await prisma.crocsiansSave.findUnique({ where: { userId: actorAId }, select: { userId: true, data: true } });
    if (!actorASave) return Response.json({ error: "交流するキャラクターが見つかりません。" }, { status: 404 });
    const requested = typeof body?.activity === "string" ? body.activity : "";
    const activity = SOCIAL_ACTIVITIES.includes(requested as (typeof SOCIAL_ACTIVITIES)[number]) ? requested : SOCIAL_ACTIVITIES[Math.floor(Math.random() * SOCIAL_ACTIVITIES.length)];
    const pair = [actorAId, ownerId].sort();
    const friendly = activity === "dance" || activity === "sing" || activity === "listenSong" || activity === "listenSpeech" || activity === "nap" || activity === "talk";
    const competitive = activity === "speech" || activity === "workout";
    const romanceGain = (activity === "dance" || activity === "sing") && Math.random() < .35 ? 2 : 0;
    const relationshipKind: RelationshipKind = competitive ? "rivalry" : romanceGain > 0 ? "romance" : "friendship";
    const categoryEntry = SOCIAL_WORD_CATEGORIES[Math.floor(Math.random() * SOCIAL_WORD_CATEGORIES.length)];
    const [category, categoryLabel, samples] = categoryEntry;
    const speakerId = Math.random() < .5 ? actorAId : ownerId;
    const listenerId = speakerId === actorAId ? ownerId : actorAId;
    const [speakerSave, listenerSave, speakerWords] = await Promise.all([
      prisma.crocsiansSave.findUnique({ where: { userId: speakerId }, select: { data: true } }),
      prisma.crocsiansSave.findUnique({ where: { userId: listenerId }, select: { data: true } }),
      prisma.crocsiansCharacterWord.findMany({ where: { userId: speakerId, category }, orderBy: { learnedAt: "desc" }, take: 3 }),
    ]);
    const speakerName = characterSummary(speakerId, speakerSave?.data).name;
    const listenerName = characterSummary(listenerId, listenerSave?.data).name;
    const choices = speakerWords.length ? speakerWords.map((entry) => entry.word) : [...samples];
    const word = choices[Math.floor(Math.random() * choices.length)];
    const categoryLines = categoryConversationCatalog[category] as string[];
    const conversationLines = renderConversationLines(categoryLines, { A: speakerName, B: listenerName, word });
    const message = conversationLines.join("\n");
    const [relationship, conversation, relationshipEvent] = await prisma.$transaction(async (tx) => {
      // 同じキャラクターに対する同時進展を直列化し、恋人・ライバルの一人制限を競合時にも守る。
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pair[0]}))`;
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${pair[1]}))`;
      let relationshipRow = await tx.crocsiansSocialRelationship.upsert({
        where: { fromUserId_toUserId: { fromUserId: pair[0], toUserId: pair[1] } },
        create: { fromUserId: pair[0], toUserId: pair[1], friendship: friendly ? 3 : 1, rivalry: competitive ? 2 : 0, romance: romanceGain, interactionCount: 1, lastActivity: activity, lastInteractionAt: new Date() },
        update: { friendship: { increment: friendly ? 3 : 1 }, rivalry: { increment: competitive ? 2 : 0 }, romance: { increment: romanceGain }, interactionCount: { increment: 1 }, lastActivity: activity, lastInteractionAt: new Date() },
      });
      const conversationRow = await tx.crocsiansConversationLog.create({ data: { speakerId, listenerId, category, word, message } });
      // サンプル語は会話に使うだけで記憶へ保存しない。実際に覚えている語だけが相手へ伝わる。
      if (speakerWords.length > 0) await rememberWord(tx, listenerId, category, word, speakerId);
      let eventRow = null;
      if (Math.random() < .55) {
        let progressionKind = relationshipKind;
        // 友人として信頼を重ねた二人も、その友情を保ったまま恋愛へ発展できる。
        if (progressionKind === "friendship" && relationshipRow.friendshipStage >= 3 && !relationshipRow.romanceActive && !relationshipRow.married) {
          const romanceFromFriendshipRate = Math.min(.47, .12 + relationshipRow.friendshipStage * .035);
          if (Math.random() < romanceFromFriendshipRate) progressionKind = "romance";
        }
        if (progressionKind === "romance") {
          const otherPartner = await tx.crocsiansSocialRelationship.findFirst({ where: { id: { not: relationshipRow.id }, OR: [{ fromUserId: { in: pair } }, { toUserId: { in: pair } }], AND: [{ OR: [{ romanceActive: true }, { married: true }] }] }, select: { id: true } });
          if (otherPartner) progressionKind = "friendship";
        } else if (progressionKind === "rivalry") {
          const otherRival = await tx.crocsiansSocialRelationship.findFirst({ where: { id: { not: relationshipRow.id }, OR: [{ fromUserId: { in: pair } }, { toUserId: { in: pair } }], rivalryStage: { gt: 0 } }, select: { id: true } });
          if (otherRival) progressionKind = "friendship";
        }
        const stageField = progressionKind === "friendship" ? "friendshipStage" : progressionKind === "rivalry" ? "rivalryStage" : "romanceStage";
        const currentStage = relationshipRow[stageField];
        const breaksUp = progressionKind === "romance" && currentStage > 0 && currentStage < 10 && Math.random() < 1 - Math.pow(.5, 1 / 9);
        if (progressionKind === "romance" && currentStage === 10 && !relationshipRow.married) {
          const femaleName = relationshipRow.femaleRoleUserId === actorAId ? characterSummary(actorAId, actorASave.data).name : characterSummary(ownerId, ownerSave.data).name;
          const maleName = relationshipRow.maleRoleUserId === actorAId ? characterSummary(actorAId, actorASave.data).name : characterSummary(ownerId, ownerSave.data).name;
          const attendees = await tx.crocsiansSave.findMany({ select: { data: true } });
          const audienceNames = attendees.map((save) => characterSummary("", save.data).name).filter((name) => name !== femaleName && name !== maleName);
          const weddingLines = renderConversationLines(conversationCatalog.wedding, { F: femaleName, M: maleName });
          audienceNames.slice(0, 12).forEach((name, index) => weddingLines.splice(3 + index * 2, 0, `${name}「${index % 3 === 0 ? "結婚おめでとう！　二人とも末永く幸せに！" : index % 3 === 1 ? "今日は最高の日だね。心から祝福するよ！" : "二人ならきっと素敵な家庭を築けるよ！"}」`));
          const weddingMessage = weddingLines.join("\n");
          relationshipRow = await tx.crocsiansSocialRelationship.update({ where: { id: relationshipRow.id }, data: { married: true, marriedAt: new Date(), romanceActive: true } });
          eventRow = await tx.crocsiansConversationLog.create({ data: { speakerId, listenerId, category: "loveValues", word: "結婚の誓い", message: weddingMessage, eventType: "wedding", relationshipKind: "romance", relationshipStage: 10 } });
        } else if (breaksUp) {
          const breakupMessage = `${speakerName}と${listenerName}は互いの気持ちを話し合い、恋人関係を終えることにした。二人はそれぞれの道を歩き始めた。`;
          relationshipRow = await tx.crocsiansSocialRelationship.update({ where: { id: relationshipRow.id }, data: { romanceStage: 0, romanceActive: false, romance: 0, femaleRoleUserId: null, maleRoleUserId: null, breakupCount: { increment: 1 } } });
          eventRow = await tx.crocsiansConversationLog.create({ data: { speakerId, listenerId, category: "loveValues", word: "別々の道を歩く", message: breakupMessage, eventType: "breakup", relationshipKind: "romance", relationshipStage: 0 } });
        } else if (currentStage < 10) {
          const nextStage = currentStage + 1;
          const relationshipCategory: SocialWordCategoryId = progressionKind === "friendship" ? "friendRelationship" : progressionKind === "rivalry" ? "rivalRelationship" : nextStage <= 2 ? "romanceInterest" : nextStage <= 5 ? "romanceEarly" : nextStage <= 8 ? "romanceIntimate" : "romanceLifetime";
          const relationshipWords = await tx.crocsiansCharacterWord.findMany({ where: { userId: speakerId, category: relationshipCategory }, orderBy: { learnedAt: "desc" }, take: 3 });
          const relationshipWordChoices = relationshipWords.length ? relationshipWords.map((entry) => entry.word) : SOCIAL_WORD_CATEGORY_MAP[relationshipCategory].samples;
          const relationshipWord = relationshipWordChoices[Math.floor(Math.random() * relationshipWordChoices.length)];
          const roleData = progressionKind === "romance" && !relationshipRow.femaleRoleUserId ? (Math.random() < .5 ? { femaleRoleUserId: pair[0], maleRoleUserId: pair[1] } : { femaleRoleUserId: pair[1], maleRoleUserId: pair[0] }) : {};
          relationshipRow = await tx.crocsiansSocialRelationship.update({ where: { id: relationshipRow.id }, data: { [stageField]: nextStage, ...(progressionKind === "romance" ? { romanceActive: true, ...roleData } : {}) } });
          const femaleName = progressionKind === "romance" ? (relationshipRow.femaleRoleUserId === actorAId ? characterSummary(actorAId, actorASave.data).name : characterSummary(ownerId, ownerSave.data).name) : "";
          const maleName = progressionKind === "romance" ? (relationshipRow.maleRoleUserId === actorAId ? characterSummary(actorAId, actorASave.data).name : characterSummary(ownerId, ownerSave.data).name) : "";
          const relationshipLines = progressionKind === "romance"
            ? renderConversationLines(relationshipConversationCatalog.romance[String(nextStage) as keyof typeof relationshipConversationCatalog.romance], { F: femaleName, M: maleName, word: relationshipWord })
            : renderConversationLines(relationshipConversationCatalog[progressionKind][String(nextStage) as "1"], { A: speakerName, B: listenerName, word: relationshipWord });
          const eventMessage = relationshipLines.join("\n");
          eventRow = await tx.crocsiansConversationLog.create({ data: { speakerId, listenerId, category: relationshipCategory, word: relationshipWord, message: eventMessage, eventType: "relationship", relationshipKind: progressionKind, relationshipStage: nextStage } });
          if (relationshipWords.length > 0) await rememberWord(tx, listenerId, relationshipCategory, relationshipWord, speakerId);
        }
      }
      return [relationshipRow, conversationRow, eventRow] as const;
    });
    const viewerRelationshipUserId = actorAId === user.id ? ownerId : ownerId === user.id ? actorAId : null;
    return Response.json({ ok: true, activity, conversation: { id: conversation.id, speaker: speakerName, listener: listenerName, speakerId, listenerId, category, categoryLabel, word, message, eventType: "conversation", createdAt: conversation.createdAt.toISOString() }, relationshipEvent: relationshipEvent ? { id: relationshipEvent.id, speaker: speakerName, listener: listenerName, speakerId, listenerId, category: relationshipEvent.category, word: relationshipEvent.word, message: relationshipEvent.message, eventType: relationshipEvent.eventType, relationshipKind: relationshipEvent.relationshipKind, relationshipStage: relationshipEvent.relationshipStage, createdAt: relationshipEvent.createdAt.toISOString() } : null, relationship: viewerRelationshipUserId ? { userId: viewerRelationshipUserId, friendship: relationship.friendship, rivalry: relationship.rivalry, romance: relationship.romance, friendshipStage: relationship.friendshipStage, rivalryStage: relationship.rivalryStage, romanceStage: relationship.romanceStage, romanceActive: relationship.romanceActive, femaleRoleUserId: relationship.femaleRoleUserId, maleRoleUserId: relationship.maleRoleUserId, breakupCount: relationship.breakupCount, married: relationship.married, marriedAt: relationship.marriedAt?.toISOString() ?? null, interactionCount: relationship.interactionCount, lastActivity: relationship.lastActivity, lastInteractionAt: relationship.lastInteractionAt?.toISOString() ?? null } : null });
  }

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
