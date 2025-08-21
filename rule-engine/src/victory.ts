import { GameState, Player } from './types';

export class VictoryManager {
  static calculateVictoryPoints(player: Player): number {
    let points = 0;

    // Buildings
    points += player.buildings.settlements.length * 1; // 1 VP per settlement
    points += player.buildings.cities.length * 2; // 2 VP per city

    // Special cards
    if (player.specialCards.longestRoad) {
      points += 2;
    }
    if (player.specialCards.largestArmy) {
      points += 2;
    }

    // Revealed victory point cards (stored in victoryPoints)
    points += player.victoryPoints - 
              player.buildings.settlements.length - 
              player.buildings.cities.length * 2 -
              (player.specialCards.longestRoad ? 2 : 0) -
              (player.specialCards.largestArmy ? 2 : 0);

    return points;
  }

  static updatePlayerVictoryPoints(gameState: GameState): GameState {
    const newState = { ...gameState };
    
    newState.players.forEach((player, index) => {
      newState.players[index].victoryPoints = this.calculateVictoryPoints(player);
    });

    return newState;
  }

  static checkWinCondition(gameState: GameState, playerId: string): boolean {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return false;

    return this.calculateVictoryPoints(player) >= 10;
  }

  static getWinner(gameState: GameState): Player | null {
    const playersWithWin = gameState.players.filter(player => 
      this.calculateVictoryPoints(player) >= 10
    );

    // Return the first player who reached 10 VP (they win immediately on their turn)
    return playersWithWin.length > 0 ? playersWithWin[0] : null;
  }

  static updateLongestRoad(gameState: GameState): GameState {
    const newState = { ...gameState };
    
    // Calculate longest road for each player
    const roadLengths = newState.players.map(player => ({
      playerId: player.id,
      length: this.calculateLongestRoadLength(newState, player.id)
    }));

    // Find the longest road (must be at least 5)
    const validRoads = roadLengths.filter(road => road.length >= 5);
    
    if (validRoads.length === 0) {
      // No one has longest road
      newState.players.forEach((player, index) => {
        if (player.specialCards.longestRoad) {
          newState.players[index].specialCards.longestRoad = false;
          newState.players[index].victoryPoints -= 2;
        }
      });
      return newState;
    }

    // Sort by road length (descending)
    validRoads.sort((a, b) => b.length - a.length);
    const longestLength = validRoads[0].length;
    
    // Check for ties at the longest length
    const tiedPlayers = validRoads.filter(road => road.length === longestLength);
    
    // Find current holder of longest road
    const currentHolder = newState.players.find(p => p.specialCards.longestRoad);
    
    if (tiedPlayers.length === 1) {
      // Clear winner
      const winnerId = tiedPlayers[0].playerId;
      
      // Remove from current holder if different
      if (currentHolder && currentHolder.id !== winnerId) {
        const currentHolderIndex = newState.players.findIndex(p => p.id === currentHolder.id);
        newState.players[currentHolderIndex].specialCards.longestRoad = false;
        newState.players[currentHolderIndex].victoryPoints -= 2;
      }
      
      // Give to new holder (if they don't already have it)
      if (!currentHolder || currentHolder.id !== winnerId) {
        const winnerIndex = newState.players.findIndex(p => p.id === winnerId);
        newState.players[winnerIndex].specialCards.longestRoad = true;
        newState.players[winnerIndex].victoryPoints += 2;
      }
    } else {
      // Tie situation - current holder keeps it if tied, otherwise no one gets it
      const currentHolderTied = currentHolder && 
        tiedPlayers.some(player => player.playerId === currentHolder.id);
      
      if (!currentHolderTied && currentHolder) {
        // Current holder no longer tied for longest, remove it
        const currentHolderIndex = newState.players.findIndex(p => p.id === currentHolder.id);
        newState.players[currentHolderIndex].specialCards.longestRoad = false;
        newState.players[currentHolderIndex].victoryPoints -= 2;
      }
    }

    return newState;
  }

