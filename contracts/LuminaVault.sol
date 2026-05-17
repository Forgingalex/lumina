// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title LuminaVault
 * @author Lumina Protocol
 * @notice Business-grade savings and on-chain reputation contract for the Celo/MiniPay ecosystem.
 *         Accepts USDm deposits, enforces a 3-day Commitment Period on withdrawals, and computes
 *         a deterministic, non-transferable Lumina Score (0-1000) based on total volume and
 *         deposit consistency.
 * @dev    All external write functions are designed for CIP-64 (Fee Abstraction) compatibility,
 *         so merchants can pay gas in USDm via the Celo Fee Adapter. No native CELO is required.
 */
contract LuminaVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────────────────────────────
    //  Constants & Immutables
    // ──────────────────────────────────────────────────────────────────────

    /// @notice USDm token address
    IERC20 public immutable USDm;

    /// @notice Commitment period before withdrawal can be finalized (3 days)
    uint256 public constant COMMITMENT_PERIOD = 3 days;

    /// @notice Maximum possible Lumina Score
    uint256 public constant MAX_SCORE = 1000;

    /// @notice Volume threshold for maximum volume component (100,000 USDm at 18 decimals)
    uint256 public constant VOLUME_CEILING = 100_000 * 1e18;

    /// @notice Duration threshold for maximum consistency component (365 days)
    uint256 public constant CONSISTENCY_CEILING = 365 days;

    /// @notice Minimum deposit amount (0.01 USDm)
    uint256 public constant MIN_DEPOSIT = 1e16;

    // ──────────────────────────────────────────────────────────────────────
    //  Storage
    // ──────────────────────────────────────────────────────────────────────

    struct MerchantState {
        uint256 balance;              // Current USDm held in vault
        uint256 totalOrchestrated;    // Lifetime USDm deposited through protocol
        uint256 depositCount;         // Number of deposits made
        uint256 firstDepositAt;       // Timestamp of the very first deposit
        uint256 lastDepositAt;        // Timestamp of the most recent deposit
        uint256 withdrawalRequestAt;  // Timestamp of pending withdrawal request (0 = none)
    }

    /// @notice Per-merchant vault state
    mapping(address => MerchantState) public merchants;

    /// @notice Per-merchant Lumina Score (non-transferable reputation)
    mapping(address => uint256) public luminaScore;

    // ──────────────────────────────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────────────────────────────

    event FlowOrchestrated(address indexed merchant, uint256 amount);
    event ScoreIncreased(address indexed merchant, uint256 newScore);
    event WithdrawalRequested(address indexed merchant, uint256 amount, uint256 unlockAt);
    event WithdrawalFinalized(address indexed merchant, uint256 amount);

    // ──────────────────────────────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────────────────────────────

    error DepositBelowMinimum(uint256 amount, uint256 minimum);
    error NoBalance();
    error WithdrawalAlreadyPending();
    error NoWithdrawalPending();
    error CommitmentPeriodActive(uint256 unlockAt);

    // ──────────────────────────────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────────────────────────────

    constructor(address _usdm) Ownable(msg.sender) {
        USDm = IERC20(_usdm);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  External: Deposit
    // ──────────────────────────────────────────────────────────────────────

    /**
     * @notice Deposit USDm into the merchant's vault. The deposit is credited to the
     *         caller's balance and contributes to their Lumina Score.
     * @param amount Amount of USDm (18 decimals) to deposit.
     * @dev    Requires prior ERC-20 approval. CIP-64 compatible: callers can pay gas
     *         in USDm by setting `feeCurrency` on the transaction envelope.
     */
    function deposit(uint256 amount) external nonReentrant {
        if (amount < MIN_DEPOSIT) {
            revert DepositBelowMinimum(amount, MIN_DEPOSIT);
        }

        USDm.safeTransferFrom(msg.sender, address(this), amount);

        MerchantState storage state = merchants[msg.sender];

        // Initialize first-deposit timestamp
        if (state.firstDepositAt == 0) {
            state.firstDepositAt = block.timestamp;
        }

        state.balance += amount;
        state.totalOrchestrated += amount;
        state.depositCount += 1;
        state.lastDepositAt = block.timestamp;

        emit FlowOrchestrated(msg.sender, amount);

        // Recompute and persist score
        uint256 newScore = _computeScore(msg.sender);
        if (newScore > luminaScore[msg.sender]) {
            luminaScore[msg.sender] = newScore;
            emit ScoreIncreased(msg.sender, newScore);
        }
    }

    // ──────────────────────────────────────────────────────────────────────
    //  External: Withdrawal (Two-Phase Commitment)
    // ──────────────────────────────────────────────────────────────────────

    /**
     * @notice Request a withdrawal of the full vault balance. Initiates the 3-day
     *         Commitment Period. The merchant cannot deposit or request again until
     *         the withdrawal is finalized or cancelled.
     * @dev    CIP-64 compatible. Gas paid in USDm.
     */
    function requestWithdrawal() external nonReentrant {
        MerchantState storage state = merchants[msg.sender];

        if (state.balance == 0) {
            revert NoBalance();
        }

        if (state.withdrawalRequestAt != 0) {
            revert WithdrawalAlreadyPending();
        }

        state.withdrawalRequestAt = block.timestamp;

        emit WithdrawalRequested(
            msg.sender,
            state.balance,
            block.timestamp + COMMITMENT_PERIOD
        );
    }

    /**
     * @notice Finalize a pending withdrawal after the 3-day Commitment Period has elapsed.
     *         Transfers the full balance back to the merchant.
     * @dev    CIP-64 compatible. Gas paid in USDm.
     */
    function finalizeWithdrawal() external nonReentrant {
        MerchantState storage state = merchants[msg.sender];

        if (state.withdrawalRequestAt == 0) {
            revert NoWithdrawalPending();
        }

        uint256 unlockAt = state.withdrawalRequestAt + COMMITMENT_PERIOD;
        if (block.timestamp < unlockAt) {
            revert CommitmentPeriodActive(unlockAt);
        }

        uint256 amount = state.balance;
        state.balance = 0;
        state.withdrawalRequestAt = 0;

        USDm.safeTransfer(msg.sender, amount);

        emit WithdrawalFinalized(msg.sender, amount);
    }

    /**
     * @notice Cancel a pending withdrawal request, keeping funds in the vault.
     * @dev    CIP-64 compatible. Allows merchant to continue accruing reputation.
     */
    function cancelWithdrawal() external nonReentrant {
        MerchantState storage state = merchants[msg.sender];

        if (state.withdrawalRequestAt == 0) {
            revert NoWithdrawalPending();
        }

        state.withdrawalRequestAt = 0;
    }

    // ──────────────────────────────────────────────────────────────────────
    //  External: Views
    // ──────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the full merchant state and computed score.
     * @param merchant The merchant address to query.
     */
    function getMerchantProfile(address merchant)
        external
        view
        returns (
            uint256 balance,
            uint256 totalOrchestrated,
            uint256 depositCount,
            uint256 firstDepositAt,
            uint256 lastDepositAt,
            uint256 withdrawalRequestAt,
            uint256 score,
            uint256 withdrawalUnlockAt
        )
    {
        MerchantState memory state = merchants[merchant];
        return (
            state.balance,
            state.totalOrchestrated,
            state.depositCount,
            state.firstDepositAt,
            state.lastDepositAt,
            state.withdrawalRequestAt,
            luminaScore[merchant],
            state.withdrawalRequestAt == 0
                ? 0
                : state.withdrawalRequestAt + COMMITMENT_PERIOD
        );
    }

    /**
     * @notice Preview what the Lumina Score would be for a given merchant without
     *         modifying state. Useful for UI display.
     * @param merchant The merchant address to query.
     * @return score The current computed score (0-1000).
     */
    function previewScore(address merchant) external view returns (uint256 score) {
        return _computeScore(merchant);
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Internal: Score Computation
    // ──────────────────────────────────────────────────────────────────────

    /**
     * @dev Compute the Lumina Score as a deterministic function of:
     *      1. Volume Component (60%): sqrt(totalOrchestrated / VOLUME_CEILING) * 600
     *         Uses Babylonian sqrt for on-chain precision.
     *      2. Consistency Component (40%): (tenure / CONSISTENCY_CEILING) * 400
     *         where tenure = block.timestamp - firstDepositAt.
     *
     *      Both components are capped at their respective maximums.
     *      Result is always in [0, 1000].
     */
    function _computeScore(address merchant) internal view returns (uint256) {
        MerchantState memory state = merchants[merchant];

        if (state.firstDepositAt == 0 || state.totalOrchestrated == 0) {
            return 0;
        }

        // --- Volume Component (0 - 600) ---
        // Normalized ratio: totalOrchestrated * 1e18 / VOLUME_CEILING, capped at 1e18
        uint256 volumeRatio = state.totalOrchestrated >= VOLUME_CEILING
            ? 1e18
            : (state.totalOrchestrated * 1e18) / VOLUME_CEILING;

        // sqrt(volumeRatio) in 1e18 scale using Babylonian method
        uint256 sqrtVolume = _sqrt(volumeRatio * 1e18); // sqrt(ratio * 1e18) => result in 1e18 scale
        uint256 volumeScore = (sqrtVolume * 600) / 1e18;
        if (volumeScore > 600) {
            volumeScore = 600;
        }

        // --- Consistency Component (0 - 400) ---
        uint256 tenure = block.timestamp - state.firstDepositAt;
        uint256 consistencyScore;
        if (tenure >= CONSISTENCY_CEILING) {
            consistencyScore = 400;
        } else {
            consistencyScore = (tenure * 400) / CONSISTENCY_CEILING;
        }

        return volumeScore + consistencyScore;
    }

    /**
     * @dev Babylonian integer square root. Returns floor(sqrt(x)).
     *      Used for the sub-linear volume scaling curve.
     */
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;

        uint256 z = (x + 1) / 2;
        uint256 y = x;

        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }

        return y;
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Owner: Emergency
    // ──────────────────────────────────────────────────────────────────────

    /**
     * @notice Emergency withdrawal of all USDm held by the contract (owner only).
     *         Should only be used in critical situations.
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = USDm.balanceOf(address(this));
        USDm.safeTransfer(owner(), balance);
    }
}
