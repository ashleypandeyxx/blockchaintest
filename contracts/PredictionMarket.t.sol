// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {PredictionMarket} from "./PredictionMarket.sol";

/// @dev Rejects incoming ETH, so we can exercise the TransferFailed path.
contract RejectsEther {
    function stakeOn(PredictionMarket market, uint256 marketId, bool yes) external payable {
        market.stake{value: msg.value}(marketId, yes);
    }

    function claimFrom(PredictionMarket market, uint256 marketId) external {
        market.claim(marketId);
    }
}

contract PredictionMarketTest is Test {
    PredictionMarket internal market;

    address internal constant TREASURY = address(0x7EA5);
    address internal constant ORACLE = address(0x0AC1E);
    address internal constant ALICE = address(0xA11CE);
    address internal constant BOB = address(0xB0B);
    address internal constant CAROL = address(0xCA401);

    uint16 internal constant FEE_BPS = 200; // 2%
    uint64 internal closesAt;
    uint64 internal resolvesBy;

    function setUp() public {
        market = new PredictionMarket(TREASURY, FEE_BPS);
        closesAt = uint64(block.timestamp + 1 days);
        resolvesBy = uint64(block.timestamp + 3 days);

        vm.deal(ALICE, 100 ether);
        vm.deal(BOB, 100 ether);
        vm.deal(CAROL, 100 ether);
    }

    function _newMarket() internal returns (uint256) {
        return market.createMarket("Will it rain in Berkeley tomorrow?", closesAt, resolvesBy, ORACLE);
    }

    function _stake(address who, uint256 id, bool yes, uint256 amount) internal {
        vm.prank(who);
        market.stake{value: amount}(id, yes);
    }

    /* ─────────────────────────── Creation ─────────────────────────── */

    function test_CreateMarketStoresTerms() public {
        uint256 id = _newMarket();
        PredictionMarket.Market memory m = market.getMarket(id);

        assertEq(id, 0);
        assertEq(market.marketCount(), 1);
        assertEq(m.oracle, ORACLE);
        assertEq(m.closesAt, closesAt);
        assertEq(m.resolvesBy, resolvesBy);
        assertEq(m.feeBps, FEE_BPS);
        assertEq(uint8(m.outcome), uint8(PredictionMarket.Outcome.Unresolved));
        assertEq(m.yesPool, 0);
        assertEq(m.noPool, 0);
    }

    function test_CreateMarketRejectsShortQuestion() public {
        vm.expectRevert();
        market.createMarket("short", closesAt, resolvesBy, ORACLE);
    }

    function test_CreateMarketRejectsPastCloseTime() public {
        vm.expectRevert();
        market.createMarket("Will this revert as expected?", uint64(block.timestamp), resolvesBy, ORACLE);
    }

    function test_CreateMarketRejectsOverlongResolutionWindow() public {
        // Read the constant before arming expectRevert — it applies to the very
        // next external call, and a getter would swallow it.
        uint64 tooLate = closesAt + market.MAX_RESOLUTION_WINDOW() + 1;

        vm.expectRevert();
        market.createMarket("Will this revert as expected?", closesAt, tooLate, ORACLE);
    }

    function test_CreateMarketRejectsZeroOracle() public {
        vm.expectRevert();
        market.createMarket("Will this revert as expected?", closesAt, resolvesBy, address(0));
    }

    /* ──────────────────────────── Staking ─────────────────────────── */

    function test_StakeAccumulatesPerSide() public {
        uint256 id = _newMarket();
        _stake(ALICE, id, true, 3 ether);
        _stake(ALICE, id, true, 1 ether);
        _stake(BOB, id, false, 2 ether);

        PredictionMarket.Market memory m = market.getMarket(id);
        assertEq(m.yesPool, 4 ether);
        assertEq(m.noPool, 2 ether);
        assertEq(market.yesStakeOf(id, ALICE), 4 ether);
        assertEq(market.noStakeOf(id, BOB), 2 ether);
        assertEq(address(market).balance, 6 ether);
    }

    function test_StakeRejectsZeroValue() public {
        uint256 id = _newMarket();
        vm.prank(ALICE);
        vm.expectRevert();
        market.stake{value: 0}(id, true);
    }

    function test_StakeRejectsAfterClose() public {
        uint256 id = _newMarket();
        vm.warp(closesAt);
        vm.prank(ALICE);
        vm.expectRevert();
        market.stake{value: 1 ether}(id, true);
    }

    function test_StakeRejectsUnknownMarket() public {
        vm.prank(ALICE);
        vm.expectRevert();
        market.stake{value: 1 ether}(42, true);
    }

    function test_ImpliedProbabilityTracksPools() public {
        uint256 id = _newMarket();
        assertEq(market.impliedYesProbabilityBps(id), 0);

        _stake(ALICE, id, true, 3 ether);
        _stake(BOB, id, false, 1 ether);
        assertEq(market.impliedYesProbabilityBps(id), 7500);
    }

    /* ─────────────────────────── Resolution ───────────────────────── */

    function test_ResolveOnlyByOracle() public {
        uint256 id = _newMarket();
        _stake(ALICE, id, true, 1 ether);
        _stake(BOB, id, false, 1 ether);
        vm.warp(closesAt);

        vm.prank(ALICE);
        vm.expectRevert();
        market.resolve(id, PredictionMarket.Outcome.Yes);
    }

    function test_ResolveRejectsBeforeClose() public {
        uint256 id = _newMarket();
        vm.prank(ORACLE);
        vm.expectRevert();
        market.resolve(id, PredictionMarket.Outcome.Yes);
    }

    function test_ResolveRejectsAfterDeadline() public {
        uint256 id = _newMarket();
        _stake(ALICE, id, true, 1 ether);
        vm.warp(resolvesBy + 1);

        vm.prank(ORACLE);
        vm.expectRevert();
        market.resolve(id, PredictionMarket.Outcome.Yes);
    }

    function test_ResolveRejectsTwice() public {
        uint256 id = _newMarket();
        _stake(ALICE, id, true, 1 ether);
        _stake(BOB, id, false, 1 ether);
        vm.warp(closesAt);

        vm.startPrank(ORACLE);
        market.resolve(id, PredictionMarket.Outcome.Yes);
        vm.expectRevert();
        market.resolve(id, PredictionMarket.Outcome.No);
        vm.stopPrank();
    }

    function test_ResolveRejectsUnresolvedOutcome() public {
        uint256 id = _newMarket();
        vm.warp(closesAt);
        vm.prank(ORACLE);
        vm.expectRevert();
        market.resolve(id, PredictionMarket.Outcome.Unresolved);
    }

    function test_ResolveAccruesFeeFromLosingPoolOnly() public {
        uint256 id = _newMarket();
        _stake(ALICE, id, true, 1 ether);
        _stake(BOB, id, false, 4 ether);
        vm.warp(closesAt);

        vm.prank(ORACLE);
        market.resolve(id, PredictionMarket.Outcome.Yes);

        uint256 expectedFee = (4 ether * uint256(FEE_BPS)) / 10_000;
        assertEq(market.accruedFees(), expectedFee);
        assertEq(market.getMarket(id).feeOwed, expectedFee);
    }

    function test_WinWithEmptyWinningPoolDowngradesToInvalid() public {
        uint256 id = _newMarket();
        _stake(BOB, id, false, 5 ether);
        vm.warp(closesAt);

        // Nobody backed "yes", so there is no one to pay.
        vm.prank(ORACLE);
        market.resolve(id, PredictionMarket.Outcome.Yes);

        assertEq(uint8(market.getMarket(id).outcome), uint8(PredictionMarket.Outcome.Invalid));
        assertEq(market.accruedFees(), 0);
        assertEq(market.previewPayout(id, BOB), 5 ether);
    }

    /* ──────────────────────────── Expiry ──────────────────────────── */

    function test_ExpireRefundsEveryone() public {
        uint256 id = _newMarket();
        _stake(ALICE, id, true, 2 ether);
        _stake(BOB, id, false, 3 ether);
        vm.warp(resolvesBy + 1);

        market.expire(id);
        assertEq(uint8(market.getMarket(id).outcome), uint8(PredictionMarket.Outcome.Invalid));

        vm.prank(ALICE);
        market.claim(id);
        vm.prank(BOB);
        market.claim(id);

        assertEq(ALICE.balance, 100 ether);
        assertEq(BOB.balance, 100 ether);
        assertEq(address(market).balance, 0);
    }

    function test_ExpireRejectsBeforeDeadline() public {
        uint256 id = _newMarket();
        vm.warp(resolvesBy);
        vm.expectRevert();
        market.expire(id);
    }

    function test_ExpireRejectsResolvedMarket() public {
        uint256 id = _newMarket();
        _stake(ALICE, id, true, 1 ether);
        _stake(BOB, id, false, 1 ether);
        vm.warp(closesAt);
        vm.prank(ORACLE);
        market.resolve(id, PredictionMarket.Outcome.Yes);

        vm.warp(resolvesBy + 1);
        vm.expectRevert();
        market.expire(id);
    }

    /* ──────────────────────────── Claiming ────────────────────────── */

    function test_WinnersSplitLosingPoolProportionally() public {
        uint256 id = _newMarket();
        _stake(ALICE, id, true, 1 ether); // 25% of the yes pool
        _stake(CAROL, id, true, 3 ether); // 75% of the yes pool
        _stake(BOB, id, false, 4 ether);
        vm.warp(closesAt);

        vm.prank(ORACLE);
        market.resolve(id, PredictionMarket.Outcome.Yes);

        uint256 fee = (4 ether * uint256(FEE_BPS)) / 10_000;
        uint256 distributable = 4 ether - fee;

        vm.prank(ALICE);
        market.claim(id);
        vm.prank(CAROL);
        market.claim(id);

        assertEq(ALICE.balance, 99 ether + 1 ether + distributable / 4);
        assertEq(CAROL.balance, 97 ether + 3 ether + (distributable * 3) / 4);
        assertEq(market.previewPayout(id, BOB), 0);
    }

    function test_LoserCannotClaim() public {
        uint256 id = _newMarket();
        _stake(ALICE, id, true, 1 ether);
        _stake(BOB, id, false, 1 ether);
        vm.warp(closesAt);
        vm.prank(ORACLE);
        market.resolve(id, PredictionMarket.Outcome.Yes);

        vm.prank(BOB);
        vm.expectRevert();
        market.claim(id);
    }

    function test_ClaimRejectsBeforeResolution() public {
        uint256 id = _newMarket();
        _stake(ALICE, id, true, 1 ether);
        vm.prank(ALICE);
        vm.expectRevert();
        market.claim(id);
    }

    function test_ClaimRejectsTwice() public {
        uint256 id = _newMarket();
        _stake(ALICE, id, true, 1 ether);
        _stake(BOB, id, false, 1 ether);
        vm.warp(closesAt);
        vm.prank(ORACLE);
        market.resolve(id, PredictionMarket.Outcome.Yes);

        vm.startPrank(ALICE);
        market.claim(id);
        vm.expectRevert();
        market.claim(id);
        vm.stopPrank();
    }

    function test_ClaimRevertsWhenRecipientRejectsEther() public {
        RejectsEther hostile = new RejectsEther();
        vm.deal(address(hostile), 10 ether);

        uint256 id = _newMarket();
        hostile.stakeOn{value: 1 ether}(market, id, true);
        _stake(BOB, id, false, 1 ether);
        vm.warp(closesAt);
        vm.prank(ORACLE);
        market.resolve(id, PredictionMarket.Outcome.Yes);

        vm.expectRevert();
        hostile.claimFrom(market, id);
    }

    function test_StakerOnBothSidesIsRefundedTheLosingHalfOnly() public {
        uint256 id = _newMarket();
        _stake(ALICE, id, true, 1 ether);
        _stake(ALICE, id, false, 1 ether);
        _stake(BOB, id, false, 3 ether);
        vm.warp(closesAt);

        vm.prank(ORACLE);
        market.resolve(id, PredictionMarket.Outcome.Yes);

        // Alice's yes side is the entire winning pool, so she takes the whole
        // distributable losing pool plus her own winning stake back. Her losing
        // ether is gone, as it should be.
        uint256 losing = 4 ether;
        uint256 fee = (losing * uint256(FEE_BPS)) / 10_000;
        assertEq(market.previewPayout(id, ALICE), 1 ether + (losing - fee));
    }

    /* ────────────────────────────── Fees ──────────────────────────── */

    function test_WithdrawFeesSendsToTreasury() public {
        uint256 id = _newMarket();
        _stake(ALICE, id, true, 1 ether);
        _stake(BOB, id, false, 4 ether);
        vm.warp(closesAt);
        vm.prank(ORACLE);
        market.resolve(id, PredictionMarket.Outcome.Yes);

        uint256 fee = (4 ether * uint256(FEE_BPS)) / 10_000;
        market.withdrawFees();

        assertEq(TREASURY.balance, fee);
        assertEq(market.accruedFees(), 0);
    }

    function test_WithdrawFeesOnlyOwner() public {
        vm.prank(ALICE);
        vm.expectRevert();
        market.withdrawFees();
    }

    function test_WithdrawFeesRejectsWhenEmpty() public {
        vm.expectRevert();
        market.withdrawFees();
    }

    function test_FeeChangeDoesNotAffectLiveMarkets() public {
        uint256 id = _newMarket();
        market.setDefaultFeeBps(MAX_FEE());

        assertEq(market.getMarket(id).feeBps, FEE_BPS);
        uint256 next = _newMarket();
        assertEq(market.getMarket(next).feeBps, MAX_FEE());
    }

    function test_SetDefaultFeeRejectsAboveCap() public {
        uint16 aboveCap = MAX_FEE() + 1;

        vm.expectRevert();
        market.setDefaultFeeBps(aboveCap);
    }

    function test_AdminFunctionsAreOwnerOnly() public {
        vm.startPrank(ALICE);
        vm.expectRevert();
        market.setTreasury(ALICE);
        vm.expectRevert();
        market.setDefaultFeeBps(0);
        vm.expectRevert();
        market.transferOwnership(ALICE);
        vm.stopPrank();
    }

    function MAX_FEE() internal view returns (uint16) {
        return market.MAX_FEE_BPS();
    }

    /* ────────────────────────────── Fuzz ──────────────────────────── */

    /// @dev The contract must never owe more than it holds, whatever the split.
    function testFuzz_ContractStaysSolvent(uint96 yesAmount, uint96 noAmount, bool yesWins) public {
        vm.assume(yesAmount > 0 && noAmount > 0);

        uint256 id = _newMarket();
        vm.deal(ALICE, yesAmount);
        vm.deal(BOB, noAmount);
        _stake(ALICE, id, true, yesAmount);
        _stake(BOB, id, false, noAmount);

        vm.warp(closesAt);
        vm.prank(ORACLE);
        market.resolve(id, yesWins ? PredictionMarket.Outcome.Yes : PredictionMarket.Outcome.No);

        uint256 owed = market.previewPayout(id, ALICE) + market.previewPayout(id, BOB) + market.accruedFees();
        assertLe(owed, address(market).balance);
    }

    /// @dev A winner always gets at least their own stake back — the fee is only
    ///      ever taken from the side that lost.
    function testFuzz_WinnerNeverLosesPrincipal(uint96 yesAmount, uint96 noAmount) public {
        vm.assume(yesAmount > 0 && noAmount > 0);

        uint256 id = _newMarket();
        vm.deal(ALICE, yesAmount);
        vm.deal(BOB, noAmount);
        _stake(ALICE, id, true, yesAmount);
        _stake(BOB, id, false, noAmount);

        vm.warp(closesAt);
        vm.prank(ORACLE);
        market.resolve(id, PredictionMarket.Outcome.Yes);

        assertGe(market.previewPayout(id, ALICE), yesAmount);
    }

    /// @dev Refunds are exact: an invalidated market returns every wei staked.
    function testFuzz_InvalidRefundsExactly(uint96 yesAmount, uint96 noAmount) public {
        vm.assume(yesAmount > 0 && noAmount > 0);

        uint256 id = _newMarket();
        vm.deal(ALICE, yesAmount);
        vm.deal(BOB, noAmount);
        _stake(ALICE, id, true, yesAmount);
        _stake(BOB, id, false, noAmount);

        vm.warp(closesAt);
        vm.prank(ORACLE);
        market.resolve(id, PredictionMarket.Outcome.Invalid);

        assertEq(market.previewPayout(id, ALICE), yesAmount);
        assertEq(market.previewPayout(id, BOB), noAmount);
        assertEq(uint256(yesAmount) + noAmount, address(market).balance);
    }
}
