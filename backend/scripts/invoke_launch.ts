import {
    Keypair,
    Contract,
    TransactionBuilder,
    Networks,
    SorobanRpc,
    Asset,
    xdr,
    Address
} from '@stellar/stellar-sdk';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env.test') });

const RPC_URL = process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org:443';
const NETWORK_PASSPHRASE = Networks.TESTNET;
const CONTRACT_ID = process.env.TOKEN_FACTORY_CONTRACT_ID;
const SECRET_KEY = process.env.DEPLOYER_SECRET_KEY; // Need to ensure this is set

if (!CONTRACT_ID) {
    console.error('❌ TOKEN_FACTORY_CONTRACT_ID not set');
    process.exit(1);
}

// We need a secret key to sign. If not provided, we can't invoke.
// For testnet-deployer, we might need to ask user or use a known test key if safe.
// Assuming the user has configured their environment or we can use a generated one funded via friendbot.
// For this E2E test, we really need a funded account.

async function main() {
    if (!SECRET_KEY) {
        console.error('❌ DEPLOYER_SECRET_KEY not set. Cannot invoke contract.');
        process.exit(1);
    }

    const keypair = Keypair.fromSecret(SECRET_KEY);
    const server = new SorobanRpc.Server(RPC_URL);

    console.log(`Invoking launch_token on ${CONTRACT_ID} with ${keypair.publicKey()}`);

    const tokenName = "E2E Test Token";
    const tokenSymbol = "E2E";

    // Create Asset XDR
    // We use a dummy asset for the SAC token definition (standard Stellar Asset)
    // In the contract, this is used to deploy the SAC.
    // The asset code must be the symbol.
    // The issuer will be the contract address (SAC pattern) or we let the factory handle it.
    // Wait, launch_token takes `serialized_asset`.
    // Usually this is `Asset.native().toXDR()` or `new Asset(code, issuer).toXDR()`.
    // For SAC, we usually pass the asset we want to wrap/deploy.

    // Let's create a dummy asset.
    // The factory deploys a SAC.
    // If we want a new token, we usually don't pass an existing asset unless we are wrapping.
    // But the contract signature says `serialized_asset: Bytes`.
    // Let's assume we need to pass a valid Asset XDR.

    const asset = new Asset(tokenSymbol, keypair.publicKey()); // Issuer = creator for now
    // Convert to XDR bytes
    const serializedAsset = asset.toXDRObject().toXDR();

    const contract = new Contract(CONTRACT_ID!);

    // Prepare transaction
    const account = await server.getAccount(keypair.publicKey());

    const tx = new TransactionBuilder(account, { fee: "100000", networkPassphrase: NETWORK_PASSPHRASE })
        .addOperation(
            contract.call(
                "launch_token",
                new Address(keypair.publicKey()).toScVal(), // creator
                xdr.ScVal.scvString(tokenName), // name
                xdr.ScVal.scvString(tokenSymbol), // symbol
                xdr.ScVal.scvString("https://example.com/image.png"), // image_url
                xdr.ScVal.scvString("E2E Test Token Description"), // description
                xdr.ScVal.scvBytes(serializedAsset) // serialized_asset
            )
        )
        .setTimeout(30)
        .build();

    tx.sign(keypair);

    const sendResponse = await server.sendTransaction(tx);

    if (sendResponse.status !== "PENDING") {
        console.error("❌ Transaction failed initially:", sendResponse);
        process.exit(1);
    }

    console.log(`Transaction sent: ${sendResponse.hash}`);

    // Wait for confirmation
    let statusResponse;
    let retries = 0;
    while (retries < 10) {
        statusResponse = await server.getTransaction(sendResponse.hash);
        if (statusResponse.status === "SUCCESS") {
            console.log("✅ Transaction successful!");
            // Parse result to get token address if needed
            // The result value is the address of the new token
            if (statusResponse.resultMetaXdr) {
                // Decoding meta is complex, but we know it succeeded.
            }
            process.exit(0);
        } else if (statusResponse.status === "FAILED") {
            console.error("❌ Transaction failed:", statusResponse);
            process.exit(1);
        }
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries++;
    }

    console.error("❌ Transaction timed out");
    process.exit(1);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
