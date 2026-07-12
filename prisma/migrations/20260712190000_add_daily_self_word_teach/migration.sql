CREATE TABLE "CrocsiansDailyWordTeach" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "dateKey" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CrocsiansDailyWordTeach_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CrocsiansDailyWordTeach_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "CrocsiansDailyWordTeach_userId_dateKey_key" ON "CrocsiansDailyWordTeach"("userId", "dateKey");
CREATE INDEX "CrocsiansDailyWordTeach_dateKey_idx" ON "CrocsiansDailyWordTeach"("dateKey");
