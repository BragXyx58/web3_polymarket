// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PredictionMarket {
    struct Market {
        uint256 id;
        string question;
        string description; 
        string imageUrl;    
        uint256 endTime;
        bool resolved;
        uint8 winningOption;
        uint256 totalPool;
        uint256 poolYes;
        uint256 poolNo;
    }

    uint256 public marketCount;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => mapping(uint8 => uint256))) public bets;
    address public admin;

    event MarketCreated(uint256 indexed id, string question, uint256 endTime);
    event BetPlaced(uint256 indexed marketId, address indexed user, uint8 option, uint256 amount);
    event CashedOut(uint256 indexed marketId, address indexed user, uint256 amountReturned);
    event MarketResolved(uint256 indexed id, uint8 winningOption);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);

    constructor() {
        admin = msg.sender;
    }

    function createMarket(string memory _question, string memory _desc, string memory _img, uint256 _durationSeconds) external {
        require(msg.sender == admin, "Only admin");
        marketCount++;
        markets[marketCount] = Market(
            marketCount, _question, _desc, _img, block.timestamp + _durationSeconds, false, 0, 0, 0, 0
        );
        emit MarketCreated(marketCount, _question, block.timestamp + _durationSeconds);
    }

    function bet(uint256 _marketId, uint8 _option) external payable {
        Market storage market = markets[_marketId];
        require(block.timestamp < market.endTime, "Market is closed");
        require(!market.resolved, "Market already resolved");
        require(_option == 1 || _option == 2, "Invalid option");
        require(msg.value > 0, "Bet must be > 0");

        market.totalPool += msg.value;
        if (_option == 1) { market.poolYes += msg.value; } 
        else { market.poolNo += msg.value; }

        bets[_marketId][msg.sender][_option] += msg.value;
        
        emit BetPlaced(_marketId, msg.sender, _option, msg.value);
    }

    function cashOut(uint256 _marketId, uint8 _option) external {
        Market storage market = markets[_marketId];
        require(block.timestamp < market.endTime, "Market closed");
        require(!market.resolved, "Already resolved");

        uint256 userBet = bets[_marketId][msg.sender][_option];
        require(userBet > 0, "No bets to cash out");

        uint256 payout = (userBet * 90) / 100;

        market.totalPool -= payout;
        if (_option == 1) { market.poolYes -= payout; } 
        else { market.poolNo -= payout; }

        bets[_marketId][msg.sender][_option] = 0;
        payable(msg.sender).transfer(payout);

        emit CashedOut(_marketId, msg.sender, payout);
    }

    function resolveMarket(uint256 _marketId, uint8 _winningOption) external {
        require(msg.sender == admin, "Only admin");
        Market storage market = markets[_marketId];
        require(!market.resolved, "Already resolved");
        require(_winningOption == 1 || _winningOption == 2, "Invalid option");

        market.resolved = true;
        market.winningOption = _winningOption;
        
        emit MarketResolved(_marketId, _winningOption);
    }

    function claimWinnings(uint256 _marketId) external {
        Market storage market = markets[_marketId];
        require(market.resolved, "Market not resolved");

        uint256 userBet = bets[_marketId][msg.sender][market.winningOption];
        require(userBet > 0, "No winning bets");
        bets[_marketId][msg.sender][market.winningOption] = 0;

        uint256 winningPool = market.winningOption == 1 ? market.poolYes : market.poolNo;
        uint256 payout = (userBet * market.totalPool) / winningPool;

        payable(msg.sender).transfer(payout);
        
        emit WinningsClaimed(_marketId, msg.sender, payout);
    }
}