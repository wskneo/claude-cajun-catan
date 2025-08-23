import axios from 'axios';
import { GameState, Action } from '../types/game-types';

export interface AIDecisionRequest {
  gameState: GameState;
  playerId: string;
  validActions: string[];
}

export interface AIDecisionResponse {
  action: Action;
  reasoning?: string;
}

export class AICoordinator {
  private aiServiceUrl?: string;
  private requestTimeout: number = 10000; // 10 seconds

  constructor(aiServiceUrl?: string) {
    this.aiServiceUrl = aiServiceUrl;
  }

  async getAIDecision(gameState: GameState, playerId: string, validActions: string[]): Promise<Action | null> {
    if (!this.aiServiceUrl) {
      console.warn('AI service URL not configured, using fallback decision');
      return this.getFallbackDecision(gameState, playerId, validActions);
    }

    try {
      const request: AIDecisionRequest = {
        gameState,
        playerId,
        validActions
      };

      const response = await axios.post<AIDecisionResponse>(
        `${this.aiServiceUrl}/ai/decision`,
        request,
        {
          timeout: this.requestTimeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.action) {
        console.log(`AI player ${playerId} chose action: ${response.data.action.type}`);
        if (response.data.reasoning) {
          console.log(`AI reasoning: ${response.data.reasoning}`);
        }
        return response.data.action;
      } else {
        console.warn('Invalid AI response format, using fallback');
        return this.getFallbackDecision(gameState, playerId, validActions);
      }
    } catch (error) {
      console.error('AI service error:', error);
      return this.getFallbackDecision(gameState, playerId, validActions);
    }
  }

  private getFallbackDecision(gameState: GameState, playerId: string, validActions: string[]): Action | null {
    if (validActions.length === 0) {
      return null;
    }

    // Simple fallback logic
    if (validActions.includes('ROLL_DICE')) {
      return { type: 'ROLL_DICE', playerId };
    }

    if (validActions.includes('END_TURN')) {
      return { type: 'END_TURN', playerId };
    }

    // For setup phases, try to build
    if (gameState.phase === 'SETUP_ROUND_1' || gameState.phase === 'SETUP_ROUND_2') {
      if (validActions.includes('BUILD_SETTLEMENT')) {
        // Find first available intersection for settlement
        const availableIntersections = this.getAvailableIntersections(gameState);
        if (availableIntersections.length > 0) {
          return {
            type: 'BUILD_SETTLEMENT',
            playerId,
            payload: { intersectionId: availableIntersections[0] }
          };
        }
      }
      
      if (validActions.includes('BUILD_ROAD')) {
        // Find first available edge for road
        const availableEdges = this.getAvailableEdges(gameState, playerId);
        if (availableEdges.length > 0) {
          return {
            type: 'BUILD_ROAD',
            playerId,
            payload: { edgeId: availableEdges[0] }
          };
        }
      }
    }

    // Default to first available action
    const actionType = validActions[0] as any;
    return { type: actionType, playerId };
  }

  private getAvailableIntersections(gameState: GameState): string[] {
    const available: string[] = [];
    
    // Simplified fallback for board access
    if (!gameState.board.intersections) return available;
    
    for (const [intersectionId, intersection] of gameState.board.intersections) {
      if (!intersection.building) {
        // Check distance rule (settlements must be at least 2 edges apart)
        let tooClose = false;
        for (const edgeId of intersection.edges) {
          const edge = gameState.board.edges.get(edgeId);
          if (edge) {
            for (const adjIntersectionId of edge.intersections) {
              if (adjIntersectionId !== intersectionId) {
                const adjIntersection = gameState.board.intersections.get(adjIntersectionId);
                if (adjIntersection?.building) {
                  tooClose = true;
                  break;
                }
              }
            }
          }
          if (tooClose) break;
        }
        
        if (!tooClose) {
          available.push(intersectionId);
        }
      }
    }
    
    return available;
  }

  private getAvailableEdges(gameState: GameState, playerId: string): string[] {
    const available: string[] = [];
    const player = gameState.players.find((p: any) => p.id === playerId);
    
    if (!player || !gameState.board.edges) return available;

    for (const [edgeId, edge] of gameState.board.edges) {
      if (!edge.road) {
        // Check if player has a settlement/city on one of the intersections
        // or a road connected to this edge
        let canBuild = false;
        
        for (const intersectionId of edge.intersections) {
          const intersection = gameState.board.intersections.get(intersectionId);
          if (intersection?.building?.playerId === playerId) {
            canBuild = true;
            break;
          }
          
          // Check connected roads
          if (intersection) {
            for (const connectedEdgeId of intersection.edges) {
              if (connectedEdgeId !== edgeId) {
                const connectedEdge = gameState.board.edges.get(connectedEdgeId);
                if (connectedEdge?.road?.playerId === playerId) {
                  canBuild = true;
                  break;
                }
              }
            }
          }
          
          if (canBuild) break;
        }
        
        if (canBuild) {
          available.push(edgeId);
        }
      }
    }
    
    return available;
  }

  isConfigured(): boolean {
    return Boolean(this.aiServiceUrl);
  }

  setAIServiceUrl(url: string): void {
    this.aiServiceUrl = url;
  }

  setTimeout(timeoutMs: number): void {
    this.requestTimeout = timeoutMs;
  }
}