  static updateLargestArmy(gameState: GameState): GameState {
    const newState = { ...gameState };
    
    // Find player with most knights (must be at least 3)
    const armySizes = newState.players.map(player => ({
      playerId: player.id,
      knights: player.knightsPlayed
    }));

    const validArmies = armySizes.filter(army => army.knights >= 3);
    
    if (validArmies.length === 0) {
      // No one has largest army
      newState.players.forEach((player, index) => {
        if (player.specialCards.largestArmy) {
          newState.players[index].specialCards.largestArmy = false;
          newState.players[index].victoryPoints -= 2;
        }
      });
      return newState;
    }

    // Sort by army size (descending)
    validArmies.sort((a, b) => b.knights - a.knights);
    const largestSize = validArmies[0].knights;
    
    // Check for ties at the largest size
    const tiedPlayers = validArmies.filter(army => army.knights === largestSize);
    
    // Find current holder of largest army
    const currentHolder = newState.players.find(p => p.specialCards.largestArmy);
    
    if (tiedPlayers.length === 1) {
      // Clear winner
      const winnerId = tiedPlayers[0].playerId;
      
      // Remove from current holder if different
      if (currentHolder && currentHolder.id !== winnerId) {
        const currentHolderIndex = newState.players.findIndex(p => p.id === currentHolder.id);
        newState.players[currentHolderIndex].specialCards.largestArmy = false;
        newState.players[currentHolderIndex].victoryPoints -= 2;
      }
      
      // Give to new holder (if they don't already have it)
      if (!currentHolder || currentHolder.id !== winnerId) {
        const winnerIndex = newState.players.findIndex(p => p.id === winnerId);
        newState.players[winnerIndex].specialCards.largestArmy = true;
        newState.players[winnerIndex].victoryPoints += 2;
      }
    } else {
      // Tie situation - current holder keeps it if tied, otherwise no one gets it
      const currentHolderTied = currentHolder && 
        tiedPlayers.some(player => player.playerId === currentHolder.id);
      
      if (!currentHolderTied && currentHolder) {
        // Current holder no longer tied for largest, remove it
        const currentHolderIndex = newState.players.findIndex(p => p.id === currentHolder.id);
        newState.players[currentHolderIndex].specialCards.largestArmy = false;
        newState.players[currentHolderIndex].victoryPoints -= 2;
      }
    }

    return newState;
  }

  private static calculateLongestRoadLength(gameState: GameState, playerId: string): number {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player || player.buildings.roads.length === 0) {
      return 0;
    }

    // Build adjacency graph of player's roads
    const roadGraph = this.buildRoadGraph(gameState, player.buildings.roads);
    
    let maxLength = 0;

    // Try starting from each road segment
    player.buildings.roads.forEach(roadId => {
      const length = this.depthFirstSearchLongestPath(roadGraph, roadId, new Set());
      maxLength = Math.max(maxLength, length);
    });

    return maxLength;
  }

  private static buildRoadGraph(gameState: GameState, roadIds: string[]): Map<string, string[]> {
    const graph = new Map<string, string[]>();
    
    // Initialize each road with empty adjacency list
    roadIds.forEach(roadId => {
      graph.set(roadId, []);
    });

    // For each road, find connected roads
    roadIds.forEach(roadId => {
      const edge = gameState.board.edges.get(roadId);
      if (!edge) return;

      const connectedRoads: string[] = [];

      // Check each intersection of this road
      edge.intersections.forEach(intersectionId => {
        const intersection = gameState.board.intersections.get(intersectionId);
        if (!intersection) return;

        // Find other roads connected to this intersection
        intersection.edges.forEach(connectedEdgeId => {
          if (connectedEdgeId !== roadId && roadIds.includes(connectedEdgeId)) {
            // Check if the path is not blocked by an opponent's building
            if (!this.isPathBlockedByOpponent(gameState, intersectionId, edge.road!.playerId)) {
              connectedRoads.push(connectedEdgeId);
            }
          }
        });
      });

      graph.set(roadId, connectedRoads);
    });

    return graph;
  }

  private static isPathBlockedByOpponent(
    gameState: GameState, 
    intersectionId: string, 
    playerId: string
  ): boolean {
    const intersection = gameState.board.intersections.get(intersectionId);
    if (!intersection?.building) return false;

    // Path is blocked if there's an opponent's building at this intersection
    return intersection.building.playerId !== playerId;
  }

  private static depthFirstSearchLongestPath(
    graph: Map<string, string[]>,
    currentRoad: string,
    visited: Set<string>
  ): number {
    visited.add(currentRoad);
    
    let maxPath = 0;
    const neighbors = graph.get(currentRoad) || [];

    for (const neighborRoad of neighbors) {
      if (!visited.has(neighborRoad)) {
        const pathLength = this.depthFirstSearchLongestPath(graph, neighborRoad, visited);
        maxPath = Math.max(maxPath, pathLength);
      }
    }

    visited.delete(currentRoad);
    return maxPath + 1;
  }

  static getVictoryPointBreakdown(player: Player): {
    settlements: number;
    cities: number;
    longestRoad: number;
    largestArmy: number;
    developmentCards: number;
    total: number;
  } {
    const settlements = player.buildings.settlements.length;
    const cities = player.buildings.cities.length * 2;
    const longestRoad = player.specialCards.longestRoad ? 2 : 0;
    const largestArmy = player.specialCards.largestArmy ? 2 : 0;
    
    // Development card VPs are already included in victoryPoints field
    const developmentCards = Math.max(0, 
      player.victoryPoints - settlements - cities - longestRoad - largestArmy
    );

    return {
      settlements,
      cities,
      longestRoad,
      largestArmy,
      developmentCards,
      total: settlements + cities + longestRoad + largestArmy + developmentCards
    };
  }

  static checkGameEnd(gameState: GameState): { gameEnded: boolean; winner?: Player } {
    const winner = this.getWinner(gameState);
    return {
      gameEnded: winner !== null,
      winner: winner || undefined
    };
  }
}