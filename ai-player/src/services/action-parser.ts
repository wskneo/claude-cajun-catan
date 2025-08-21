import { Logger } from 'winston';
import { createLogger } from '../utils/logger';
import { ParsedAction } from '../types';

export class ActionParser {
  private logger: Logger;

  constructor() {
    this.logger = createLogger('ActionParser');
  }

  /**
   * Parse action from LLM response text
   */
  parseAction(responseText: string, playerId: string): ParsedAction | null {
    try {
      // Extract action from XML-like tags
      const actionMatch = responseText.match(/<action>(.*?)<\/action>/s);
      if (!actionMatch) {
        this.logger.warn('No action tags found in LLM response', { 
          responsePreview: responseText.substring(0, 200) 
        });
        return this.tryFallbackParsing(responseText, playerId);
      }

      const actionContent = actionMatch[1].trim();
      
      // Try to parse as JSON
      let actionData;
      try {
        actionData = JSON.parse(actionContent);
      } catch (jsonError) {
        this.logger.warn('Failed to parse action JSON', { 
          actionContent,
          error: jsonError instanceof Error ? jsonError.message : 'Unknown error'
        });
        return this.tryFallbackParsing(actionContent, playerId);
      }

      // Validate basic structure
      if (!actionData.type) {
        this.logger.warn('Action missing type field', { actionData });
        return null;
      }

      // Ensure playerId is set
      const parsedAction: ParsedAction = {
        type: actionData.type,
        playerId: playerId,
        payload: actionData.payload || {}
      };

      // Validate and clean the action
      return this.validateAndCleanAction(parsedAction);

    } catch (error) {
      this.logger.error('Error parsing action', {
        error: error instanceof Error ? error.message : 'Unknown error',
        responsePreview: responseText.substring(0, 200)
      });
      return null;
    }
  }

  /**
   * Try alternative parsing methods when JSON parsing fails
   */
  private tryFallbackParsing(text: string, playerId: string): ParsedAction | null {
    // Try to extract action type from common patterns
    const patterns = [
      /BUILD_ROAD/i,
      /BUILD_SETTLEMENT/i, 
      /BUILD_CITY/i,
      /ROLL_DICE/i,
      /END_TURN/i,
      /BUY_DEVELOPMENT_CARD/i,
      /PLAY_DEVELOPMENT_CARD/i,
      /TRADE_WITH_BANK/i,
      /TRADE_WITH_PLAYER/i,
      /MOVE_ROBBER/i,
      /DISCARD_RESOURCES/i
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const actionType = match[0].toUpperCase();
        this.logger.info('Fallback parsing found action type', { actionType });
        
        return {
          type: actionType,
          playerId,
          payload: this.extractPayloadFromText(text, actionType)
        };
      }
    }

