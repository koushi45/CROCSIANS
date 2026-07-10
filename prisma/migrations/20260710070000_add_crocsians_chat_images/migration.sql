ALTER TABLE "CrocsiansChatMessage"
ADD COLUMN "imageData" BYTEA,
ADD COLUMN "imageContentType" TEXT,
ADD COLUMN "imageExpiresAt" TIMESTAMP(3);

CREATE INDEX "CrocsiansChatMessage_imageExpiresAt_idx"
ON "CrocsiansChatMessage"("imageExpiresAt");
