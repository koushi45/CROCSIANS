-- 恋人・配偶者は各キャラクターにつき最新の一人だけを残す。
UPDATE "CrocsiansSocialRelationship" AS current
SET "romance" = 0,
    "romanceStage" = 0,
    "romanceActive" = false,
    "femaleRoleUserId" = NULL,
    "maleRoleUserId" = NULL,
    "married" = false,
    "marriedAt" = NULL
WHERE (current."romanceActive" = true OR current."married" = true)
  AND EXISTS (
    SELECT 1 FROM "CrocsiansSocialRelationship" AS newer
    WHERE newer."id" <> current."id"
      AND (newer."romanceActive" = true OR newer."married" = true)
      AND (newer."fromUserId" IN (current."fromUserId", current."toUserId") OR newer."toUserId" IN (current."fromUserId", current."toUserId"))
      AND (newer."updatedAt", newer."id") > (current."updatedAt", current."id")
  );

-- ライバルも各キャラクターにつき最新の一人だけを残す。友人関係は制限しない。
UPDATE "CrocsiansSocialRelationship" AS current
SET "rivalry" = 0,
    "rivalryStage" = 0
WHERE current."rivalryStage" > 0
  AND EXISTS (
    SELECT 1 FROM "CrocsiansSocialRelationship" AS newer
    WHERE newer."id" <> current."id"
      AND newer."rivalryStage" > 0
      AND (newer."fromUserId" IN (current."fromUserId", current."toUserId") OR newer."toUserId" IN (current."fromUserId", current."toUserId"))
      AND (newer."updatedAt", newer."id") > (current."updatedAt", current."id")
  );
