const { nibiru } = require('../helper/coreAssets');

const contractAddresses = {
  perp: 'nibi1ntmw2dfvd0qnw5fnwdu9pev2hsnqfdj9ny9n0nzh2a5u8v0scflq930mph',
  vaultUsdc: 'nibi193m2a00pmdsvkcvugrfewqzhtq6k0srkjzvxp2sk357vlpspx5vqxu8d7p',
  vaultStnibi: 'nibi1mrplvu3scplnrgns96kg0j8pk3l2p9c7eaz0qdedx0kt3vmcujyqrjkfej',
};

// Wasm precompile address on Nibiru
const WASM_PRECOMPILE_ADDRESS = '0x0000000000000000000000000000000000000802';

async function queryWasmContract(api, contractAddress, queryMsg) {
  try {
    const queryBytes = Buffer.from(JSON.stringify(queryMsg), 'utf8');

    const result = await api.call({
      target: WASM_PRECOMPILE_ADDRESS,
      abi: 'function query(string contractAddr, bytes req) view returns (bytes)',
      params: [contractAddress, queryBytes]
    });

    // Handle empty responses
    if (!result || result === '0x') {
      throw new Error(`Empty response from Wasm query for ${contractAddress}`);
    }

    // Parse the hex response to JSON
    const responseJson = JSON.parse(
      Buffer.from(result.slice(2), 'hex').toString('utf8')
    );

    return responseJson;

  } catch (error) {
    throw error;
  }
}

async function tvl(api) {
  const { vaultUsdc, vaultStnibi } = contractAddresses;

  try {
    // Query both vaults in parallel using multiCall
    const vaultQueries = [
      { contract: vaultUsdc, asset: nibiru.USDC, name: 'USDC vault' },
      { contract: vaultStnibi, asset: nibiru["stNIBI"], name: 'stNIBI vault' }
    ];

    const queryMsg = { tvl: {} };
    const queryBytes = vaultQueries.map(() =>
      Buffer.from(JSON.stringify(queryMsg), 'utf8')
    );

    const calls = queryBytes.map((bytes, i) => ({
      target: WASM_PRECOMPILE_ADDRESS,
      params: [vaultQueries[i].contract, bytes]
    }));

    const results = await api.multiCall({
      abi: 'function query(string contractAddr, bytes req) view returns (bytes)',
      calls: calls,
      permitFailure: true
    });

    // Process results
    results.forEach((result, i) => {
      const { asset } = vaultQueries[i];

      try {
        if (result && result !== '0x' && result.length > 2) {
          const hexBuffer = Buffer.from(result.slice(2), 'hex');
          const tvlData = JSON.parse(hexBuffer.toString('utf8'));

          if (tvlData) {
            api.add(asset, tvlData);
          }
        }
      } catch (parseError) {
        // Silently skip invalid responses (permitFailure: true allows this)
      }
    });

  } catch (error) {
    throw error;
  }
}

module.exports = {
  timetravel: false,
  nibiru: { tvl },
};
