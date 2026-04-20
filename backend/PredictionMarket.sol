// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract PredictionMarket {
    struct Market {
        uint256 id;
        string question;  
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

    constructor() {
        admin = msg.sender;
    }

    function createMarket(string memory _question, uint256 _durationSeconds) external {
        require(msg.sender == admin, "Only admin can create markets");
        marketCount++;
        markets[marketCount] = Market(
            marketCount, _question, block.timestamp + _durationSeconds, false, 0, 0, 0, 0
        );
    }

    function bet(uint256 _marketId, uint8 _option) external payable {
        Market storage market = markets[_marketId];
        require(block.timestamp < market.endTime, "Market is closed");
        require(!market.resolved, "Market already resolved");
        require(_option == 1 || _option == 2, "Invalid option");
        require(msg.value > 0, "Bet must be greater than 0");

        market.totalPool += msg.value;
        if (_option == 1) {
            market.poolYes += msg.value;
        } else {
            market.poolNo += msg.value;
        }

        bets[_marketId][msg.sender][_option] += msg.value;
    }

   function resolveMarket(uint256 _marketId, uint8 _winningOption) external {
        require(msg.sender == admin, "Only admin can resolve");
        Market storage market = markets[_marketId];
        
        // require(block.timestamp >= market.endTime, "Event not ended yet"); 
        
        require(!market.resolved, "Already resolved");
        require(_winningOption == 1 || _winningOption == 2, "Invalid option");

        market.resolved = true;
        market.winningOption = _winningOption;
    }

    function claimWinnings(uint256 _marketId) external {
        Market storage market = markets[_marketId];
        require(market.resolved, "Market not resolved");

        uint256 userBet = bets[_marketId][msg.sender][market.winningOption];
        require(userBet > 0, "No winning bets to claim");
        bets[_marketId][msg.sender][market.winningOption] = 0;

        uint256 winningPool = market.winningOption == 1 ? market.poolYes : market.poolNo;
        uint256 payout = (userBet * market.totalPool) / winningPool;

        payable(msg.sender).transfer(payout);
    }
}