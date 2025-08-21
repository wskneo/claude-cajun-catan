export class CatanPrompts {
  
  static readonly SYSTEM_PROMPT = `You are an AI assistant playing Settlers of Catan. You are a strategic player who makes logical decisions based on the game state.

KEY RULES TO REMEMBER:
- Settlements are worth 1 VP, cities are worth 2 VP
- First to 10 VP wins immediately
- Roads must connect to your existing roads or buildings
- Settlements must be at least 2 edges away from other buildings
- Cities can only be built on your existing settlements
- Development cards cost 1 ore + 1 wool + 1 wheat
- Knight cards move the robber and steal resources
- You can only play 1 dev card per turn (except VP cards)

RESPONSE FORMAT: Always end your response with a valid action in this format:
<action>
{
  "type": "ACTION_TYPE",
  "payload": { "key": "value" }
}
</action>

Be concise but explain your reasoning. Focus on winning the game efficiently.`;

  static createDecisionPrompt(gameState: string, validActions: string[]): string {
    return `${this.SYSTEM_PROMPT}

${gameState}

## AVAILABLE ACTIONS
You can choose from these actions: ${validActions.join(', ')}

## YOUR DECISION
Analyze the current situation and choose the best action. Consider:
1. Victory point progress (are you close to winning?)
2. Resource efficiency (do you need specific resources?)
3. Blocking opponents (are they close to winning?)
4. Long-term strategy (building towards longest road/largest army?)

What is your best move right now?`;
  }

  static createBuildingPrompt(gameState: string, buildingType: 'road' | 'settlement' | 'city', locations: string[]): string {
    const buildingAdvice = {
      road: 'Consider connectivity, longest road potential, and blocking opponents',
      settlement: 'Look for good resource diversity, port access, and expansion potential',
      city: 'Upgrade settlements on your best resource hexes first'
    };

    return `${this.SYSTEM_PROMPT}

${gameState}

## BUILDING DECISION: ${buildingType.toUpperCase()}
Available locations: ${locations.join(', ')}

Strategy tips for ${buildingType}: ${buildingAdvice[buildingType]}

Choose the best location and explain why. Consider resource production, strategic position, and blocking opponents.

<action>
{
  "type": "BUILD_${buildingType.toUpperCase()}",
  "payload": { "${buildingType === 'road' ? 'edgeId' : 'intersectionId'}": "LOCATION_ID" }
}
</action>`;
  }

  static createTradingPrompt(gameState: string, tradeOpportunities: Array<{give: string, get: string, ratio: number}>): string {
    return `${this.SYSTEM_PROMPT}

${gameState}

## TRADING DECISION
Available trades (give:get at ratio):
${tradeOpportunities.map(t => `- Give ${t.give} : Get ${t.get} (${t.ratio}:1 ratio)`).join('\n')}

Consider:
1. What resources do you need most urgently?
2. What resources do you have in excess?
3. What are your building priorities?
4. Should you trade with the bank or wait for player trades?

Choose a trade or skip trading this turn.

<action>
{
  "type": "TRADE_WITH_BANK",
  "payload": {
    "tradeOffer": {
      "fromPlayerId": "YOUR_PLAYER_ID",
      "offering": { "RESOURCE": AMOUNT },
      "requesting": { "RESOURCE": AMOUNT }
    }
  }
}
</action>

Or to skip trading:
<action>
{
  "type": "END_TURN",
  "payload": {}
}
</action>`;
  }

  static createDevelopmentCardPrompt(gameState: string, availableCards: string[]): string {
    const cardEffects = {
      knight: 'Move robber, steal resource, work toward largest army (2 VP at 3+ knights)',
      roadBuilding: 'Build 2 roads for free, great for longest road strategy',
      invention: 'Take any 2 resources from supply, very flexible',
      monopoly: 'Take all of one resource type from all opponents',
      victoryPoint: 'Immediate 1 VP, can be played anytime (even when bought)'
    };

    return `${this.SYSTEM_PROMPT}

${gameState}

## DEVELOPMENT CARD DECISION
Available cards to play: ${availableCards.join(', ')}

Card effects:
${availableCards.map(card => `- ${card}: ${cardEffects[card as keyof typeof cardEffects] || 'Unknown effect'}`).join('\n')}

Which card should you play? Consider immediate needs vs long-term strategy.

Examples:
<action>
{
  "type": "PLAY_DEVELOPMENT_CARD",
  "payload": {
    "cardType": "knight",
    "robberLocation": { "q": 0, "r": 1 },
    "targetPlayerId": "opponent_id"
  }
}
</action>

<action>
{
  "type": "PLAY_DEVELOPMENT_CARD",
  "payload": {
    "cardType": "invention",
    "resources": ["wood", "brick"]
  }
}
</action>`;
  }

  static createRobberPrompt(gameState: string, validLocations: Array<{q: number, r: number}>, stealTargets: string[]): string {
    return `${this.SYSTEM_PROMPT}

${gameState}

## ROBBER PLACEMENT DECISION
You must move the robber and may steal a resource.

Valid robber locations: ${validLocations.map(loc => `(${loc.q},${loc.r})`).join(', ')}
Players you can steal from: ${stealTargets.join(', ') || 'None'}

Strategy:
1. Block the most productive hex for opponents
2. Target the player with the most resources or closest to winning
3. Avoid blocking your own important hexes

<action>
{
  "type": "MOVE_ROBBER",
  "payload": {
    "robberLocation": { "q": 0, "r": 1 },
    "targetPlayerId": "player_to_steal_from_or_null"
  }
}
</action>`;
  }

  static createDiscardPrompt(gameState: string, mustDiscard: number): string {
    return `${this.SYSTEM_PROMPT}

${gameState}

## RESOURCE DISCARD (7 was rolled!)
You have more than 7 resources and must discard exactly ${mustDiscard} cards.

Strategy:
1. Keep resources you need for immediate building plans
2. Discard excess resources or those hardest to use
3. Consider what opponents might want (don't help them by discarding useful trades)

<action>
{
  "type": "DISCARD_RESOURCES",
  "payload": {
    "resourcesToDiscard": {
      "wood": 0,
      "brick": 0,
      "wool": 1,
      "wheat": 1,
      "ore": 0
    }
  }
}
</action>`;
  }

  static createSetupPrompt(gameState: string, phase: string, availableLocations: string[]): string {
    const isFirstRound = phase === 'SETUP_ROUND_1';
    const advice = isFirstRound 
      ? 'Focus on resource diversity and good number probabilities (6,8 are best, 5,9 good, avoid 2,12)'
      : 'Consider your first settlement and aim for different resources or better numbers';

    return `${this.SYSTEM_PROMPT}

${gameState}

## SETUP PHASE: ${phase}
Available settlement locations: ${availableLocations.join(', ')}

Setup strategy (${isFirstRound ? 'first' : 'second'} settlement):
${advice}

After placing settlement, you must place a road adjacent to it.

<action>
{
  "type": "BUILD_SETTLEMENT",
  "payload": { "intersectionId": "INTERSECTION_ID" }
}
</action>`;
  }

  static createProductionPhasePrompt(gameState: string): string {
    return `${this.SYSTEM_PROMPT}

${gameState}

## PRODUCTION PHASE
You must roll the dice to start resource production.

You can also play a development card before rolling if you have one and want to use it strategically.

<action>
{
  "type": "ROLL_DICE",
  "payload": {}
}
</action>

Or play a development card first:
<action>
{
  "type": "PLAY_DEVELOPMENT_CARD",
  "payload": { "cardType": "CARD_TYPE", ... }
}
</action>`;
  }

  static createQuickDecisionPrompt(gameState: string, validActions: string[], timeRemaining: number): string {
    return `QUICK DECISION NEEDED (${timeRemaining}ms remaining):

${gameState}

Available actions: ${validActions.join(', ')}

Make a fast but reasonable decision. Prioritize:
1. Actions that gain victory points
2. Actions that improve resource position  
3. Actions that don't help opponents

<action>
{
  "type": "ACTION_TYPE",
  "payload": {}
}
</action>`;
  }

  static createErrorRecoveryPrompt(error: string, gameState: string, validActions: string[]): string {
    return `${this.SYSTEM_PROMPT}

PREVIOUS ACTION ERROR: ${error}

${gameState}

Please choose a different, valid action from: ${validActions.join(', ')}

Make sure your action format is exactly correct and the action is currently allowed.

<action>
{
  "type": "VALID_ACTION_TYPE",
  "payload": { "correctFormat": "here" }
}
</action>`;
  }
}