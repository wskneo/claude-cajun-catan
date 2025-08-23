import { WebSocket, WebSocketServer } from 'ws';
import { IncomingMessage } from 'http';
import { parse } from 'url';
import { WebSocketMessage, PlayerConnection } from '../types';

export class WebSocketManager {
  private wss?: WebSocketServer;
  private connections: Map<string, WebSocket> = new Map();

  initialize(port: number): void {
    this.wss = new WebSocketServer({ port });

    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      console.log('New WebSocket connection established');
      
      ws.on('message', (data: Buffer) => {
        try {
          const message: WebSocketMessage = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Invalid message format:', error);
          this.sendError(ws, 'Invalid message format');
        }
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
        this.removeConnection(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeConnection(ws);
      });

      // Send initial connection acknowledgment
      this.send(ws, { type: 'PONG' });
    });

    console.log(`WebSocket server started on port ${port}`);
  }

  private handleMessage(ws: WebSocket, message: WebSocketMessage): void {
    console.log('Received message:', message.type);

    switch (message.type) {
      case 'PING':
        this.send(ws, { type: 'PONG' });
        break;
      
      default:
        // Forward to game engine event handler
        this.emit('message', ws, message);
        break;
    }
  }

  registerConnection(playerId: string, ws: WebSocket): void {
    this.connections.set(playerId, ws);
    console.log(`Registered connection for player: ${playerId}`);
  }

  removeConnection(ws: WebSocket): void {
    for (const [playerId, socket] of this.connections) {
      if (socket === ws) {
        this.connections.delete(playerId);
        console.log(`Removed connection for player: ${playerId}`);
        this.emit('disconnect', undefined, playerId);
        break;
      }
    }
  }

  send(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  sendToPlayer(playerId: string, message: WebSocketMessage): void {
    const ws = this.connections.get(playerId);
    if (ws) {
      this.send(ws, message);
    }
  }

  sendToPlayers(playerIds: string[], message: WebSocketMessage): void {
    for (const playerId of playerIds) {
      this.sendToPlayer(playerId, message);
    }
  }

  broadcastToGame(gameId: string, playerIds: string[], message: WebSocketMessage): void {
    for (const playerId of playerIds) {
      const gameMessage = { ...message, gameId };
      this.sendToPlayer(playerId, gameMessage);
    }
  }

  sendError(ws: WebSocket, error: string, gameId?: string): void {
    this.send(ws, {
      type: 'ERROR',
      gameId,
      payload: { error }
    });
  }

  sendErrorToPlayer(playerId: string, error: string, gameId?: string): void {
    const ws = this.connections.get(playerId);
    if (ws) {
      this.sendError(ws, error, gameId);
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  isPlayerConnected(playerId: string): boolean {
    const ws = this.connections.get(playerId);
    return ws ? ws.readyState === WebSocket.OPEN : false;
  }

  close(): void {
    if (this.wss) {
      this.wss.close();
      console.log('WebSocket server closed');
    }
    this.connections.clear();
  }

  // Simple event emitter pattern
  private eventHandlers: Map<string, ((ws?: WebSocket, ...args: any[]) => void)[]> = new Map();

  on(event: string, handler: (ws?: WebSocket, ...args: any[]) => void): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  private emit(event: string, ws?: WebSocket, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(ws, ...args);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      }
    }
  }
}