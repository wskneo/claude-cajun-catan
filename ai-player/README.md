# Catan AI Player Service

A microservice that provides AI decision-making for Settlers of Catan using Docker Ollama with Gemma2 270M model, with fallback to heuristic algorithms.

## Architecture

- **Primary AI**: Gemma2 270M running on Ollama for strategic decision-making
- **Fallback AI**: Rule-based heuristic algorithms for reliability
- **API**: RESTful endpoints for game engine integration
- **Docker**: Containerized deployment with Ollama integration

## Features

### AI Decision Making

- 🧠 **LLM-powered decisions** using Gemma2 270M for strategic gameplay
- 🔧 **Heuristic fallback** ensures 100% uptime even when LLM unavailable  
- ⚡ **Fast response times** with configurable timeouts
- 🎯 **Context-aware prompts** tailored to game phases and situations

### Game Integration

- 📡 **RESTful API** for easy integration with game engines
- 🔄 **Action validation** ensures legal moves
- 📊 **Game state analysis** for strategic decision-making
- 🎲 **All game phases** supported (setup, production, action)

### Reliability & Monitoring

- 🐳 **Docker deployment** with health checks
- 📊 **Metrics endpoints** for monitoring
- 🔍 **Comprehensive logging** for debugging
- ⚙️ **Configurable timeouts** and fallback strategies

## Quick Start

### Prerequisites

- Docker and Docker Compose
- 4GB+ RAM (for Gemma2 270M model)
- Linux/macOS (Windows with WSL2)

### 1. Start the Services

```bash
# Clone and navigate to directory
cd ai-player

# Start Ollama and AI Player service
npm run docker:up

# Wait for services to start (may take a few minutes to download model)
docker compose -f docker/docker-compose.yml logs -f
```

### 2. Setup Ollama Model

```bash
# Pull and setup the Gemma2 270M model
npm run setup-ollama
```

### 3. Test the Service

```bash
# Health check
curl http://localhost:3001/ai/health

# Test AI decision making
curl -X POST http://localhost:3001/ai/test
```

## API Endpoints

### POST /ai/decision

Make an AI decision for a game state.

```typescript
// Request
{
  "gameState": {
    "id": "game_123",
    "phase": "ACTION",
    "currentPlayerIndex": 0,
    "players": [
      {
        "id": "ai_player",
        "resources": { "wood": 2, "brick": 1, "wool": 1, "wheat": 1, "ore": 0 },
        "developmentCards": { "knight": 0, "roadBuilding": 0, "invention": 0, "monopoly": 0, "victoryPoint": 0 },
        "buildings": { "roads": [], "settlements": [], "cities": [] },
        "specialCards": { "longestRoad": false, "largestArmy": false },
        "knightsPlayed": 0,
        "victoryPoints": 0,
        "canPlayDevCard": true
      }
    ],
    "board": { /* board state */ },
    "developmentCardDeck": [],
    "turn": 1
  },
  "playerId": "ai_player",
  "validActions": ["BUILD_ROAD", "BUILD_SETTLEMENT", "END_TURN"],
  "timeoutMs": 5000
}

// Response
{
  "success": true,
  "decision": {
    "action": {
      "type": "BUILD_SETTLEMENT",
      "playerId": "ai_player",
      "payload": { "intersectionId": "i_1,0" }
    },
    "reasoning": "Building settlement for resource access and victory points",
    "confidence": 0.8,
    "processingTimeMs": 1250
  }
}
```

### GET /ai/health

Service health check.

```json
{
  "healthy": true,
  "llmAvailable": true,
  "timestamp": "2024-01-01T12:00:00Z",
  "service": "ai-player",
  "version": "1.0.0"
}
```

### GET /ai/status

Detailed service status.

### POST /ai/test

Test AI decision making with sample data.

### GET /ai/metrics

Basic service metrics.

## Configuration

Environment variables:

```bash
# Ollama Configuration
OLLAMA_HOST=localhost
OLLAMA_PORT=11434
OLLAMA_MODEL=gemma2:270m

# AI Configuration
AI_TIMEOUT=10000
AI_TEMPERATURE=0.7
FALLBACK_TO_HEURISTIC=true
ENABLE_REASONING_LOG=true

# Server Configuration
PORT=3001
NODE_ENV=production
LOG_LEVEL=info
```

