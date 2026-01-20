const { queryContract } = require('../helpers/chain/cosmos');
const { nibiru } = require('../helpers/coreAssets');

const contractAddresses = {
    perp: 'nibi1ntmw2dfvd0qnw5fnwdu9pev2hsnqfdj9ny9n0nzh2a5u8v0scflq930mph',
    usdcVault: 'nibi193m2a00pmdsvkcvugrfewqzhtq6k0srkjzvxp2sk357vlpspx5vqxu8d7p',
    stnibiVault: 'nibi1mrplvu3scplnrgns96kg0j8pk3l2p9c7eaz0qdedx0kt3vmcujyqrjkfej',
};

async function tvl(api) {
  const chain = api.chain;

  const { usdcVault, stnibiVault } = contractAddresses;

  try {
    // Query USDC vault TVL
    const usdcVaultInfo = await queryContract({
      contract: usdcVault,
      chain,
      data: { tvl: {} },
    });

    if (usdcVaultInfo && usdcVaultInfo.data) {
      api.add(nibiru.USDC, usdcVaultInfo.data);
    }

    // Query stNIBI vault TVL
    const stnibiVaultInfo = await queryContract({
      contract: stnibiVault,
      chain,
      data: { tvl: {} },
    });

    if (stnibiVaultInfo && stnibiVaultInfo.data) {
      api.add(nibiru.stNIBI, stnibiVaultInfo.data);
    }
  } catch (error) {
    console.error(`Error fetching Sai TVL for ${chain}:`, error);
  }
}

module.exports = {
  timetravel: false,
  methodology:
    'Sai perpetual futures protocol TVL is calculated by querying total assets in two main liquidity vaults. ' +
    'USDC Vault: Holds USDC stablecoins deposited by liquidity providers, serving as collateral for perpetual positions and earning yield from trading fees. ' +
    'stNIBI Vault: Holds staked NIBI tokens as alternative collateral, providing diversified liquidity options. ' +
    'Total TVL represents the sum of both vaults, indicating the total value of assets available for perpetual futures trading.',
  nibiru: { tvl },
};