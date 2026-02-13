-- CreateTable
CREATE TABLE "SSEEvent" (
    "id" UUID NOT NULL,
    "seq" SERIAL NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SSEEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SSEEvent_userId_seq_idx" ON "SSEEvent"("userId", "seq");

-- CreateIndex
CREATE INDEX "SSEEvent_createdAt_idx" ON "SSEEvent"("createdAt");