## Game Integration

### With Rule Engine

```typescript
import { CatanRuleEngine } from '@cajun-catan/rule-engine';
import axios from 'axios';

// Create game state
const gameState = CatanRuleEngine.createNewGame(['human', 'ai_player']);

// Get AI decision
const response = await axios.post('http://localhost:3001/ai/decision', {
  gameState,
  playerId: 'ai_player',
  validActions: CatanRuleEngine.getValidActions(gameState, 'ai_player')
});

// Apply AI action
const result = CatanRuleEngine.processAction(gameState, response.data.decision.action);
```

### Custom Integration

The service accepts any game state following the standard Catan data structure and returns valid actions that can be processed by your game engine.

## AI Strategy

### LLM Decision Process

1. **Game Analysis**: Parse current game state and player position
2. **Context Generation**: Create tailored prompts based on game phase
3. **Strategic Reasoning**: Generate decisions considering:
   - Victory point progress
   - Resource efficiency
   - Opponent blocking
   - Long-term strategy
4. **Action Validation**: Ensure generated actions are legal
5. **Fallback Handling**: Switch to heuristics if LLM fails

### Heuristic Fallback

- **Setup Strategy**: Prioritize resource diversity and number probabilities
- **Building Priority**: Cities > Settlements > Roads for VP efficiency  
- **Resource Management**: Trade excess resources for needed ones
- **Endgame Focus**: Prioritize immediate VP when close to winning
- **Opponent Awareness**: Block threatening players with robber

## Development

### Local Development

```bash
# Install dependencies
npm install

# Start in development mode
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Type checking
npm run type-check

# Linting
npm run lint
```

### Testing

```bash
# Unit tests
npm test

# Integration tests with Docker
npm run docker:up
npm run test:integration

# Load testing
npm run test:load
```

### Docker Commands

```bash
# Start services
npm run docker:up

# View logs
npm run docker:logs

# Stop services  
npm run docker:down

# Setup Ollama model
npm run setup-ollama
```

## Performance

### Response Times

- **LLM Decisions**: 1-3 seconds (depends on complexity)
- **Heuristic Decisions**: <100ms
- **Health Checks**: <50ms

### Resource Usage

- **Memory**: ~2GB (Gemma2 270M) + ~200MB (Node.js service)
- **CPU**: Moderate during inference, low at idle
- **Disk**: ~1.5GB for model storage

### Scalability

- **Stateless**: Each request is independent
- **Horizontal Scaling**: Multiple instances can run in parallel
- **Load Balancing**: Standard HTTP load balancers supported

## Troubleshooting

### Common Issues

**Ollama Connection Failed**

```bash
# Check Ollama status
docker exec catan-ollama ollama list

# Restart Ollama
docker restart catan-ollama
```

**Model Not Found**

```bash
# Pull model manually
docker exec catan-ollama ollama pull gemma2:270m
```

**Service Timeouts**

- Increase `AI_TIMEOUT` environment variable
- Check system resources (RAM/CPU)
- Enable fallback mode: `FALLBACK_TO_HEURISTIC=true`

**Memory Issues**

- Use smaller model: `OLLAMA_MODEL=gemma2:270m`
- Increase Docker memory limits
- Monitor with `GET /ai/metrics`

### Debugging

```bash
# Check service logs
docker-compose -f docker/docker-compose.yml logs ai-player

# Check Ollama logs  
docker-compose -f docker/docker-compose.yml logs ollama

# Test specific endpoints
curl -v http://localhost:3001/ai/health
curl -X POST http://localhost:3001/ai/test
```

## Security

- **Input Validation**: All requests validated with Joi schemas
- **Resource Limits**: Configurable timeouts prevent resource exhaustion
- **CORS Protection**: Configurable allowed origins
- **Helmet.js**: Security headers for production
- **No Secrets**: Service is stateless with no secret storage

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality  
4. Ensure all tests pass
5. Submit a pull request

## Roadmap

- [ ] Support for 5-6 player games
- [ ] Advanced trading negotiations
- [ ] Multiple AI personality modes
- [ ] Performance optimizations
- [ ] WebSocket support for real-time games
- [ ] Tournament mode with learning capabilities