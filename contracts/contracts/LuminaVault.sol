// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract LuminaVault is Ownable {
    IERC20 public immutable usdmToken;

    mapping(address => uint256) public balances;
    mapping(address => uint256) public luminaScore;
    mapping(address => uint256) public lastDepositTime;

    event Deposited(address indexed user, uint256 amount);
    event ScoreUpdated(address indexed user, uint256 newScore);

    constructor(address _usdmToken) Ownable(msg.sender) {
        usdmToken = IERC20(_usdmToken);
    }

    // MANDATORY: This matches what your Next.js app is calling
    function getMerchantProfile(address merchant) external view returns (
        uint256 balance,
        uint256 score,
        uint256 lastActivity
    ) {
        return (balances[merchant], luminaScore[merchant], lastDepositTime[merchant]);
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        
        // Transfer USDC from user to this vault
        usdmToken.transferFrom(msg.sender, address(this), amount);
        
        balances[msg.sender] += amount;
        lastDepositTime[msg.sender] = block.timestamp;
        
        // Logic: Increase reputation score on every deposit
        luminaScore[msg.sender] += 10; 
        
        emit Deposited(msg.sender, amount);
        emit ScoreUpdated(msg.sender, luminaScore[msg.sender]);
    }
}
