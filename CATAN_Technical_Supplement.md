# CATAN - Technical Implementation Supplement

This document provides the technical details missing from the main rulebook needed for code implementation.

## BOARD LAYOUT

### Standard 3-4 Player Board

The board consists of 19 hexagonal terrain tiles arranged in a hexagonal pattern:

```
    [  ] [  ] [  ]
  [  ] [  ] [  ] [  ]
[  ] [  ] [  ] [  ] [  ]
  [  ] [  ] [  ] [  ]
    [  ] [  ] [  ]
```

**Hex Coordinates (using axial coordinate system):**

- Center hex: (0, 0)
- Ring 1 (6 hexes): (1,0), (0,1), (-1,1), (-1,0), (0,-1), (1,-1)
- Ring 2 (12 hexes): (2,0), (1,1), (0,2), (-1,2), (-2,2), (-2,1), (-2,0), (-1,-1), (0,-2), (1,-2), (2,-2), (2,-1)

### Number Disc Distribution

**Standard Setup (18 discs total):**

- 2: 1 disc (probability: 1/36)
- 3: 2 discs (probability: 2/36)
- 4: 2 discs (probability: 3/36)
- 5: 2 discs (probability: 4/36)
- 6: 2 discs (probability: 5/36)
- 8: 2 discs (probability: 5/36)
- 9: 2 discs (probability: 4/36)
- 10: 2 discs (probability: 3/36)
- 11: 2 discs (probability: 2/36)
- 12: 1 disc (probability: 1/36)

**Letter Order for Variable Setup:**
A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R

### Port Locations and Types

**9 Ports Total (3-4 Player Board):**

**3:1 Generic Ports (4 ports):**

- Northwest edge
- Northeast edge
- East edge
- Southwest edge

**2:1 Specific Resource Ports (5 ports):**

- Brick (2:1) - South edge
- Wood (2:1) - Southeast edge
- Wool (2:1) - West edge  
- Wheat (2:1) - Northwest edge
- Ore (2:1) - North edge

**Port Positioning:**
Each port spans 2 adjacent vertices on the coastline. Players need a settlement or city on one of these vertices to use the port.

## INTERSECTION AND EDGE CONNECTIVITY

### Intersection Rules

**Each hex has 6 vertices (intersections):**

- Numbered clockwise starting from top vertex
- Each intersection connects exactly 3 hexes (except coastal intersections)
- Each intersection connects exactly 3 edges

**Distance Rule Implementation:**

- No two buildings can be placed on adjacent intersections
- Adjacent = connected by a single edge
- Measure shortest path along edges, not direct distance

### Edge Connectivity

**Each hex has 6 edges:**

- Each edge connects exactly 2 intersections
- Roads must form continuous paths
- Roads cannot "jump" across intersections

**Longest Road Calculation:**

```
function calculateLongestRoad(player):
    roads = player.getRoads()
    maxLength = 0

    for each endpoint in roads:
        length = depthFirstSearch(endpoint, roads, visited=[])
        maxLength = max(maxLength, length)

    return maxLength

function depthFirstSearch(currentEdge, roads, visited):
    visited.add(currentEdge)
    maxPath = 0

    for each connectedEdge in getConnectedRoads(currentEdge, roads):
        if connectedEdge not in visited:
            pathLength = 1 + depthFirstSearch(connectedEdge, roads, visited)
            maxPath = max(maxPath, pathLength)

    visited.remove(currentEdge)
    return maxPath
```

## GAME STATE MANAGEMENT

### Player State Structure

```
Player {
    id: string
    color: string
    resources: {
        wood: int,
        brick: int,
        wool: int,
        wheat: int,
        ore: int
    }
    developmentCards: {
        knight: int,
        roadBuilding: int,
        invention: int,
        monopoly: int,
        victoryPoint: int
    }
    buildings: {
        roads: Edge[],
        settlements: Intersection[],
        cities: Intersection[]
    }
    specialCards: {
        longestRoad: boolean,
        largestArmy: boolean
    }
    knightsPlayed: int
    victoryPoints: int
    canPlayDevCard: boolean // false if bought this turn
}
```

### Turn State Machine

```
GamePhase {
    SETUP_ROUND_1,
    SETUP_ROUND_2, 
    PRODUCTION,
    ACTION,
    GAME_OVER
}

ActionType {
    ROLL_DICE,
    PLAY_DEVELOPMENT_CARD,
    BUILD_ROAD,
    BUILD_SETTLEMENT,
    BUILD_CITY,
    BUY_DEVELOPMENT_CARD,
    TRADE_WITH_PLAYER,
    TRADE_WITH_BANK,
    MOVE_ROBBER,
    DISCARD_RESOURCES,
    END_TURN
}
```

