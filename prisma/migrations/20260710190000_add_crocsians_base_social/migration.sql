CREATE TABLE "CrocsiansBaseInteraction" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "liked" BOOLEAN NOT NULL DEFAULT false,
    "favorited" BOOLEAN NOT NULL DEFAULT false,
    "lastVisitedAt" TIMESTAMP(3),
    "lastHelpDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CrocsiansBaseInteraction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CrocsiansBaseInteraction_ownerId_visitorId_key" ON "CrocsiansBaseInteraction"("ownerId", "visitorId");
CREATE INDEX "CrocsiansBaseInteraction_ownerId_lastVisitedAt_idx" ON "CrocsiansBaseInteraction"("ownerId", "lastVisitedAt");
CREATE INDEX "CrocsiansBaseInteraction_visitorId_favorited_idx" ON "CrocsiansBaseInteraction"("visitorId", "favorited");
ALTER TABLE "CrocsiansBaseInteraction" ADD CONSTRAINT "CrocsiansBaseInteraction_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CrocsiansBaseInteraction" ADD CONSTRAINT "CrocsiansBaseInteraction_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
