import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { network } from "hardhat";
import { parseEther } from "viem";

/**
 * End-to-end coverage of the market lifecycle as a user would experience it:
 * several wallets, real ETH balances, time moving forward, events observed from
 * the outside. Per-function edge cases live in contracts/PredictionMarket.t.sol.
 */
describe("PredictionMarket", async function () {
  const { viem, networkHelpers } = await network.create();
  const publicClient = await viem.getPublicClient();
  const [deployer, alice, bob, carol, oracle] = await viem.getWalletClients();

  const TREASURY = "0x000000000000000000000000000000000000dEaD" as const;
  const FEE_BPS = 200; // 2%
  const DAY = 24n * 60n * 60n;

  async function deployMarket() {
    const market = await viem.deployContract("PredictionMarket", [TREASURY, FEE_BPS]);
    return { market };
  }

  /** Opens a market closing in a day, resolvable for two days after that. */
  async function openMarket(market: Awaited<ReturnType<typeof deployMarket>>["market"]) {
    const now = BigInt(await networkHelpers.time.latest());
    const closesAt = now + DAY;
    const resolvesBy = closesAt + 2n * DAY;

    await market.write.createMarket([
      "Will ETH close above $5,000 this month?",
      closesAt,
      resolvesBy,
      oracle.account.address,
    ]);

    return { closesAt, resolvesBy };
  }

  it("emits MarketCreated with the terms it was given", async function () {
    const { market } = await networkHelpers.loadFixture(deployMarket);
    const now = BigInt(await networkHelpers.time.latest());
    const closesAt = now + DAY;
    const resolvesBy = closesAt + DAY;

    await viem.assertions.emitWithArgs(
      market.write.createMarket([
        "Will ETH close above $5,000 this month?",
        closesAt,
        resolvesBy,
        oracle.account.address,
      ]),
      market,
      "MarketCreated",
      [
        0n,
        deployer.account.address,
        oracle.account.address,
        "Will ETH close above $5,000 this month?",
        closesAt,
        resolvesBy,
        FEE_BPS,
      ],
    );
  });

  it("pays winners their stake plus a proportional slice of the losing pool", async function () {
    const { market } = await networkHelpers.loadFixture(deployMarket);
    const { closesAt } = await openMarket(market);

    // Yes: alice 1 ETH (25%), carol 3 ETH (75%). No: bob 4 ETH.
    await market.write.stake([0n, true], { account: alice.account, value: parseEther("1") });
    await market.write.stake([0n, true], { account: carol.account, value: parseEther("3") });
    await market.write.stake([0n, false], { account: bob.account, value: parseEther("4") });

    assert.equal(await market.read.impliedYesProbabilityBps([0n]), 5000n);

    await networkHelpers.time.increaseTo(closesAt);
    await market.write.resolve([0n, 1], { account: oracle.account }); // 1 = Yes

    const fee = (parseEther("4") * BigInt(FEE_BPS)) / 10_000n;
    const distributable = parseEther("4") - fee;

    const alicePayout = parseEther("1") + distributable / 4n;
    const carolPayout = parseEther("3") + (distributable * 3n) / 4n;

    assert.equal(await market.read.previewPayout([0n, alice.account.address]), alicePayout);
    assert.equal(await market.read.previewPayout([0n, carol.account.address]), carolPayout);
    assert.equal(await market.read.previewPayout([0n, bob.account.address]), 0n);

    await viem.assertions.balancesHaveChanged(
      market.write.claim([0n], { account: alice.account }),
      [{ address: alice.account.address, amount: alicePayout }],
    );
    await viem.assertions.emitWithArgs(
      market.write.claim([0n], { account: carol.account }),
      market,
      "Claimed",
      [0n, carol.account.address, carolPayout],
    );
  });

  it("refunds everyone when the oracle misses its deadline", async function () {
    const { market } = await networkHelpers.loadFixture(deployMarket);
    const { resolvesBy } = await openMarket(market);

    await market.write.stake([0n, true], { account: alice.account, value: parseEther("2") });
    await market.write.stake([0n, false], { account: bob.account, value: parseEther("3") });

    await networkHelpers.time.increaseTo(resolvesBy + 1n);

    // Permissionless — bob unlocks refunds himself.
    await viem.assertions.emitWithArgs(
      market.write.expire([0n], { account: bob.account }),
      market,
      "MarketExpired",
      [0n],
    );

    await viem.assertions.balancesHaveChanged(
      market.write.claim([0n], { account: alice.account }),
      [{ address: alice.account.address, amount: parseEther("2") }],
    );
    await viem.assertions.balancesHaveChanged(
      market.write.claim([0n], { account: bob.account }),
      [{ address: bob.account.address, amount: parseEther("3") }],
    );

    assert.equal(await publicClient.getBalance({ address: market.address }), 0n);
  });

  it("rejects a resolution from anyone but the named oracle", async function () {
    const { market } = await networkHelpers.loadFixture(deployMarket);
    const { closesAt } = await openMarket(market);

    await market.write.stake([0n, true], { account: alice.account, value: parseEther("1") });
    await market.write.stake([0n, false], { account: bob.account, value: parseEther("1") });
    await networkHelpers.time.increaseTo(closesAt);

    await viem.assertions.revertWithCustomError(
      market.write.resolve([0n, 1], { account: alice.account }),
      market,
      "NotOracle",
    );
  });

  it("stops accepting stake once the market closes", async function () {
    const { market } = await networkHelpers.loadFixture(deployMarket);
    const { closesAt } = await openMarket(market);

    await networkHelpers.time.increaseTo(closesAt);

    await viem.assertions.revertWithCustomErrorWithArgs(
      market.write.stake([0n, true], { account: alice.account, value: parseEther("1") }),
      market,
      "MarketClosed",
      [0n],
    );
  });

  it("sends collected fees to the treasury", async function () {
    const { market } = await networkHelpers.loadFixture(deployMarket);
    const { closesAt } = await openMarket(market);

    await market.write.stake([0n, true], { account: alice.account, value: parseEther("1") });
    await market.write.stake([0n, false], { account: bob.account, value: parseEther("4") });

    await networkHelpers.time.increaseTo(closesAt);
    await market.write.resolve([0n, 1], { account: oracle.account });

    const fee = (parseEther("4") * BigInt(FEE_BPS)) / 10_000n;
    assert.equal(await market.read.accruedFees(), fee);

    await viem.assertions.balancesHaveChanged(market.write.withdrawFees(), [
      { address: TREASURY, amount: fee },
    ]);
    assert.equal(await market.read.accruedFees(), 0n);
  });

  it("keeps several markets independent of one another", async function () {
    const { market } = await networkHelpers.loadFixture(deployMarket);
    const { closesAt } = await openMarket(market);
    await openMarket(market);

    assert.equal(await market.read.marketCount(), 2n);

    await market.write.stake([0n, true], { account: alice.account, value: parseEther("1") });
    await market.write.stake([1n, false], { account: bob.account, value: parseEther("2") });

    const first = await market.read.getMarket([0n]);
    const second = await market.read.getMarket([1n]);

    assert.equal(first.yesPool, parseEther("1"));
    assert.equal(first.noPool, 0n);
    assert.equal(second.yesPool, 0n);
    assert.equal(second.noPool, parseEther("2"));

    // Resolving the first must not touch the second.
    await networkHelpers.time.increaseTo(closesAt);
    await market.write.resolve([0n, 1], { account: oracle.account });

    assert.equal((await market.read.getMarket([0n])).outcome, 1); // Yes
    assert.equal((await market.read.getMarket([1n])).outcome, 0); // still Unresolved
  });
});
