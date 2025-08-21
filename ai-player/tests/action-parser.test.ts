import { ActionParser } from '../src/services/action-parser';

describe('ActionParser', () => {
  let parser: ActionParser;

  beforeEach(() => {
    parser = new ActionParser();
  });

  describe('parseAction', () => {
    it('should parse valid JSON action from response', () => {
      const response = `I think the best move is to build a road.

<action>
{
  "type": "BUILD_ROAD",
  "payload": { "edgeId": "e_0,0_1,0" }
}
</action>`;

      const action = parser.parseAction(response, 'player1');

      expect(action).toEqual({
        type: 'BUILD_ROAD',
        playerId: 'player1',
        payload: { edgeId: 'e_0,0_1,0' }
      });
    });

    it('should parse action without payload', () => {
      const response = `Let me roll the dice.

<action>
{
  "type": "ROLL_DICE"
}
</action>`;

      const action = parser.parseAction(response, 'player1');

      expect(action).toEqual({
        type: 'ROLL_DICE',
        playerId: 'player1',
        payload: {}
      });
    });

    it('should handle malformed JSON with fallback parsing', () => {
      const response = `I want to BUILD_ROAD at edge e_1,0_2,0`;

      const action = parser.parseAction(response, 'player1');

      expect(action?.type).toBe('BUILD_ROAD');
      expect(action?.playerId).toBe('player1');
    });

    it('should return null for invalid action types', () => {
      const response = `<action>
{
  "type": "INVALID_ACTION",
  "payload": {}
}
</action>`;

      const action = parser.parseAction(response, 'player1');

      expect(action).toBeNull();
    });

    it('should validate required payload fields', () => {
      const response = `<action>
{
  "type": "BUILD_ROAD"
}
</action>`;

      const action = parser.parseAction(response, 'player1');

      expect(action).toBeNull();
    });

    it('should handle MOVE_ROBBER action correctly', () => {
      const response = `<action>
{
  "type": "MOVE_ROBBER",
  "payload": {
    "robberLocation": { "q": 1, "r": -1 },
    "targetPlayerId": "player2"
  }
}
</action>`;

      const action = parser.parseAction(response, 'player1');

      expect(action).toEqual({
        type: 'MOVE_ROBBER',
        playerId: 'player1',
        payload: {
          robberLocation: { q: 1, r: -1 },
          targetPlayerId: 'player2'
        }
      });
    });

    it('should handle trade actions correctly', () => {
      const response = `<action>
{
  "type": "TRADE_WITH_BANK",
  "payload": {
    "tradeOffer": {
      "offering": { "wood": 4 },
      "requesting": { "brick": 1 }
    }
  }
}
</action>`;

      const action = parser.parseAction(response, 'player1');

      expect(action?.type).toBe('TRADE_WITH_BANK');
      expect(action?.payload.tradeOffer.fromPlayerId).toBe('player1');
    });
  });

  describe('extractReasoning', () => {
    it('should extract reasoning before action tags', () => {
      const response = `I need to build a road to extend my network and potentially work toward longest road.

<action>
{
  "type": "BUILD_ROAD",
  "payload": { "edgeId": "e_0,0_1,0" }
}
</action>`;

      const reasoning = parser.extractReasoning(response);

      expect(reasoning).toBe('I need to build a road to extend my network and potentially work toward longest road.');
    });

    it('should return null when no reasoning found', () => {
      const response = `<action>
{
  "type": "END_TURN",
  "payload": {}
}
</action>`;

      const reasoning = parser.extractReasoning(response);

      expect(reasoning).toBeNull();
    });
  });

  describe('createFallbackAction', () => {
    it('should prefer safe actions', () => {
      const action = parser.createFallbackAction('player1', ['BUILD_ROAD', 'END_TURN', 'ROLL_DICE']);

      expect(['END_TURN', 'ROLL_DICE']).toContain(action.type);
    });

    it('should use first action when no safe actions available', () => {
      const action = parser.createFallbackAction('player1', ['BUILD_ROAD', 'BUILD_SETTLEMENT']);

      expect(action.type).toBe('BUILD_ROAD');
    });

    it('should default to END_TURN when no valid actions', () => {
      const action = parser.createFallbackAction('player1', []);

      expect(action.type).toBe('END_TURN');
    });
  });
});