### Resource Discard on 7

```
function handleSevenRolled():
    // Phase 1: Discard resources
    for each player:
        resourceCount = player.getTotalResources()
        if resourceCount > 7:
            discardCount = floor(resourceCount / 2)
            player.selectCardsToDiscard(discardCount)

    // Phase 2: Move robber
    currentPlayer.selectNewRobberLocation()
    if hasAdjacentBuildings(newRobberLocation):
        currentPlayer.selectPlayerToStealFrom()
        stealRandomResource(selectedPlayer, currentPlayer)
```

## TRADING SYSTEM

### Trade Validation

```
function validateTrade(offering, requesting, player):
    // Check player has offered resources
    for resource, amount in offering:
        if player.resources[resource] < amount:
            return false

    // Check bank has requested resources (if bank trade)
    if isBankTrade:
        return validateBankTradeRatio(offering, requesting, player)

    return true

function validateBankTradeRatio(offering, requesting, player):
    ports = player.getAccessiblePorts()

    // Check for specific resource ports
    for resource in offering.keys():
        if hasResourcePort(ports, resource):
            ratio = 2  // 2:1 specific port
        else if hasGenericPort(ports):
            ratio = 3  // 3:1 generic port
        else:
            ratio = 4  // 4:1 default

        if sum(offering.values()) < ratio * sum(requesting.values()):
            return false

    return true
```

## 5-6 PLAYER BOARD LAYOUT

### Extended Board (30 hexes total)

```
      [  ] [  ] [  ] [  ]
    [  ] [  ] [  ] [  ] [  ]
  [  ] [  ] [  ] [  ] [  ] [  ]
[  ] [  ] [  ] [  ] [  ] [  ] [  ]
  [  ] [  ] [  ] [  ] [  ] [  ]
    [  ] [  ] [  ] [  ] [  ]
      [  ] [  ] [  ] [  ]
```

### 5-6 Player Number Discs (28 total)

Additional discs:

- 2: +1 disc
- 3: +1 disc  
- 4: +1 disc
- 5: +1 disc
- 6: +1 disc
- 8: +1 disc
- 9: +1 disc
- 10: +1 disc
- 11: +1 disc
- 12: +1 disc

### Paired Player Turn Logic

```
function executePairedTurn(player1, player2):
    // Player 1 full turn
    executeProductionPhase(player1)
    executeActionPhase(player1)

    if checkWinCondition(player1):
        return player1

    // Player 2 action phase only (no trading with other players)
    executeActionPhaseRestricted(player2)  // no inter-player trading

    if checkWinCondition(player2):
        return player2

    return null  // continue game
```

## DEVELOPMENT CARD DETAILS

### Development Card Deck Composition

**Standard (25 cards):**

- Knight: 14 cards
- Victory Point: 5 cards
- Road Building: 2 cards
- Invention: 2 cards  
- Monopoly: 2 cards

**5-6 Player Addition (9 cards):**

- Knight: +6 cards
- Road Building: +1 card
- Invention: +1 card
- Monopoly: +1 card

### Victory Point Card Types

The 5 Victory Point development cards represent:

- Chapel
- Great Hall  
- Library
- Market
- University

(Each worth 1 VP, revealed when played)

## WINNING CONDITIONS

### Victory Point Calculation

```
function calculateVictoryPoints(player):
    points = 0

    // Buildings
    points += player.settlements.length * 1
    points += player.cities.length * 2

    // Special cards
    if player.hasLongestRoad:
        points += 2
    if player.hasLargestArmy:
        points += 2

    // Revealed VP cards
    points += player.revealedVictoryPointCards

    return points

function checkWinCondition(player):
    return calculateVictoryPoints(player) >= 10
```

### Largest Army Rules

- Requires minimum 3 knights played
- Transfers immediately when another player plays more knights
- Tied at same number: current holder keeps it
- Lost when another player plays one more knight

### Longest Road Rules

- Requires minimum 5 connected roads
- Transfers immediately when another player builds longer road
- Tied at same length: current holder keeps it
- Broken roads (by opponent's building) recalculate immediately

This technical supplement provides the missing implementation details needed to code a complete Catan game engine.