-- CreateTable
CREATE TABLE "CachedBroadcast" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "script" TEXT NOT NULL,
    "articles" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CachedBroadcast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CachedBroadcast_category_language_key" ON "CachedBroadcast"("category", "language");
