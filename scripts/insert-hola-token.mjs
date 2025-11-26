/**
 * Insert HOLA token directly into database
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HOLA_TOKEN = {
  address: 'CBITJZL7TC25WJKALVVPPMZUBHBOET6WLDUX3GWBNHZEIALQOYI7AB5F',
  name: 'hola',
  symbol: 'HOLA',
  decimals: 7,
  creator: 'GAYES36VZUWL437CC2IIJ7OUCWYWESEOJ6GITMTCHEF6OOYWIUNBKVXI',
  totalSupply: '1000000000000000', // 100M with 7 decimals
  imageUrl: '',
  description: 'Test token hola',
  metadataUri: '',
  status: 'BONDING',
  xlmReserve: '0',
  xlmRaised: '0',
  marketCap: '0',
};

async function main() {
  console.log('=== Inserting HOLA token into database ===');
  console.log('Address:', HOLA_TOKEN.address);

  try {
    // Check if token already exists
    const existing = await prisma.token.findUnique({
      where: { address: HOLA_TOKEN.address }
    });

    if (existing) {
      console.log('Token already exists:', existing.id);
      return;
    }

    // Insert token
    const token = await prisma.token.create({
      data: {
        address: HOLA_TOKEN.address,
        name: HOLA_TOKEN.name,
        symbol: HOLA_TOKEN.symbol,
        decimals: HOLA_TOKEN.decimals,
        creator: HOLA_TOKEN.creator,
        totalSupply: HOLA_TOKEN.totalSupply,
        imageUrl: HOLA_TOKEN.imageUrl,
        description: HOLA_TOKEN.description,
        metadataUri: HOLA_TOKEN.metadataUri,
        status: HOLA_TOKEN.status,
        xlmReserve: HOLA_TOKEN.xlmReserve,
        xlmRaised: HOLA_TOKEN.xlmRaised,
        marketCap: HOLA_TOKEN.marketCap,
      }
    });

    console.log('✓ Token inserted successfully!');
    console.log('ID:', token.id);
    console.log('Address:', token.address);

  } catch (error) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
