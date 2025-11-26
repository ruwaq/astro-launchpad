/**
 * Get token info for HOLA token
 */
import {
  Contract,
  SorobanRpc,
  TransactionBuilder,
  nativeToScVal,
  Address,
  Keypair,
} from '@stellar/stellar-sdk';

const CONFIG = {
  rpcUrl: 'https://soroban-testnet.stellar.org',
  passphrase: 'Test SDF Network ; September 2015',
  factoryContract: 'CDAGI666QPS2QU4RVUXW4WFHABETECXQVJVFNTAJJJCGS36XX6R3AWSC',
  tokenAddress: 'CBITJZL7TC25WJKALVVPPMZUBHBOET6WLDUX3GWBNHZEIALQOYI7AB5F',
};

// Use testnet-deployer for queries
const QUERY_KEYPAIR = Keypair.fromSecret('SBLK5NCAL63Z3MS4NL5T2H7A6BQHDUEJMN5ETHPGE6AIGIK5TEYNWX5R');

async function main() {
  const server = new SorobanRpc.Server(CONFIG.rpcUrl);
  const sourceAccount = await server.getAccount(QUERY_KEYPAIR.publicKey());
  const factoryContract = new Contract(CONFIG.factoryContract);

  const tx = new TransactionBuilder(sourceAccount, {
    fee: '100000',
    networkPassphrase: CONFIG.passphrase,
  })
    .addOperation(factoryContract.call(
      'get_token_info',
      nativeToScVal(Address.fromString(CONFIG.tokenAddress), { type: 'address' })
    ))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);
  if ('result' in simulated && simulated.result && simulated.result.retval) {
    const result = simulated.result.retval;
    // Parse the result
    const fields = result._value;
    console.log('=== Token Info for HOLA ===');
    for (let i = 0; i < fields.length; i++) {
      const fieldEntry = fields[i];
      const key = fieldEntry._attributes.key._value.toString();
      const value = fieldEntry._attributes.val;

      if (key === 'creator') {
        const creatorAddress = Address.fromScVal(value).toString();
        console.log('Creator:', creatorAddress);
      } else if (key === 'issuer') {
        const issuerAddress = Address.fromScVal(value).toString();
        console.log('Issuer:', issuerAddress);
      } else if (key === 'id') {
        const idVal = value._value;
        console.log('ID:', idVal ? idVal.toString() : value);
      } else if (key === 'symbol' || key === 'name') {
        const strVal = value._value;
        console.log(key + ':', strVal ? strVal.toString() : value);
      }
    }
  } else {
    console.log('Could not fetch token info');
    console.log(JSON.stringify(simulated, null, 2));
  }
}

main().catch(console.error);
