const { nibiru } = require('../helper/coreAssets');
const { getBalance2 } = require('../helper/chain/cosmos')

const contractAddresses = {
  perp: 'nibi1ntmw2dfvd0qnw5fnwdu9pev2hsnqfdj9ny9n0nzh2a5u8v0scflq930mph',
  vaultUsdc: 'nibi193m2a00pmdsvkcvugrfewqzhtq6k0srkjzvxp2sk357vlpspx5vqxu8d7p',
  vaultStnibi: 'nibi1mrplvu3scplnrgns96kg0j8pk3l2p9c7eaz0qdedx0kt3vmcujyqrjkfej',
};

// Wasm precompile address on Nibiru
const WASM_PRECOMPILE_ADDRESS = '0x0000000000000000000000000000000000000802';

async function tvl(api) {
  const { perp, vaultUsdc, vaultStnibi } = contractAddresses;
  const block = await api.getBlock().catch(() => 'unknown');
  
  console.log("=== SAI TVL ADAPTER DEBUG START ===");
  console.log("Chain:", api.chain);
  console.log("Block:", block);
  console.log("Contract addresses:", contractAddresses);
  console.log("Wasm precompile address:", WASM_PRECOMPILE_ADDRESS);

  try {
    // Query both vaults in parallel using multiCall
    const vaultQueries = [
      { contract: vaultUsdc, asset: nibiru.USDC, name: 'USDC vault' },
      { contract: vaultStnibi, asset: nibiru.stNIBI, name: 'stNIBI vault' }
    ];

    const queryMsg = { tvl: {} };
    const queryBytes = vaultQueries.map(() =>
      Buffer.from(JSON.stringify(queryMsg), 'utf8')
    );

    console.log("Query message:", queryMsg);
    console.log("Query bytes length:", queryBytes[0].length);
    console.log("Query bytes hex:", queryBytes[0].toString('hex'));

    console.log("Making multiCall with params:");
    const calls = queryBytes.map((bytes, i) => ({
      target: WASM_PRECOMPILE_ADDRESS,
      params: [vaultQueries[i].contract, bytes]
    }));
    console.log("Calls:", JSON.stringify(calls, null, 2));

    const results = await api.multiCall({
      abi: 'function query(string contractAddr, bytes req) view returns (bytes)',
      calls: calls,
      permitFailure: true
    });

    console.log("Raw results from multiCall:", results);
    console.log("Results length:", results.length);

    // Process results
    results.forEach((result, i) => {
      const { contract, asset, name } = vaultQueries[i];

      console.log(`\n--- Processing ${name} ---`);
      console.log(`Contract: ${contract}`);
      console.log(`Asset: ${asset}`);
      console.log(`Raw result:`, result);
      console.log(`Result type:`, typeof result);
      console.log(`Result length:`, result ? result.length : 'N/A');

      try {
        if (result && result !== '0x' && result.length > 2) {
          console.log(`Hex data:`, result.slice(2));

          const hexBuffer = Buffer.from(result.slice(2), 'hex');
          console.log(`Buffer:`, hexBuffer);
          console.log(`Buffer string:`, hexBuffer.toString('utf8'));

          const tvlData = JSON.parse(hexBuffer.toString('utf8'));
          console.log(`Parsed TVL data:`, tvlData);

          if (tvlData) {
            api.add(asset, tvlData);
            console.log(`✓ Added ${tvlData} of ${asset} to TVL`);
          } else {
            console.warn(`⚠ TVL data is falsy for ${name}`);
          }
        } else {
          console.warn(`⚠ Empty or invalid response for ${name}: ${result}`);
        }
      } catch (parseError) {
        console.error(`✗ Failed to parse ${name} response:`, parseError);
        console.error(`Raw result that failed:`, result);
      }
    });


    const tokensToFetch = [
      { key: "USDC.nibi", symbol: nibiru.USDC },
      { key: "stNIBI.nibi", symbol: nibiru.stNIBI },
    ];

    const relevantTokens = tokensToFetch.map(t => nibiru[t.key]);

    const balancesPerp = await getBalance2({
      owner: perp,
      tokens: relevantTokens,
      chain: api.chain,
      block,
    });

    console.debug("Perp Balances", balancesPerp);

    tokensToFetch.forEach(({ key, symbol }) => {
      const normalizedKey = nibiru[key].replaceAll("/", ":");
      api.add(symbol, balancesPerp[normalizedKey]);
      console.log(`✓ Added ${balancesPerp[normalizedKey]} of ${symbol} to TVL`);

    });

    console.log("=== SAI TVL ADAPTER DEBUG END ===");

  } catch (error) {
    console.error(`✗ Error fetching Sai TVL:`, error);
    console.error("Error stack:", error.stack);
  }
}

module.exports = {
  timetravel: false,
  nibiru: { tvl },
};
