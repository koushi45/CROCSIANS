CREATE TABLE "CrocsiansSocialRelationship" (
  "id" TEXT NOT NULL,
  "fromUserId" TEXT NOT NULL,
  "toUserId" TEXT NOT NULL,
  "friendship" INTEGER NOT NULL DEFAULT 0,
  "rivalry" INTEGER NOT NULL DEFAULT 0,
  "romance" INTEGER NOT NULL DEFAULT 0,
  "friendshipStage" INTEGER NOT NULL DEFAULT 0,
  "rivalryStage" INTEGER NOT NULL DEFAULT 0,
  "romanceStage" INTEGER NOT NULL DEFAULT 0,
  "romanceActive" BOOLEAN NOT NULL DEFAULT false,
  "femaleRoleUserId" TEXT,
  "maleRoleUserId" TEXT,
  "breakupCount" INTEGER NOT NULL DEFAULT 0,
  "married" BOOLEAN NOT NULL DEFAULT false,
  "marriedAt" TIMESTAMP(3),
  "interactionCount" INTEGER NOT NULL DEFAULT 0,
  "lastActivity" TEXT,
  "lastInteractionAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrocsiansSocialRelationship_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CrocsiansSocialRelationship_fromUserId_toUserId_key" ON "CrocsiansSocialRelationship"("fromUserId", "toUserId");
CREATE INDEX "CrocsiansSocialRelationship_fromUserId_updatedAt_idx" ON "CrocsiansSocialRelationship"("fromUserId", "updatedAt");
CREATE INDEX "CrocsiansSocialRelationship_toUserId_updatedAt_idx" ON "CrocsiansSocialRelationship"("toUserId", "updatedAt");
ALTER TABLE "CrocsiansSocialRelationship" ADD CONSTRAINT "CrocsiansSocialRelationship_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrocsiansSocialRelationship" ADD CONSTRAINT "CrocsiansSocialRelationship_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CrocsiansCharacterWord" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "category" TEXT NOT NULL, "word" TEXT NOT NULL,
  "learnedFromUserId" TEXT, "learnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrocsiansCharacterWord_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CrocsiansCharacterWord_userId_category_word_key" ON "CrocsiansCharacterWord"("userId", "category", "word");
CREATE INDEX "CrocsiansCharacterWord_userId_category_learnedAt_idx" ON "CrocsiansCharacterWord"("userId", "category", "learnedAt");
ALTER TABLE "CrocsiansCharacterWord" ADD CONSTRAINT "CrocsiansCharacterWord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CrocsiansConversationLog" (
  "id" TEXT NOT NULL, "speakerId" TEXT NOT NULL, "listenerId" TEXT NOT NULL, "category" TEXT NOT NULL,
  "word" TEXT NOT NULL, "message" TEXT NOT NULL, "eventType" TEXT NOT NULL DEFAULT 'conversation',
  "relationshipKind" TEXT, "relationshipStage" INTEGER, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrocsiansConversationLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CrocsiansConversationLog_speakerId_createdAt_idx" ON "CrocsiansConversationLog"("speakerId", "createdAt");
CREATE INDEX "CrocsiansConversationLog_listenerId_createdAt_idx" ON "CrocsiansConversationLog"("listenerId", "createdAt");
ALTER TABLE "CrocsiansConversationLog" ADD CONSTRAINT "CrocsiansConversationLog_speakerId_fkey" FOREIGN KEY ("speakerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrocsiansConversationLog" ADD CONSTRAINT "CrocsiansConversationLog_listenerId_fkey" FOREIGN KEY ("listenerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
