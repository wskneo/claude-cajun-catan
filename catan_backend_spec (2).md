# Catan Backend Specification

This document describes the architecture and tech stack for building a backend system to host and run **Settlers of Catan** games, including support for human players and AI players powered by a lightweight LLM.

---

## Architecture Overview

```
[Frontend Clients] <---> [Game Engine / API Coordinator]
                                |
              -----------------------------------------
              |                                       |
     [Rule Engine Service]                     [AI Player Service(s)]
```

- **Frontend Clients**: Browser/mobile apps for human players.
- **Game Engine**: The orchestrator that manages sessions, turn order, and routes actions.
- **Rule Engine**: Stateless rules logic that validates and applies moves.
- **AI Player Service(s)**: Lightweight LLM or heuristic engine that selects moves for AI-controlled players.

---

## Components

### 1. Game Rule Engine
- **Purpose**: Enforce Catan’s rules (resource distribution, dice rolls, building placement, robber, development cards, victory conditions).
- **Design**:
  - Stateless: `(GameState + Action) -> New GameState or Error`
  - Input: Current game state, attempted action.
  - Output: Updated game state or invalid move.
- **Responsibilities**:
  - Define data model (tiles, players, resources, settlements, roads, development cards).
  - Validate moves (legal placement, resource availability).
  - Update state transitions (apply move effects).
  - Scoring and win condition checks.

### 2. AI Player Service
- **Purpose**: Provide decision-making for AI-controlled players.
- **Design**:
  - Microservice (can run one per AI player).
  - Input: Current game state + legal actions.
  - Output: Chosen action.
- **Approaches**:
  - Lightweight LLM (e.g., LLaMA.cpp, Mistral-7B-Instruct).
  - Heuristic AI (rule-based, faster, cheaper).
  - Hybrid: heuristics for common play, LLM for negotiation/trading.

### 3. Game Engine (Coordinator)
- **Purpose**: Orchestrates gameplay.
- **Responsibilities**:
  - Manage multiple concurrent game sessions.
  - Track turn order and player states.
  - Route actions to the Rule Engine.
  - Call AI Player Service when an AI turn is required.
  - Expose API/WebSocket endpoints for frontends.
- **Persistence**:
  - In-memory for fast playtesting.
  - Redis/Postgres for persistence across sessions.

---

## Recommended Tech Stack

### Core Backend
- **Language**: Node.js (TypeScript) or Python (FastAPI).
- **Transport**: WebSocket for real-time gameplay; REST endpoints for setup/lobby actions.
- **Session Management**: Redis (for scalability) or in-memory (for MVP).

### Rule Engine
- **Language**: Same as backend (TypeScript or Python).
- **Design**: Pure functions, isolated logic for easy testing.
- **Testing**: Jest (TS) or PyTest (Python).

### AI Player Service
- **Containerized microservice** running:
  - Heuristic bot (Python or Node.js).
  - Optional LLM (via LLaMA.cpp / Mistral-7B / local inference).
  - Input/output via gRPC or HTTP.

### Database (Optional)
- **Postgres**: Store user accounts, match history, game replays.
- **Redis**: Fast in-game state management.

### Frontend Integration
- **Web**: React + WebSocket client.
- **Mobile**: React Native (shares logic).

---

## Suggested Folder Structure
```
/backend
  ├── game-engine/          # Coordinator & API server
  ├── rule-engine/          # Pure rules logic (stateless)
  ├── ai-player/            # AI microservice
  ├── tests/                # Unit & integration tests
  ├── docs/                 # Documentation (this file)
  └── scripts/              # Dev/ops scripts
```

---

## Backlog of Tasks

### Phase 1: MVP (Core Gameplay)
1. **Set up project repo & environment** (Node.js/TypeScript or Python).
2. **Define data structures**: `GameState`, `Player`, `Tile`, `Action`.
3. **Implement Rule Engine basics**:
   - Dice roll & resource distribution.
   - Road/settlement/city placement.
   - Turn progression.
4. **Write unit tests** for rule engine functions.
5. **Implement Game Engine**:
   - Create new game session.
   - Join game (human/AI).
   - Manage turns.
   - Apply player actions via Rule Engine.
6. **Set up WebSocket API** for client interaction.
7. **Basic frontend client (CLI or minimal web UI)** for testing.

### Phase 2: AI Integration & Persistence
8. **Build AI Player Service (heuristic version)**.
9. **Integrate AI Player with Game Engine** (AI takes actions when turn starts).
10. **Add Redis/Postgres persistence** for game sessions & replays.
11. **Support saving/loading games**.

### Phase 3: Advanced Features
12. **Expand Rule Engine**:
    - Development cards (Knight, Monopoly, Year of Plenty, Road Building).
    - Robber logic.
    - Longest road / Largest army.
13. **Implement trading system**:
    - Player-to-player.
    - Port/4:1 trades.
14. **Add LLM AI Player option**:
    - Connect lightweight LLM.
    - Experiment with negotiation and trading strategies.
15. **Frontend polish**:
    - React web client.
    - Show board, player resources, actions.
16. **Replay/analytics support**.

### Phase 4: Production Readiness
17. **Matchmaking/lobby system**.
18. **Authentication & user accounts**.
19. **Game hosting at scale** (Docker, Kubernetes).
20. **Monitoring/logging**.

---

## Roadmap
- **Phase 1**: MVP with rules + coordinator + simple AI.
- **Phase 2**: Add AI Player + persistence.
- **Phase 3**: Advanced rules + trading + LLM integration.
- **Phase 4**: Production features + scalability.

