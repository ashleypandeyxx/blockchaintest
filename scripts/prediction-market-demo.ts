/**
 * Walks one market through its whole life on a throwaway in-process chain:
 * create → stake from two wallets → close → oracle resolves → winner claims →
 * treasury takes its fee.
 *
 *   npx hardhat run scripts/prediction-market-demo.ts
 */
import { network } from "hardhat";
import { formatEther, parseEther } from "viem";

const { viem, networkHelpers } = await network.create();

const [deployer, alice, bob, oracle] = await viem.getWalletClients();
const publicClient = await viem.getPublicClient();

const TREASURY = "0x000000000000000000000000000000000000dEaD" as const;
const FEE_BPS = 200;

const eth = (wei: bigint) => `${formatEther(wei)} ETH`;

const market = await viem.deployContract("PredictionMarket", [TREASURY, FEE_BPS]);
console.log(`PredictionMarket deployed at ${market.address}`);
console.log(`  treasury ${TREASURY} · fee ${FEE_BPS / 100}%\n`);

// ── Create ──────────────────────────────────────────────────────────────────
const now = BigInt(await networkHelpers.time.latest());
const closesAt = now + 24n * 60n * 60n;
const resolvesBy = closesAt + 48n * 60n * 60n;
const question = "Will the Bay Bridge be fog-free at 8am tomorrow?";

await market.write.createMarket([question, closesAt, resolvesBy, oracle.account.address]);
console.log(`Market 0 opened by ${deployer.account.address}`);
console.log(`  "${question}"`);
console.log(`  closes ${new Date(Number(closesAt) * 1000).toISOString()}`);
console.log(`  oracle ${oracle.account.address}\n`);

// ── Stake ───────────────────────────────────────────────────────────────────
await market.write.stake([0n, true], { account: alice.account, value: parseEther("1") });
await market.write.stake([0n, false], { account: bob.account, value: parseEther("3") });

const odds = await market.read.impliedYesProbabilityBps([0n]);
console.log(`alice backs YES with ${eth(parseEther("1"))}`);
console.log(`bob   backs NO  with ${eth(parseEther("3"))}`);
console.log(`  implied probability of YES: ${Number(odds) / 100}%\n`);

// ── Close and resolve ───────────────────────────────────────────────────────
await networkHelpers.time.increaseTo(closesAt);
console.log("Market closed. Oracle reports YES.");
await market.write.resolve([0n, 1], { account: oracle.account });

const resolved = await market.read.getMarket([0n]);
console.log(`  fee taken from the losing pool: ${eth(resolved.feeOwed)}\n`);

// ── Claim ───────────────────────────────────────────────────────────────────
const alicePayout = await market.read.previewPayout([0n, alice.account.address]);
const bobPayout = await market.read.previewPayout([0n, bob.account.address]);
console.log(`alice can claim ${eth(alicePayout)} (staked ${eth(parseEther("1"))})`);
console.log(`bob   can claim ${eth(bobPayout)} — he backed the wrong side\n`);

await market.write.claim([0n], { account: alice.account });
await market.write.withdrawFees();

console.log(`treasury balance: ${eth(await publicClient.getBalance({ address: TREASURY }))}`);
console.log(
  `dust left in contract: ${await publicClient.getBalance({ address: market.address })} wei`,
);
