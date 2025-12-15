# Snapshot Tables Documentation

## Overview

This document describes the historical snapshot tables added to the Astro Launchpad database for price tracking, analytics, and leaderboard functionality.

## Tables Added

### 1. TokenSnapshot

Captures historical state of tokens at specific timestamps for price charts and analytics.

**Schema:**
```prisma
model TokenSnapshot {
  id                String   @id @default(cuid())
  tokenAddress      String
  timestamp         DateTime
  holders           Int
  currentPrice      String   // BigInt as string
  marketCap         String
  volume24h         String
  circulatingSupply String
  createdAt         DateTime @default(now())
  token             Token    @relation(fields: [tokenAddress], references: [address], onDelete: Cascade)

  @@unique([tokenAddress, timestamp])
  @@index([tokenAddress, timestamp(sort: Desc)])
}
```

**Usage:**
- Historical price charts (1h, 24h, 7d, 30d)
- Market cap trends
- Volume analytics
- Holder growth tracking

**Example Query:**
```typescript
// Get 24h price history
const snapshots = await prisma.tokenSnapshot.findMany({
  where: {
    tokenAddress,
    timestamp: {
      gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
    }
  },
  orderBy: { timestamp: 'asc' },
  select: {
    timestamp: true,
    currentPrice: true,
    volume24h: true,
    marketCap: true
  }
});
```

### 2. PoolSnapshot

Captures historical DEX pool state for TVL and APR tracking.

**Schema:**
```prisma
model PoolSnapshot {
  id        String   @id @default(cuid())
  poolId    String
  timestamp DateTime
  reserve0  String
  reserve1  String
  tvl       String
  volume24h String
  apr       Float?
  createdAt DateTime @default(now())
  pool      Pool     @relation(fields: [poolId], references: [id], onDelete: Cascade)

  @@unique([poolId, timestamp])
  @@index([poolId, timestamp(sort: Desc)])
}
```

**Usage:**
- TVL (Total Value Locked) trends
- APR history for LP rewards
- Reserve ratio changes
- Impermanent loss calculations

**Example Query:**
```typescript
// Get 7d TVL history
const poolHistory = await prisma.poolSnapshot.findMany({
  where: {
    poolId,
    timestamp: {
      gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    }
  },
  orderBy: { timestamp: 'asc' },
  select: {
    timestamp: true,
    tvl: true,
    apr: true,
    volume24h: true
  }
});
```

### 3. UserActivitySnapshot

Tracks user trading activity and leaderboard rankings over time.

**Schema:**
```prisma
model UserActivitySnapshot {
  id           String   @id @default(cuid())
  userAddress  String
  timestamp    DateTime
  volumeTraded String
  tradesCount  Int
  points       Int
  level        Int
  rank         Int?
  createdAt    DateTime @default(now())
  user         User     @relation(fields: [userAddress], references: [address], onDelete: Cascade)

  @@unique([userAddress, timestamp])
  @@index([userAddress, timestamp(sort: Desc)])
  @@index([timestamp, rank])
}
```

**Usage:**
- Leaderboard rankings (daily/weekly/monthly)
- User progress tracking
- Points and level history
- Trading volume analytics

**Example Query:**
```typescript
// Get top 10 traders for current week
const weekStart = new Date();
weekStart.setHours(0, 0, 0, 0);
weekStart.setDate(weekStart.getDate() - weekStart.getDay());

const leaderboard = await prisma.userActivitySnapshot.findMany({
  where: {
    timestamp: {
      gte: weekStart
    }
  },
  orderBy: [
    { timestamp: 'desc' },
    { rank: 'asc' }
  ],
  take: 10,
  include: {
    user: {
      select: {
        address: true
      }
    }
  }
});
```

## Soft Deletes

Added `deletedAt` field to `Token` and `Pool` models for soft delete functionality:

```prisma
model Token {
  // ... existing fields
  deletedAt DateTime?
  
  @@index([deletedAt])
}

model Pool {
  // ... existing fields
  deletedAt DateTime?
  
  @@index([deletedAt])
}
```

**Usage:**
```typescript
// Soft delete a token
await prisma.token.update({
  where: { address: tokenAddress },
  data: { deletedAt: new Date() }
});

// Query only active tokens
const activeTokens = await prisma.token.findMany({
  where: { deletedAt: null }
});

// Include deleted tokens
const allTokens = await prisma.token.findMany({
  where: { deletedAt: { not: null } }
});
```

## Cascade Delete Rules

Updated foreign key constraints to properly handle deletions:

| Model | Relation | Delete Behavior |
|-------|----------|-----------------|
| TokenSnapshot | token | CASCADE (delete snapshots when token deleted) |
| PoolSnapshot | pool | CASCADE (delete snapshots when pool deleted) |
| UserActivitySnapshot | user | CASCADE (delete snapshots when user deleted) |
| Pool | token0/token1 | CASCADE (delete pool when token deleted) |
| Transaction | token | SET NULL (keep transaction, null token reference) |
| Transaction | user | SET NULL (keep transaction, null user reference) |
| Achievement | user | CASCADE (delete achievements when user deleted) |
| Swap | pool | CASCADE (delete swaps when pool deleted) |
| LiquidityEvent | pool | CASCADE (delete events when pool deleted) |

## Snapshot Generation Strategy

### Frequency Recommendations

| Snapshot Type | Frequency | Use Case |
|---------------|-----------|----------|
| TokenSnapshot | Every 5 minutes | Real-time price charts |
| TokenSnapshot | Every 1 hour | Historical trends |
| PoolSnapshot | Every 15 minutes | TVL/APR tracking |
| UserActivitySnapshot | Daily (00:00 UTC) | Leaderboards, rankings |

