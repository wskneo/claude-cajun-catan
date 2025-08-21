# Cajun Catan

A complete implementation of Settlers of Catan with a stateless rule engine, AI players, and game components.

## Rule Engine

A stateless, pure-function rule engine for Settlers of Catan that validates and applies game actions according to official rules.

### Architecture

The rule engine follows the functional pattern: `(GameState + Action) -> New GameState | Error`

#### Core Components

- **CatanRuleEngine**: Main orchestrator that processes actions and manages game flow
- **BoardManager**: Handles hex grid topology, intersection/edge relationships  
- **BuildingManager**: Validates and processes settlement/city/road placement
- **ResourceManager**: Manages resource production, dice rolling, and distribution
- **TradingManager**: Handles player-to-player and bank trading
- **DevelopmentCardManager**: Manages development card purchases and effects
- **RobberManager**: Handles robber movement and resource stealing
- **VictoryManager**: Calculates victory points and determines game end

### Features

#### Game Flow
- ✅ Setup phases (initial settlement/road placement)
- ✅ Production phase (dice rolling, resource distribution)  
- ✅ Action phase (building, trading, development cards)
- ✅ Turn management and player validation

#### Building System
- ✅ Settlement placement with distance rule enforcement
- ✅ Road connectivity validation
- ✅ City upgrades from settlements
- ✅ Resource cost validation
- ✅ Building limit tracking (15 roads, 5 settlements, 4 cities per player)

#### Resource Management  
- ✅ Dice rolling with configurable randomness
- ✅ Resource distribution based on dice rolls
- ✅ Robber blocking (no resources on 7)
- ✅ Resource hand limits and discarding on 7
- ✅ Bank trading (4:1 generic, 3:1/2:1 ports)

#### Development Cards
- ✅ Knight cards (robber movement, largest army)
- ✅ Road Building (place 2 free roads)
- ✅ Year of Plenty (take 2 resources)
- ✅ Monopoly (take all of one resource type)
- ✅ Victory Point cards (hidden until game end)

#### Victory Conditions
- ✅ 10+ victory points to win
- ✅ Settlement (1 VP) and City (2 VP) scoring  
- ✅ Longest Road calculation (5+ roads, 2 VP)
- ✅ Largest Army tracking (3+ knights, 2 VP)
- ✅ Development card victory points

#### Trading System
- ✅ Player-to-player resource trading
- ✅ Bank trading with standard ratios
- ✅ Port trading bonuses
- ✅ Trade validation and execution

### Usage

#### Basic Game Flow

```typescript
import { CatanRuleEngine } from '@cajun-catan/rule-engine';

// Create a new game
const gameState = CatanRuleEngine.createNewGame(['alice', 'bob', 'charlie']);

// Process an action
const result = CatanRuleEngine.processAction(gameState, {
  type: 'BUILD_SETTLEMENT',
  playerId: 'alice', 
  payload: { intersectionId: 'i_0,0' }
});

if (result.success) {
  // Action succeeded, use result.newState
  console.log('Settlement built!');
} else {
  // Action failed, check result.error
  console.log('Build failed:', result.error);
}
```

#### Getting Valid Actions

```typescript
// Get all valid actions for current player
const validActions = CatanRuleEngine.getValidActions(gameState, 'alice');
// Returns: ['BUILD_SETTLEMENT', 'BUILD_ROAD'] during setup phase
```

### Testing

The rule engine includes **55 passing tests** covering:
- All action types and edge cases
- Setup phase behavior 
- Resource distribution and management
- Building placement validation
- Trading mechanics
- Development card effects
- Victory condition calculation
- Error handling and validation

Run tests:
```bash
cd rule-engine
npm test
```

### API Design

#### Pure Functions
All operations are pure functions that take current state + action and return new state or error. This enables:
- Easy testing and debugging
- Predictable behavior
- Time travel / undo functionality  
- Concurrent game simulations

#### Immutable State
Game state is never mutated directly. Each action creates a new state object, preventing bugs from accidental mutations.

#### Type Safety
Full TypeScript coverage ensures compile-time validation of game state structure and action payloads.

This rule engine provides a solid foundation for building Catan game servers, AI players, and interactive clients while ensuring accurate rule enforcement.