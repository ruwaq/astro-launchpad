-- Add deletedAt to Token model for soft deletes
ALTER TABLE "Token" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Create deletedAt index on Token
CREATE INDEX "Token_deletedAt_idx" ON "Token"("deletedAt");

-- Add deletedAt to Pool model for soft deletes
ALTER TABLE "Pool" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- Create deletedAt index on Pool
CREATE INDEX "Pool_deletedAt_idx" ON "Pool"("deletedAt");

-- Update Pool foreign key constraints to CASCADE on delete
ALTER TABLE "Pool" DROP CONSTRAINT "Pool_token0Address_fkey";
ALTER TABLE "Pool" DROP CONSTRAINT "Pool_token1Address_fkey";

ALTER TABLE "Pool" ADD CONSTRAINT "Pool_token0Address_fkey" 
  FOREIGN KEY ("token0Address") REFERENCES "Token"("address") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Pool" ADD CONSTRAINT "Pool_token1Address_fkey" 
  FOREIGN KEY ("token1Address") REFERENCES "Token"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable TokenSnapshot
CREATE TABLE "TokenSnapshot" (
    "id" TEXT NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "holders" INTEGER NOT NULL,
    "currentPrice" TEXT NOT NULL,
    "marketCap" TEXT NOT NULL,
    "volume24h" TEXT NOT NULL,
    "circulatingSupply" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TokenSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable PoolSnapshot
CREATE TABLE "PoolSnapshot" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "reserve0" TEXT NOT NULL,
    "reserve1" TEXT NOT NULL,
    "tvl" TEXT NOT NULL,
    "volume24h" TEXT NOT NULL,
    "apr" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PoolSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable UserActivitySnapshot
CREATE TABLE "UserActivitySnapshot" (
    "id" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "volumeTraded" TEXT NOT NULL,
    "tradesCount" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,
    "level" INTEGER NOT NULL,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserActivitySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TokenSnapshot_tokenAddress_timestamp_idx" ON "TokenSnapshot"("tokenAddress", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "TokenSnapshot_tokenAddress_timestamp_key" ON "TokenSnapshot"("tokenAddress", "timestamp");

-- CreateIndex
CREATE INDEX "PoolSnapshot_poolId_timestamp_idx" ON "PoolSnapshot"("poolId", "timestamp" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PoolSnapshot_poolId_timestamp_key" ON "PoolSnapshot"("poolId", "timestamp");

-- CreateIndex
CREATE INDEX "UserActivitySnapshot_userAddress_timestamp_idx" ON "UserActivitySnapshot"("userAddress", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "UserActivitySnapshot_timestamp_rank_idx" ON "UserActivitySnapshot"("timestamp", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "UserActivitySnapshot_userAddress_timestamp_key" ON "UserActivitySnapshot"("userAddress", "timestamp");

-- AddForeignKey TokenSnapshot
ALTER TABLE "TokenSnapshot" ADD CONSTRAINT "TokenSnapshot_tokenAddress_fkey" 
  FOREIGN KEY ("tokenAddress") REFERENCES "Token"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey PoolSnapshot
ALTER TABLE "PoolSnapshot" ADD CONSTRAINT "PoolSnapshot_poolId_fkey" 
  FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey UserActivitySnapshot
ALTER TABLE "UserActivitySnapshot" ADD CONSTRAINT "UserActivitySnapshot_userAddress_fkey" 
  FOREIGN KEY ("userAddress") REFERENCES "User"("address") ON DELETE CASCADE ON UPDATE CASCADE;

-- Update existing foreign key constraints to use CASCADE
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_tokenAddress_fkey";
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_userId_fkey";

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_tokenAddress_fkey" 
  FOREIGN KEY ("tokenAddress") REFERENCES "Token"("address") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Achievement" DROP CONSTRAINT IF EXISTS "Achievement_userId_fkey";
ALTER TABLE "Achievement" ADD CONSTRAINT "Achievement_userId_fkey" 
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Swap" DROP CONSTRAINT IF EXISTS "Swap_poolId_fkey";
ALTER TABLE "Swap" ADD CONSTRAINT "Swap_poolId_fkey" 
  FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiquidityEvent" DROP CONSTRAINT IF EXISTS "LiquidityEvent_poolId_fkey";
ALTER TABLE "LiquidityEvent" ADD CONSTRAINT "LiquidityEvent_poolId_fkey" 
  FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;
