import { 
  GameState, 
  Action, 
  GameResult, 
  Player, 
  HexCoordinate, 
  TradeOffer,
  GamePhase,
  DevelopmentCardType
} from './types';
import { BoardGenerator } from './board';
import { ResourceManager } from './resources';
import { BuildingManager } from './building';
import { TradingManager } from './trading';
import { DevelopmentCardManager } from './development-cards';
import { RobberManager } from './robber';
import { VictoryManager } from './victory';

export class CatanRuleEngine {
  static processAction(gameState: GameState, action: Action): GameResult {
    try {
      let newState = { ...gameState };

      switch (action.type) {
        case 'ROLL_DICE':
          newState = this.handleRollDice(newState, action);
          break;
        
        case 'BUILD_ROAD':
          newState = this.handleBuildRoad(newState, action);
          break;
        
        case 'BUILD_SETTLEMENT':
          newState = this.handleBuildSettlement(newState, action);
          break;
        
        case 'BUILD_CITY':
          newState = this.handleBuildCity(newState, action);
          break;
        
        case 'BUY_DEVELOPMENT_CARD':
          newState = this.handleBuyDevelopmentCard(newState, action);
          break;
        
        case 'PLAY_DEVELOPMENT_CARD':
          newState = this.handlePlayDevelopmentCard(newState, action);
          break;
        
        case 'TRADE_WITH_PLAYER':
          newState = this.handlePlayerTrade(newState, action);
          break;
        
        case 'TRADE_WITH_BANK':
          newState = this.handleBankTrade(newState, action);
          break;
        
        case 'MOVE_ROBBER':
          newState = this.handleMoveRobber(newState, action);
          break;
        
        case 'DISCARD_RESOURCES':
          newState = this.handleDiscardResources(newState, action);
          break;
        
        case 'END_TURN':
          newState = this.handleEndTurn(newState, action);
          break;
        
        default:
          return { 
            success: false, 
            error: `Unknown action type: ${action.type}` 
          };
      }

      // Update victory conditions after every action
      newState = VictoryManager.updateLongestRoad(newState);
      newState = VictoryManager.updateLargestArmy(newState);

      // Check for win condition
      const gameEnd = VictoryManager.checkGameEnd(newState);
      if (gameEnd.gameEnded) {
        newState.phase = 'GAME_OVER';
        newState.winner = gameEnd.winner?.id;
      }

      return { success: true, newState };
      
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  static createNewGame(playerIds: string[]): GameState {
    if (playerIds.length < 2 || playerIds.length > 4) {
      throw new Error('Game requires 2-4 players');
    }

    const players: Player[] = playerIds.map((id, index) => ({
      id,
      color: ['red', 'blue', 'white', 'orange'][index],
      resources: { wood: 0, brick: 0, wool: 0, wheat: 0, ore: 0 },
      developmentCards: { knight: 0, roadBuilding: 0, invention: 0, monopoly: 0, victoryPoint: 0 },
      buildings: { roads: [], settlements: [], cities: [] },
      specialCards: { longestRoad: false, largestArmy: false },
      knightsPlayed: 0,
      victoryPoints: 0,
      canPlayDevCard: true
    }));

    const board = BoardGenerator.generateStandardBoard();
    const developmentCardDeck = DevelopmentCardManager.createStandardDeck();

    return {
      id: `game_${Date.now()}`,
      phase: 'SETUP_ROUND_1',
      currentPlayerIndex: 0,
      players,
      board,
      developmentCardDeck,
      turn: 1
    };
  }

  private static handleRollDice(gameState: GameState, action: Action): GameState {
    if (gameState.phase !== 'PRODUCTION') {
      throw new Error('Can only roll dice during production phase');
    }

    if (gameState.players[gameState.currentPlayerIndex].id !== action.playerId) {
      throw new Error('Not your turn to roll dice');
    }

    const diceRoll = ResourceManager.rollDice();
    const diceSum = diceRoll[0] + diceRoll[1];
    
    let newState: GameState = { ...gameState, diceRoll };
    
    if (diceSum === 7) {
      // Handle seven rolled - discard phase will be handled separately
      const sevenResult = RobberManager.handleSevenRolled(newState);
      newState = { ...sevenResult.newState, diceRoll };
      // Game engine should handle the discard phase
    } else {
      newState = { ...ResourceManager.distributeResources(newState, diceSum), diceRoll };
    }

    // Transition to action phase (unless seven was rolled and discards are needed)
    if (diceSum !== 7 || RobberManager.isDiscardPhaseComplete(newState)) {
      newState.phase = 'ACTION';
    }

    return newState;
  }

  private static handleBuildRoad(gameState: GameState, action: Action): GameState {
    if (gameState.players[gameState.currentPlayerIndex].id !== action.playerId) {
      throw new Error('Not your turn to build');
    }
    const { edgeId } = action.payload;
    return BuildingManager.buildRoad(gameState, action.playerId, edgeId);
  }

  private static handleBuildSettlement(gameState: GameState, action: Action): GameState {
    if (gameState.players[gameState.currentPlayerIndex].id !== action.playerId) {
      throw new Error('Not your turn to build');
    }
    const { intersectionId } = action.payload;
    return BuildingManager.buildSettlement(gameState, action.playerId, intersectionId);
  }

  private static handleBuildCity(gameState: GameState, action: Action): GameState {
    if (gameState.players[gameState.currentPlayerIndex].id !== action.playerId) {
      throw new Error('Not your turn to build');
    }
    const { intersectionId } = action.payload;
    return BuildingManager.buildCity(gameState, action.playerId, intersectionId);
  }

  private static handleBuyDevelopmentCard(gameState: GameState, action: Action): GameState {
    return DevelopmentCardManager.buyDevelopmentCard(gameState, action.playerId);
  }

  private static handlePlayDevelopmentCard(gameState: GameState, action: Action): GameState {
    const { cardType, ...cardPayload } = action.payload;

    switch (cardType) {
      case 'knight':
        const { robberLocation, targetPlayerId } = cardPayload;
        return DevelopmentCardManager.playKnightCard(
          gameState, 
          action.playerId, 
          robberLocation, 
          targetPlayerId
        );
      
      case 'roadBuilding':
        const { edgeIds } = cardPayload;
        return DevelopmentCardManager.playRoadBuildingCard(
          gameState, 
          action.playerId, 
          edgeIds
        );
      
      case 'invention':
        const { resources } = cardPayload;
        return DevelopmentCardManager.playInventionCard(
          gameState, 
          action.playerId, 
          resources
        );
      
      case 'monopoly':
        const { resourceType } = cardPayload;
        return DevelopmentCardManager.playMonopolyCard(
          gameState, 
          action.playerId, 
          resourceType
        );
      
      case 'victoryPoint':
        return DevelopmentCardManager.playVictoryPointCard(gameState, action.playerId);
      
      default:
        throw new Error(`Unknown development card type: ${cardType}`);
    }
  }

  private static handlePlayerTrade(gameState: GameState, action: Action): GameState {
    const { tradeOffer } = action.payload as { tradeOffer: TradeOffer };
    return TradingManager.executeTrade(gameState, tradeOffer);
  }

  private static handleBankTrade(gameState: GameState, action: Action): GameState {
    const { tradeOffer } = action.payload as { tradeOffer: TradeOffer };
    return TradingManager.executeTrade(gameState, tradeOffer);
  }

  private static handleMoveRobber(gameState: GameState, action: Action): GameState {
    const { robberLocation, targetPlayerId } = action.payload;
    return RobberManager.moveRobber(
      gameState, 
      action.playerId, 
      robberLocation, 
      targetPlayerId
    );
  }

  private static handleDiscardResources(gameState: GameState, action: Action): GameState {
    const { resourcesToDiscard } = action.payload;
    return ResourceManager.discardResources(
      gameState, 
      action.playerId, 
      resourcesToDiscard
    );
  }

  private static handleEndTurn(gameState: GameState, action: Action): GameState {
    if (gameState.players[gameState.currentPlayerIndex].id !== action.playerId) {
      throw new Error('Not your turn to end turn');
    }

    let newState = { ...gameState };
    
    // Reset development card play flag for next turn
    newState = DevelopmentCardManager.resetPlayDevCardFlag(newState);
    
    // Advance to next player
    newState.currentPlayerIndex = (newState.currentPlayerIndex + 1) % newState.players.length;
    
    // If we've completed a full round, increment turn counter
    if (newState.currentPlayerIndex === 0) {
      newState.turn++;
    }

    // Set phase based on game state
    if (newState.phase === 'SETUP_ROUND_1') {
      if (newState.currentPlayerIndex === 0 && newState.turn > 1) {
        // All players placed first settlement/road, start round 2 in reverse order
        newState.phase = 'SETUP_ROUND_2';
        newState.currentPlayerIndex = newState.players.length - 1;
      }
    } else if (newState.phase === 'SETUP_ROUND_2') {
      if (newState.currentPlayerIndex === 0) {
        // Setup complete, start regular gameplay
        newState.phase = 'PRODUCTION';
      }
    } else {
      // Regular gameplay - next turn starts with production phase
      newState.phase = 'PRODUCTION';
    }

    return newState;
  }

  // Utility methods for game state queries
  static getValidActions(gameState: GameState, playerId: string): string[] {
    const validActions: string[] = [];
    const isCurrentPlayer = gameState.players[gameState.currentPlayerIndex].id === playerId;
    const player = gameState.players.find(p => p.id === playerId);

    if (!player || !isCurrentPlayer) {
      return validActions;
    }

    switch (gameState.phase) {
      case 'SETUP_ROUND_1':
      case 'SETUP_ROUND_2':
        // During setup, players can only build settlements and roads
        validActions.push('BUILD_SETTLEMENT', 'BUILD_ROAD');
        break;
      
      case 'PRODUCTION':
        validActions.push('ROLL_DICE');
        // Can also play development cards before rolling
        const playableCardsProduction = DevelopmentCardManager.getPlayableDevelopmentCards(player);
        if (playableCardsProduction.length > 0) {
          validActions.push('PLAY_DEVELOPMENT_CARD');
        }
        break;
      
      case 'ACTION':
        validActions.push('END_TURN');
        
        // Building actions
        if (BuildingManager.canPlayerBuild(player, 'road')) {
          validActions.push('BUILD_ROAD');
        }
        if (BuildingManager.canPlayerBuild(player, 'settlement')) {
          validActions.push('BUILD_SETTLEMENT');
        }
        if (BuildingManager.canPlayerBuild(player, 'city')) {
          validActions.push('BUILD_CITY');
        }
        
        // Development card actions
        if (DevelopmentCardManager.canBuyDevelopmentCard(gameState, playerId).valid) {
          validActions.push('BUY_DEVELOPMENT_CARD');
        }
        
        const playableCardsAction = DevelopmentCardManager.getPlayableDevelopmentCards(player);
        if (playableCardsAction.length > 0) {
          validActions.push('PLAY_DEVELOPMENT_CARD');
        }
        
        // Trading actions
        validActions.push('TRADE_WITH_BANK', 'TRADE_WITH_PLAYER');
        
        break;
    }

    return validActions;
  }

  static getGameSummary(gameState: GameState): {
    phase: GamePhase;
    currentPlayer: string;
    turn: number;
    playerStats: Array<{
      id: string;
      victoryPoints: number;
      resourceCount: number;
      developmentCardCount: number;
    }>;
  } {
    return {
      phase: gameState.phase,
      currentPlayer: gameState.players[gameState.currentPlayerIndex].id,
      turn: gameState.turn,
      playerStats: gameState.players.map(player => ({
        id: player.id,
        victoryPoints: VictoryManager.calculateVictoryPoints(player),
        resourceCount: ResourceManager.getTotalResources(player.resources),
        developmentCardCount: Object.values(player.developmentCards).reduce((sum, count) => sum + count, 0)
      }))
    };
  }
}