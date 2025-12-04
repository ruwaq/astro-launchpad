---
name: next-15-patterns
description: Next.js 15 and React 19 patterns for astro-launchpad frontend.
---

# Next.js 15 Patterns Skill

## Server vs Client Components

```typescript
// SERVER COMPONENT (default) - No directive needed
// app/t/[address]/page.tsx
export default async function TokenPage({ params }: Props) {
  const token = await prisma.token.findUnique({
    where: { address: params.address }
  });

  return (
    <div>
      <h1>{token.name}</h1>
      <TradingWidget token={token} /> {/* Client component */}
    </div>
  );
}

// CLIENT COMPONENT - Needs 'use client'
// components/widgets/TradingWidget.tsx
'use client';

import { useState } from 'react';

export function TradingWidget({ token }: Props) {
  const [amount, setAmount] = useState('');
  // Interactive logic
}
```

## When to Use Each

**Server Components:**
- Data fetching from DB/API
- Accessing backend resources
- Keeping sensitive data server-side
- Large dependencies (don't ship to client)

**Client Components:**
- User interactions (onClick, onChange)
- useState, useEffect, useContext
- Browser APIs (localStorage, window)
- Event listeners

## Data Fetching

```typescript
// Server Component - Direct fetch
async function TokenList() {
  const tokens = await prisma.token.findMany({
    take: 20,
    orderBy: { marketCap: 'desc' }
  });

  return <TokenGrid tokens={tokens} />;
}

// With caching
async function getToken(address: string) {
  return unstable_cache(
    async () => prisma.token.findUnique({ where: { address } }),
    [`token-${address}`],
    { revalidate: 60 } // 1 minute
  )();
}
```

## Loading States

```typescript
// app/t/[address]/loading.tsx
export default function Loading() {
  return <TokenSkeleton />;
}

// Streaming with Suspense
export default function Page() {
  return (
    <div>
      <Suspense fallback={<HeaderSkeleton />}>
        <TokenHeader />
      </Suspense>
      <Suspense fallback={<ChartSkeleton />}>
        <PriceChart />
      </Suspense>
    </div>
  );
}
```

## Server Actions

```typescript
// app/actions.ts
'use server';

import { revalidatePath } from 'next/cache';

export async function createToken(formData: FormData) {
  const name = formData.get('name') as string;
  const symbol = formData.get('symbol') as string;

  // Validate
  if (!name || !symbol) {
    return { error: 'Missing fields' };
  }

  // Create token via contract
  const result = await sacFactory.createToken(name, symbol);

  // Revalidate cache
  revalidatePath('/');

  return { success: true, address: result.address };
}

// Usage in Client Component
'use client';

export function CreateForm() {
  const [state, formAction] = useFormState(createToken, null);

  return (
    <form action={formAction}>
      <input name="name" />
      <input name="symbol" />
      <button type="submit">Create</button>
      {state?.error && <p>{state.error}</p>}
    </form>
  );
}
```

## Route Handlers

```typescript
// app/api/tokens/[address]/route.ts
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { address: string } }
) {
  const token = await getToken(params.address);

  if (!token) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(token);
}
```

## Metadata

```typescript
// app/t/[address]/page.tsx
import { Metadata } from 'next';

export async function generateMetadata({ params }): Promise<Metadata> {
  const token = await getToken(params.address);

  return {
    title: `${token.name} (${token.symbol}) | Astro`,
    description: `Trade ${token.name} on Astro Launchpad`,
    openGraph: {
      images: [token.imageUrl],
    },
  };
}
```

## Parallel Routes

```typescript
// app/@modal/(.)t/[address]/page.tsx
// Intercepting route for modal
export default function TokenModal({ params }) {
  return (
    <Modal>
      <TokenDetails address={params.address} />
    </Modal>
  );
}

// app/layout.tsx
export default function Layout({ children, modal }) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
```
