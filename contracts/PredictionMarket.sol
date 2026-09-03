// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

/// @title PredictionMarket
/// @notice Permissionless binary (yes/no) prediction markets settled parimutuel:
///         everyone who backs the winning side splits the losing side's stake in
///         proportion to what they put in, and gets their own stake back on top.
///
/// @dev Why parimutuel rather than an AMM or an order book: there is no liquidity
///      to bootstrap, no price to quote, and no path where the contract can end up
///      owing more than it holds. Payouts are pull-based and every state change
///      happens before value leaves the contract.
///
///      One contract holds many markets. Each market names its own oracle at
///      creation time and snapshots the protocol fee then, so a later fee change
///      by the owner can never alter the terms of a market people already entered.
contract PredictionMarket {
    /* ─────────────────────────────── Types ─────────────────────────────── */

    enum Outcome {
        Unresolved,
        Yes,
        No,
        Invalid
    }

    struct Market {
        // slot 0
        address oracle;
        uint64 closesAt;
        uint16 feeBps;
        Outcome outcome;
        // slot 1
        uint128 yesPool;
        uint128 noPool;
        // slot 2
        uint64 resolvesBy;
        uint128 feeOwed;
        // slot 3+
        string question;
    }

    /* ────────────────────────────── Constants ──────────────────────────── */

    /// @notice Hard ceiling on the protocol fee: 5%. The owner cannot exceed it.
    uint16 public constant MAX_FEE_BPS = 500;

    /// @notice An oracle gets at most this long after close to report an outcome.
    uint64 public constant MAX_RESOLUTION_WINDOW = 30 days;

    uint256 private constant BPS_DENOMINATOR = 10_000;
    uint256 private constant MIN_QUESTION_LENGTH = 8;
    uint256 private constant MAX_QUESTION_LENGTH = 256;

    /* ─────────────────────────────── Storage ───────────────────────────── */

    address public owner;
    address public treasury;
    uint16 public defaultFeeBps;

    /// @notice Fees collected across all resolved markets, awaiting withdrawal.
    uint256 public accruedFees;

    /// @notice Total number of markets ever created; also the next market id.
    uint256 public marketCount;

    mapping(uint256 marketId => Market) private _markets;
    mapping(uint256 marketId => mapping(address account => uint256)) public yesStakeOf;
    mapping(uint256 marketId => mapping(address account => uint256)) public noStakeOf;
    mapping(uint256 marketId => mapping(address account => bool)) public hasClaimed;

    uint256 private _reentrancyLock;

    /* ──────────────────────────────── Events ───────────────────────────── */

    event MarketCreated(
        uint256 indexed marketId,
        address indexed creator,
        address indexed oracle,
        string question,
        uint64 closesAt,
        uint64 resolvesBy,
        uint16 feeBps
    );
    event Staked(uint256 indexed marketId, address indexed account, bool backingYes, uint256 amount);
    event MarketResolved(uint256 indexed marketId, Outcome outcome, uint256 fee);
    event MarketExpired(uint256 indexed marketId);
    event Claimed(uint256 indexed marketId, address indexed account, uint256 payout);
    event FeesWithdrawn(address indexed to, uint256 amount);
    event OwnerChanged(address indexed previousOwner, address indexed newOwner);
    event TreasuryChanged(address indexed previousTreasury, address indexed newTreasury);
    event DefaultFeeChanged(uint16 previousFeeBps, uint16 newFeeBps);

    /* ──────────────────────────────── Errors ───────────────────────────── */

    error NotOwner();
    error NotOracle();
    error ZeroAddress();
    error FeeTooHigh(uint16 feeBps);
    error MarketNotFound(uint256 marketId);
    error QuestionLengthInvalid(uint256 length);
    error CloseTimeInPast(uint64 closesAt);
    error ResolutionWindowInvalid(uint64 closesAt, uint64 resolvesBy);
    error MarketClosed(uint256 marketId);
    error MarketNotClosed(uint256 marketId);
    error MarketAlreadyResolved(uint256 marketId);
    error MarketNotResolved(uint256 marketId);
    error ResolutionDeadlinePassed(uint256 marketId);
    error ResolutionDeadlineNotPassed(uint256 marketId);
    error InvalidOutcome();
    error ZeroStake();
    error StakeTooLarge(uint256 amount);
    error AlreadyClaimed(uint256 marketId, address account);
    error NothingToClaim(uint256 marketId, address account);
    error NothingToWithdraw();
    error TransferFailed(address to, uint256 amount);
    error Reentrancy();

    /* ────────────────────────────── Modifiers ──────────────────────────── */

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier nonReentrant() {
        if (_reentrancyLock == 1) revert Reentrancy();
        _reentrancyLock = 1;
        _;
        _reentrancyLock = 0;
    }

    modifier marketExists(uint256 marketId) {
        if (marketId >= marketCount) revert MarketNotFound(marketId);
        _;
    }

    /* ───────────────────────────── Constructor ─────────────────────────── */

    /// @param treasury_ Address that receives protocol fees.
    /// @param defaultFeeBps_ Fee applied to new markets, in basis points (max 500 = 5%).
    constructor(address treasury_, uint16 defaultFeeBps_) {
        if (treasury_ == address(0)) revert ZeroAddress();
        if (defaultFeeBps_ > MAX_FEE_BPS) revert FeeTooHigh(defaultFeeBps_);

        owner = msg.sender;
        treasury = treasury_;
        defaultFeeBps = defaultFeeBps_;

        emit OwnerChanged(address(0), msg.sender);
        emit TreasuryChanged(address(0), treasury_);
        emit DefaultFeeChanged(0, defaultFeeBps_);
    }

    /* ─────────────────────────── Market lifecycle ──────────────────────── */

    /// @notice Open a new market. Anyone may create one; the creator picks the
    ///         oracle, and stakers decide for themselves whether to trust it.
    /// @param question Human-readable claim being wagered on.
    /// @param closesAt Unix time after which staking stops. Must be in the future.
    /// @param resolvesBy Unix time by which the oracle must report. After this the
    ///        market can be expired by anyone and everyone is refunded.
    /// @param oracle Address permitted to resolve this market.
    /// @return marketId Identifier of the new market.
    function createMarket(
        string calldata question,
        uint64 closesAt,
        uint64 resolvesBy,
        address oracle
    ) external returns (uint256 marketId) {
        if (oracle == address(0)) revert ZeroAddress();

        uint256 length = bytes(question).length;
        if (length < MIN_QUESTION_LENGTH || length > MAX_QUESTION_LENGTH) {
            revert QuestionLengthInvalid(length);
        }
        if (closesAt <= block.timestamp) revert CloseTimeInPast(closesAt);
        if (resolvesBy <= closesAt || resolvesBy > closesAt + MAX_RESOLUTION_WINDOW) {
            revert ResolutionWindowInvalid(closesAt, resolvesBy);
        }

        marketId = marketCount++;
        uint16 feeBps = defaultFeeBps;

        Market storage market = _markets[marketId];
        market.oracle = oracle;
        market.closesAt = closesAt;
        market.feeBps = feeBps;
        market.resolvesBy = resolvesBy;
        market.question = question;

        emit MarketCreated(marketId, msg.sender, oracle, question, closesAt, resolvesBy, feeBps);
    }

    /// @notice Back one side of a market with ETH. Callable repeatedly; stakes add up.
    /// @param marketId Market to stake on.
    /// @param backingYes True to back "yes", false to back "no".
    function stake(uint256 marketId, bool backingYes) external payable marketExists(marketId) {
        if (msg.value == 0) revert ZeroStake();
        if (msg.value > type(uint128).max) revert StakeTooLarge(msg.value);

        Market storage market = _markets[marketId];
        if (block.timestamp >= market.closesAt) revert MarketClosed(marketId);

        if (backingYes) {
            market.yesPool += uint128(msg.value);
            yesStakeOf[marketId][msg.sender] += msg.value;
        } else {
            market.noPool += uint128(msg.value);
            noStakeOf[marketId][msg.sender] += msg.value;
        }

        emit Staked(marketId, msg.sender, backingYes, msg.value);
    }

    /// @notice Report the outcome. Only the market's oracle, only between close
    ///         and the resolution deadline.
    /// @dev A win for a side nobody backed is downgraded to `Invalid`: there is no
    ///      one to pay, so the honest result is to refund both sides rather than
    ///      strand the losing pool in the contract.
    function resolve(uint256 marketId, Outcome outcome) external marketExists(marketId) {
        if (outcome == Outcome.Unresolved) revert InvalidOutcome();

        Market storage market = _markets[marketId];
        if (msg.sender != market.oracle) revert NotOracle();
        if (market.outcome != Outcome.Unresolved) revert MarketAlreadyResolved(marketId);
        if (block.timestamp < market.closesAt) revert MarketNotClosed(marketId);
        if (block.timestamp > market.resolvesBy) revert ResolutionDeadlinePassed(marketId);

        uint256 winningPool = outcome == Outcome.Yes ? market.yesPool : market.noPool;
        uint256 losingPool = outcome == Outcome.Yes ? market.noPool : market.yesPool;

        if (outcome != Outcome.Invalid && winningPool == 0) {
            outcome = Outcome.Invalid;
        }

        uint256 fee;
        if (outcome != Outcome.Invalid) {
            // The fee comes out of the losing pool only, so a winner never
            // receives less than the stake they put in.
            fee = (losingPool * market.feeBps) / BPS_DENOMINATOR;
            market.feeOwed = uint128(fee);
            accruedFees += fee;
        }

        market.outcome = outcome;
        emit MarketResolved(marketId, outcome, fee);
    }

    /// @notice Mark an unresolved market invalid once its oracle has missed the
    ///         deadline. Permissionless — anyone can unlock refunds.
    function expire(uint256 marketId) external marketExists(marketId) {
        Market storage market = _markets[marketId];
        if (market.outcome != Outcome.Unresolved) revert MarketAlreadyResolved(marketId);
        if (block.timestamp <= market.resolvesBy) revert ResolutionDeadlineNotPassed(marketId);

        market.outcome = Outcome.Invalid;
        emit MarketExpired(marketId);
    }

    /* ──────────────────────────────── Payouts ──────────────────────────── */

    /// @notice Withdraw winnings, or a refund if the market was invalidated.
    function claim(uint256 marketId) external nonReentrant marketExists(marketId) returns (uint256 payout) {
        Market storage market = _markets[marketId];
        if (market.outcome == Outcome.Unresolved) revert MarketNotResolved(marketId);
        if (hasClaimed[marketId][msg.sender]) revert AlreadyClaimed(marketId, msg.sender);

        payout = _payoutOf(market, marketId, msg.sender);
        if (payout == 0) revert NothingToClaim(marketId, msg.sender);

        // Effects before interaction: the claim flag and both stake slots are
        // cleared before any ETH moves.
        hasClaimed[marketId][msg.sender] = true;
        delete yesStakeOf[marketId][msg.sender];
        delete noStakeOf[marketId][msg.sender];

        emit Claimed(marketId, msg.sender, payout);
        _send(msg.sender, payout);
    }

    /// @notice What `account` would receive from `claim`, ignoring whether they
    ///         already have. Returns 0 while the market is unresolved.
    function previewPayout(uint256 marketId, address account)
        external
        view
        marketExists(marketId)
        returns (uint256)
    {
        Market storage market = _markets[marketId];
        if (market.outcome == Outcome.Unresolved || hasClaimed[marketId][account]) return 0;
        return _payoutOf(market, marketId, account);
    }

    function _payoutOf(Market storage market, uint256 marketId, address account)
        private
        view
        returns (uint256)
    {
        uint256 yes = yesStakeOf[marketId][account];
        uint256 no = noStakeOf[marketId][account];

        if (market.outcome == Outcome.Invalid) {
            return yes + no;
        }

        bool yesWon = market.outcome == Outcome.Yes;
        uint256 winningStake = yesWon ? yes : no;
        if (winningStake == 0) return 0;

        uint256 winningPool = yesWon ? market.yesPool : market.noPool;
        uint256 losingPool = yesWon ? market.noPool : market.yesPool;
        uint256 distributable = losingPool - market.feeOwed;

        // Stake back, plus a proportional slice of what the other side lost.
        // Integer division rounds down; the remainder (at most `winningPool - 1`
        // wei per market) stays in the contract as dust.
        return winningStake + (winningStake * distributable) / winningPool;
    }

    /* ──────────────────────────────── Admin ────────────────────────────── */

    function withdrawFees() external onlyOwner nonReentrant returns (uint256 amount) {
        amount = accruedFees;
        if (amount == 0) revert NothingToWithdraw();

        accruedFees = 0;
        emit FeesWithdrawn(treasury, amount);
        _send(treasury, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnerChanged(owner, newOwner);
        owner = newOwner;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        emit TreasuryChanged(treasury, newTreasury);
        treasury = newTreasury;
    }

    /// @dev Only affects markets created after this call — live markets keep the
    ///      fee they were opened with.
    function setDefaultFeeBps(uint16 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh(newFeeBps);
        emit DefaultFeeChanged(defaultFeeBps, newFeeBps);
        defaultFeeBps = newFeeBps;
    }

    /* ──────────────────────────────── Views ────────────────────────────── */

    function getMarket(uint256 marketId) external view marketExists(marketId) returns (Market memory) {
        return _markets[marketId];
    }

    /// @notice Implied probability of "yes", in basis points. 0 before any stake.
    function impliedYesProbabilityBps(uint256 marketId)
        external
        view
        marketExists(marketId)
        returns (uint256)
    {
        Market storage market = _markets[marketId];
        uint256 total = uint256(market.yesPool) + uint256(market.noPool);
        if (total == 0) return 0;
        return (uint256(market.yesPool) * BPS_DENOMINATOR) / total;
    }

    function isOpen(uint256 marketId) external view marketExists(marketId) returns (bool) {
        return block.timestamp < _markets[marketId].closesAt;
    }

    /* ──────────────────────────────── Internal ─────────────────────────── */

    function _send(address to, uint256 amount) private {
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed(to, amount);
    }
}