### Sample Indexer Logic

```typescript
// Token snapshot generation
async function captureTokenSnapshot(tokenAddress: string) {
  const token = await prisma.token.findUnique({
    where: { address: tokenAddress }
  });
  
  if (!token) return;
  
  const timestamp = new Date();
  timestamp.setMinutes(Math.floor(timestamp.getMinutes() / 5) * 5, 0, 0);
  
  await prisma.tokenSnapshot.upsert({
    where: {
      tokenAddress_timestamp: {
        tokenAddress,
        timestamp
      }
    },
    create: {
      tokenAddress,
      timestamp,
      holders: token.holders,
      currentPrice: token.currentPrice || "0",
      marketCap: token.marketCap || "0",
      volume24h: token.volume24h,
      circulatingSupply: token.circulatingSupply
    },
    update: {
      holders: token.holders,
      currentPrice: token.currentPrice || "0",
      marketCap: token.marketCap || "0",
      volume24h: token.volume24h,
      circulatingSupply: token.circulatingSupply
    }
  });
}

// User activity snapshot generation (daily)
async function captureUserActivitySnapshots() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const users = await prisma.user.findMany({
    orderBy: { points: 'desc' }
  });
  
  await prisma.userActivitySnapshot.createMany({
    data: users.map((user, index) => ({
      userAddress: user.address,
      timestamp: today,
      volumeTraded: user.totalVolumeTraded,
      tradesCount: 0, // Calculate from transactions
      points: user.points,
      level: user.level,
      rank: index + 1
    })),
    skipDuplicates: true
  });
}
```

## Data Retention Policy

Recommendations for managing snapshot data growth:

```typescript
// Delete old snapshots (older than 90 days)
async function pruneOldSnapshots() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  
  await prisma.$transaction([
    prisma.tokenSnapshot.deleteMany({
      where: { timestamp: { lt: cutoffDate } }
    }),
    prisma.poolSnapshot.deleteMany({
      where: { timestamp: { lt: cutoffDate } }
    }),
    prisma.userActivitySnapshot.deleteMany({
      where: { timestamp: { lt: cutoffDate } }
    })
  ]);
}
```

## Performance Optimization

### Index Strategy
- All snapshot tables have composite indexes on `[entityId, timestamp DESC]` for efficient time-series queries
- UserActivitySnapshot has additional index on `[timestamp, rank]` for leaderboard queries
- Unique constraints prevent duplicate snapshots for the same entity + timestamp

### Query Optimization
```typescript
// GOOD: Use proper indexes
const snapshots = await prisma.tokenSnapshot.findMany({
  where: {
    tokenAddress,
    timestamp: { gte: startDate, lte: endDate }
  },
  orderBy: { timestamp: 'asc' },
  select: { timestamp: true, currentPrice: true } // Only needed fields
});

// BAD: N+1 query
const tokens = await prisma.token.findMany();
for (const token of tokens) {
  const snapshots = await prisma.tokenSnapshot.findMany({
    where: { tokenAddress: token.address }
  });
}

// GOOD: Use includes/joins
const tokensWithSnapshots = await prisma.token.findMany({
  include: {
    snapshots: {
      where: { timestamp: { gte: startDate } },
      orderBy: { timestamp: 'desc' },
      take: 100
    }
  }
});
```

## Migration Instructions

1. **Backup your database** before running the migration
2. Run the migration:
   ```bash
   cd backend/shared
   pnpm prisma migrate deploy
   ```
3. Generate the updated Prisma client:
   ```bash
   pnpm prisma generate
   ```
4. Update your indexer to start capturing snapshots
5. (Optional) Backfill historical data if needed

## Rollback Plan

If you need to rollback this migration:

```sql
-- Drop snapshot tables
DROP TABLE "UserActivitySnapshot";
DROP TABLE "PoolSnapshot";
DROP TABLE "TokenSnapshot";

-- Remove deletedAt columns
ALTER TABLE "Token" DROP COLUMN "deletedAt";
ALTER TABLE "Pool" DROP COLUMN "deletedAt";

-- Restore original foreign key constraints (if needed)
-- See previous migration files for original constraints
```

## GraphQL Integration

Example GraphQL schema additions:

```graphql
type TokenSnapshot {
  id: ID!
  tokenAddress: String!
  timestamp: DateTime!
  holders: Int!
  currentPrice: String!
  marketCap: String!
  volume24h: String!
  circulatingSupply: String!
}

type Query {
  tokenPriceHistory(
    tokenAddress: String!
    from: DateTime!
    to: DateTime!
    interval: SnapshotInterval!
  ): [TokenSnapshot!]!
  
  leaderboard(
    period: LeaderboardPeriod!
    limit: Int = 10
  ): [UserActivitySnapshot!]!
}

enum SnapshotInterval {
  MINUTE_5
  HOUR_1
  DAY_1
}

enum LeaderboardPeriod {
  DAILY
  WEEKLY
  MONTHLY
  ALL_TIME
}
```

## Related Files

- Schema: `/backend/shared/prisma/schema.prisma`
- Migration: `/backend/shared/prisma/migrations/20251215101547_add_snapshot_tables_and_soft_deletes/migration.sql`
- Indexer: `/backend/indexer/src/` (update to capture snapshots)
- GraphQL: `/backend/api-gateway-v2/src/graphql/` (add snapshot resolvers)

---

**Author:** Claude Code (Prisma Specialist Agent)  
**Date:** 2025-12-15  
**Migration ID:** 20251215101547_add_snapshot_tables_and_soft_deletes