    return null;
  }

  /**
   * Extract payload information from text for fallback parsing
   */
  private extractPayloadFromText(text: string, actionType: string): any {
    const payload: any = {};

    switch (actionType) {
      case 'BUILD_ROAD':
        const edgeMatch = text.match(/edge[^a-z]*([a-z0-9_,-]+)/i);
        if (edgeMatch) payload.edgeId = edgeMatch[1];
        break;

      case 'BUILD_SETTLEMENT':
      case 'BUILD_CITY':
        const intersectionMatch = text.match(/intersection[^a-z]*([a-z0-9_,-]+)/i);
        if (intersectionMatch) payload.intersectionId = intersectionMatch[1];
        break;

      case 'MOVE_ROBBER':
        const coordMatch = text.match(/\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?/);
        if (coordMatch) {
          payload.robberLocation = { 
            q: parseInt(coordMatch[1]), 
            r: parseInt(coordMatch[2]) 
          };
        }
        break;

      case 'TRADE_WITH_BANK':
        // Try to extract basic trade information
        const giveMatch = text.match(/give\s+(\d+)\s+(\w+)/i);
        const getMatch = text.match(/get\s+(\d+)\s+(\w+)/i);
        if (giveMatch && getMatch) {
          payload.tradeOffer = {
            offering: { [giveMatch[2].toLowerCase()]: parseInt(giveMatch[1]) },
            requesting: { [getMatch[2].toLowerCase()]: parseInt(getMatch[1]) }
          };
        }
        break;

      case 'DISCARD_RESOURCES':
        // Try to extract discard amounts
        const resources = ['wood', 'brick', 'wool', 'wheat', 'ore'];
        const resourcesToDiscard: any = {};
        let totalDiscard = 0;
        
        resources.forEach(resource => {
          const match = text.match(new RegExp(`${resource}[^a-z]*?(\\d+)`, 'i'));
          if (match) {
            const amount = parseInt(match[1]);
            resourcesToDiscard[resource] = amount;
            totalDiscard += amount;
          }
        });
        
        if (totalDiscard > 0) {
          payload.resourcesToDiscard = resourcesToDiscard;
        }
        break;
    }

    return payload;
  }

  /**
   * Validate and clean the parsed action
   */
  private validateAndCleanAction(action: ParsedAction): ParsedAction | null {
    // Validate action type
    const validActionTypes = [
      'ROLL_DICE', 'BUILD_ROAD', 'BUILD_SETTLEMENT', 'BUILD_CITY',
      'BUY_DEVELOPMENT_CARD', 'PLAY_DEVELOPMENT_CARD', 'TRADE_WITH_BANK',
      'TRADE_WITH_PLAYER', 'MOVE_ROBBER', 'DISCARD_RESOURCES', 'END_TURN'
    ];

    if (!validActionTypes.includes(action.type)) {
      this.logger.warn('Invalid action type', { 
        actionType: action.type, 
        validTypes: validActionTypes 
      });
      return null;
    }

    // Action-specific validation and cleaning
    switch (action.type) {
      case 'BUILD_ROAD':
        if (!action.payload?.edgeId) {
          this.logger.warn('BUILD_ROAD missing edgeId');
          return null;
        }
        break;

      case 'BUILD_SETTLEMENT':
      case 'BUILD_CITY':
        if (!action.payload?.intersectionId) {
          this.logger.warn(`${action.type} missing intersectionId`);
          return null;
        }
        break;

      case 'MOVE_ROBBER':
        if (!action.payload?.robberLocation) {
          this.logger.warn('MOVE_ROBBER missing robberLocation');
          return null;
        }
        // Validate coordinate format
        const loc = action.payload.robberLocation;
        if (typeof loc.q !== 'number' || typeof loc.r !== 'number') {
          this.logger.warn('MOVE_ROBBER invalid coordinate format', { location: loc });
          return null;
        }
        break;

      case 'PLAY_DEVELOPMENT_CARD':
        if (!action.payload?.cardType) {
          this.logger.warn('PLAY_DEVELOPMENT_CARD missing cardType');
          return null;
        }
        
        const validCardTypes = ['knight', 'roadBuilding', 'invention', 'monopoly', 'victoryPoint'];
        if (!validCardTypes.includes(action.payload.cardType)) {
          this.logger.warn('PLAY_DEVELOPMENT_CARD invalid cardType', { 
            cardType: action.payload.cardType,
            validTypes: validCardTypes
          });
          return null;
        }
        break;

      case 'TRADE_WITH_BANK':
        if (!action.payload?.tradeOffer) {
          this.logger.warn('TRADE_WITH_BANK missing tradeOffer');
          return null;
        }
        // Ensure correct structure
        action.payload.tradeOffer.fromPlayerId = action.playerId;
        break;

      case 'DISCARD_RESOURCES':
        if (!action.payload?.resourcesToDiscard) {
          this.logger.warn('DISCARD_RESOURCES missing resourcesToDiscard');
          return null;
        }
        break;
    }

    this.logger.info('Successfully parsed action', { 
      type: action.type, 
      playerId: action.playerId,
      hasPayload: !!action.payload
    });

    return action;
  }

  /**
   * Extract reasoning from LLM response
   */
  extractReasoning(responseText: string): string | null {
    // Look for reasoning before the action tags
    const actionIndex = responseText.indexOf('<action>');
    if (actionIndex === -1) return null;

    const reasoningText = responseText.substring(0, actionIndex).trim();
    
    // Clean up common prefixes and formatting
    const cleaned = reasoningText
      .replace(/^(Reasoning|Analysis|Decision|Strategy):\s*/i, '')
      .replace(/^[*-]\s*/, '')
      .trim();

    return cleaned.length > 10 ? cleaned : null;
  }

  /**
   * Create a fallback action when parsing completely fails
   */
  createFallbackAction(playerId: string, validActions: string[]): ParsedAction {
    // Prefer safe actions that don't require parameters
    const safeActions = ['END_TURN', 'ROLL_DICE'];
    const availableSafeAction = safeActions.find(action => validActions.includes(action));
    
    if (availableSafeAction) {
      return {
        type: availableSafeAction,
        playerId,
        payload: {}
      };
    }

    // If no safe actions available, use the first valid action
    return {
      type: validActions[0] || 'END_TURN',
      playerId,
      payload: {}
    };
  }
}