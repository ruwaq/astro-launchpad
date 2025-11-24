-- CreateEnum
CREATE TYPE "FeeType" AS ENUM ('PROTOCOL_FEE', 'LP_FEE', 'CREATION_FEE', 'PROTOCOL_FEE_BUY', 'PROTOCOL_FEE_SELL', 'LP_FEE_BUY', 'LP_FEE_SELL');

-- AlterTable: Add fee tracking fields to Transaction
ALTER TABLE "Transaction" ADD COLUMN     "grossAmount" TEXT,
ADD COLUMN     "protocolFee" TEXT,
ADD COLUMN     "lpFee" TEXT,
ADD COLUMN     "totalFees" TEXT,
ADD COLUMN     "netAmount" TEXT;

-- CreateTable: FeeCollection
CREATE TABLE "FeeCollection" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "type" "FeeType" NOT NULL,
    "tokenAddress" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "treasuryAddress" TEXT,
    "userAddress" TEXT NOT NULL,
    "transactionType" TEXT NOT NULL,
    "grossAmount" TEXT NOT NULL,
    "protocolFee" TEXT,
    "lpFee" TEXT,
    "netAmount" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "blockNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeeCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FeeStats
CREATE TABLE "FeeStats" (
    "id" TEXT NOT NULL,
    "tokenAddress" TEXT,
    "totalProtocolFees" TEXT NOT NULL DEFAULT '0',
    "protocolFees24h" TEXT NOT NULL DEFAULT '0',
    "protocolFees7d" TEXT NOT NULL DEFAULT '0',
    "protocolFees30d" TEXT NOT NULL DEFAULT '0',
    "totalLpFees" TEXT NOT NULL DEFAULT '0',
    "lpFees24h" TEXT NOT NULL DEFAULT '0',
    "lpFees7d" TEXT NOT NULL DEFAULT '0',
    "lpFees30d" TEXT NOT NULL DEFAULT '0',
    "totalCreationFees" TEXT NOT NULL DEFAULT '0',
    "creationFees24h" TEXT NOT NULL DEFAULT '0',
    "creationFees7d" TEXT NOT NULL DEFAULT '0',
    "creationFees30d" TEXT NOT NULL DEFAULT '0',
    "totalFees" TEXT NOT NULL DEFAULT '0',
    "totalFees24h" TEXT NOT NULL DEFAULT '0',
    "totalFees7d" TEXT NOT NULL DEFAULT '0',
    "totalFees30d" TEXT NOT NULL DEFAULT '0',
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "transactions24h" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FeeConfig
CREATE TABLE "FeeConfig" (
    "id" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "protocolFeeBps" INTEGER NOT NULL,
    "lpFeeBps" INTEGER NOT NULL,
    "creationFee" TEXT NOT NULL,
    "treasuryAddress" TEXT NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on FeeCollection hash
CREATE UNIQUE INDEX "FeeCollection_hash_key" ON "FeeCollection"("hash");

-- CreateIndex: Performance indexes for FeeCollection
CREATE INDEX "FeeCollection_type_idx" ON "FeeCollection"("type");
CREATE INDEX "FeeCollection_tokenAddress_idx" ON "FeeCollection"("tokenAddress");
CREATE INDEX "FeeCollection_userAddress_idx" ON "FeeCollection"("userAddress");
CREATE INDEX "FeeCollection_timestamp_idx" ON "FeeCollection"("timestamp");
CREATE INDEX "FeeCollection_type_timestamp_idx" ON "FeeCollection"("type", "timestamp");
CREATE INDEX "FeeCollection_tokenAddress_type_timestamp_idx" ON "FeeCollection"("tokenAddress", "type", "timestamp");

-- CreateIndex: Unique constraint on FeeStats tokenAddress
CREATE UNIQUE INDEX "FeeStats_tokenAddress_key" ON "FeeStats"("tokenAddress");

-- CreateIndex: Performance indexes for FeeStats
CREATE INDEX "FeeStats_tokenAddress_idx" ON "FeeStats"("tokenAddress");
CREATE INDEX "FeeStats_updatedAt_idx" ON "FeeStats"("updatedAt");

-- CreateIndex: Unique constraint on FeeConfig contractAddress
CREATE UNIQUE INDEX "FeeConfig_contractAddress_key" ON "FeeConfig"("contractAddress");

-- CreateIndex: Performance indexes for FeeConfig
CREATE INDEX "FeeConfig_contractAddress_idx" ON "FeeConfig"("contractAddress");
CREATE INDEX "FeeConfig_effectiveFrom_idx" ON "FeeConfig"("effectiveFrom");

-- Insert default global FeeStats record
INSERT INTO "FeeStats" (
    "id",
    "tokenAddress",
    "totalProtocolFees",
    "protocolFees24h",
    "protocolFees7d",
    "protocolFees30d",
    "totalLpFees",
    "lpFees24h",
    "lpFees7d",
    "lpFees30d",
    "totalCreationFees",
    "creationFees24h",
    "creationFees7d",
    "creationFees30d",
    "totalFees",
    "totalFees24h",
    "totalFees7d",
    "totalFees30d",
    "totalTransactions",
    "transactions24h",
    "updatedAt"
) VALUES (
    gen_random_uuid(),
    NULL,
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    '0',
    0,
    0,
    CURRENT_TIMESTAMP
);

-- Comment on tables
COMMENT ON TABLE "FeeCollection" IS 'Individual fee collection records from blockchain events';
COMMENT ON TABLE "FeeStats" IS 'Aggregated fee statistics for analytics and dashboards';
COMMENT ON TABLE "FeeConfig" IS 'Fee configuration history from smart contract';

-- Comment on key columns
COMMENT ON COLUMN "FeeCollection"."type" IS 'Type of fee: PROTOCOL_FEE (0.05%), LP_FEE (0.25%), CREATION_FEE (10 XLM)';
COMMENT ON COLUMN "FeeStats"."tokenAddress" IS 'NULL for global stats, specific address for token stats';
COMMENT ON COLUMN "FeeConfig"."protocolFeeBps" IS 'Protocol fee in basis points (5 = 0.05%)';
COMMENT ON COLUMN "FeeConfig"."lpFeeBps" IS 'LP fee in basis points (25 = 0.25%)';
COMMENT ON COLUMN "FeeConfig"."creationFee" IS 'Token creation fee in stroops (100000000 = 10 XLM)';