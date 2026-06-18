-- CreateTable
CREATE TABLE "memories" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "importance" INTEGER NOT NULL DEFAULT 5,
    "user_id" TEXT NOT NULL,
    "access_count" INTEGER NOT NULL DEFAULT 0,
    "embedding_provider" TEXT NOT NULL DEFAULT 'gemini',
    "embedding_model" TEXT NOT NULL DEFAULT 'gemini-embedding-001',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_accessed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "memories_user_id_idx" ON "memories"("user_id");
