// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract LuminaVault is Ownable, ReentrancyGuard {
    // merchant => token => balance
    mapping(address => mapping(address => uint256)) public balances;
    mapping(address => uint256) public luminaScore;
    mapping(address => uint256) public totalOrchestrated;

    event Orchestrated(address indexed merchant, address indexed token, uint256 amount);
    event Withdrawn(address indexed merchant, address indexed token, uint256 amount);
    event ScoreUpdated(address indexed merchant, uint256 newScore);

    constructor() Ownable(msg.sender) {}

    // Deposit: MERCHANT COMMITMENT
    function deposit(address token, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        
        balances[msg.sender][token] += amount;
        totalOrchestrated[msg.sender] += amount;
        
        // Increase reputation for saving/orchestrating
        luminaScore[msg.sender] += 10;
        
        emit Orchestrated(msg.sender, token, amount);
        emit ScoreUpdated(msg.sender, luminaScore[msg.sender]);
    }

    // Withdraw: OPERATIONAL OUTFLOW
    function withdraw(address token, uint256 amount) external nonReentrant {
        require(balances[msg.sender][token] >= amount, "Insufficient vault balance");
        
        balances[msg.sender][token] -= amount;
        IERC20(token).transfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, token, amount);
    }

    function getMerchantProfile(address merchant) external view returns (
        uint256 score,
        uint256 totalVolume
    ) {
        return (luminaScore[merchant], totalOrchestrated[merchant]);
    }
}
