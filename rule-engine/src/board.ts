import { HexCoordinate, Tile, Intersection, Edge, GameBoard, TerrainType, ResourceType } from './types';

export class BoardGenerator {
  static generateStandardBoard(): GameBoard {
    const tiles = this.createStandardTiles();
    const { intersections, edges } = this.createIntersectionsAndEdges(tiles);
    
    return {
      tiles,
      intersections,
      edges,
      robberLocation: { q: 0, r: 0 } // desert at center
    };
  }

  private static createStandardTiles(): Map<string, Tile> {
    const tiles = new Map<string, Tile>();
    
    // Standard terrain distribution
    const terrainLayout: { coord: HexCoordinate; terrain: TerrainType; number?: number }[] = [
      // Center
      { coord: { q: 0, r: 0 }, terrain: 'desert' },
      
      // Ring 1 (6 hexes)
      { coord: { q: 1, r: 0 }, terrain: 'pasture', number: 9 },
      { coord: { q: 0, r: 1 }, terrain: 'field', number: 12 },
      { coord: { q: -1, r: 1 }, terrain: 'forest', number: 6 },
      { coord: { q: -1, r: 0 }, terrain: 'hill', number: 4 },
      { coord: { q: 0, r: -1 }, terrain: 'mountain', number: 10 },
      { coord: { q: 1, r: -1 }, terrain: 'hill', number: 5 },
      
      // Ring 2 (12 hexes) - using fixed setup from technical supplement
      { coord: { q: 2, r: 0 }, terrain: 'forest', number: 11 },
      { coord: { q: 1, r: 1 }, terrain: 'field', number: 3 },
      { coord: { q: 0, r: 2 }, terrain: 'pasture', number: 8 },
      { coord: { q: -1, r: 2 }, terrain: 'hill', number: 8 },
      { coord: { q: -2, r: 2 }, terrain: 'mountain', number: 3 },
      { coord: { q: -2, r: 1 }, terrain: 'forest', number: 4 },
      { coord: { q: -2, r: 0 }, terrain: 'pasture', number: 2 },
      { coord: { q: -1, r: -1 }, terrain: 'field', number: 6 },
      { coord: { q: 0, r: -2 }, terrain: 'mountain', number: 11 },
      { coord: { q: 1, r: -2 }, terrain: 'forest', number: 9 },
      { coord: { q: 2, r: -2 }, terrain: 'pasture', number: 5 },
      { coord: { q: 2, r: -1 }, terrain: 'field', number: 10 }
    ];

    terrainLayout.forEach(({ coord, terrain, number }) => {
      const key = this.coordToKey(coord);
      tiles.set(key, {
        coordinate: coord,
        terrain,
        numberDisc: number,
        hasRobber: terrain === 'desert'
      });
    });

    return tiles;
  }

  private static createIntersectionsAndEdges(tiles: Map<string, Tile>): {
    intersections: Map<string, Intersection>;
    edges: Map<string, Edge>;
  } {
    const intersections = new Map<string, Intersection>();
    const edges = new Map<string, Edge>();

    // Generate all intersections for each hex
    tiles.forEach((tile) => {
      const hexIntersections = this.getHexIntersections(tile.coordinate);
      
      hexIntersections.forEach((intersectionCoord, index) => {
        const intersectionId = this.intersectionToId(intersectionCoord);
        
        if (!intersections.has(intersectionId)) {
          const adjacentHexes = this.getAdjacentHexes(intersectionCoord, tiles);
          const connectedEdges = this.getIntersectionEdges(intersectionCoord);
          
          intersections.set(intersectionId, {
            id: intersectionId,
            hexes: adjacentHexes,
            edges: connectedEdges,
            port: this.getPortForIntersection(intersectionCoord)
          });
        }
      });
    });

    // Generate all edges
    intersections.forEach((intersection) => {
      intersection.edges.forEach((edgeId) => {
        if (!edges.has(edgeId)) {
          const [intersection1, intersection2] = this.parseEdgeId(edgeId);
          edges.set(edgeId, {
            id: edgeId,
            intersections: [intersection1, intersection2]
          });
        }
      });
    });

    return { intersections, edges };
  }

  private static getHexIntersections(coord: HexCoordinate): HexCoordinate[] {
    // Returns 6 intersection coordinates for a hex, starting from top and going clockwise
    const { q, r } = coord;
    return [
      { q, r: r - 1 }, // top
      { q: q + 1, r: r - 1 }, // top-right
      { q: q + 1, r }, // bottom-right
      { q, r: r + 1 }, // bottom
      { q: q - 1, r: r + 1 }, // bottom-left
      { q: q - 1, r } // top-left
    ];
  }

  private static getAdjacentHexes(intersectionCoord: HexCoordinate, tiles: Map<string, Tile>): HexCoordinate[] {
    // Each intersection touches up to 3 hexes
    const adjacent: HexCoordinate[] = [];
    const { q, r } = intersectionCoord;

    // Check the 3 possible adjacent hexes for this intersection
    const candidates = [
      { q, r },
      { q, r: r + 1 },
      { q: q - 1, r: r + 1 }
    ];

    candidates.forEach(coord => {
      if (tiles.has(this.coordToKey(coord))) {
        adjacent.push(coord);
      }
    });

    return adjacent;
  }

  private static getIntersectionEdges(intersectionCoord: HexCoordinate): string[] {
    // Each intersection connects to 3 edges
    const { q, r } = intersectionCoord;
    const adjacentIntersections = [
      { q: q + 1, r: r - 1 },
      { q: q + 1, r },
      { q, r: r + 1 }
    ];

    return adjacentIntersections.map(adjCoord => 
      this.createEdgeId(intersectionCoord, adjCoord)
    );
  }

  private static getPortForIntersection(coord: HexCoordinate): { type: 'generic' | ResourceType; ratio: number } | undefined {
    // Port locations based on technical supplement
    const portLocations: Array<{
      coord: HexCoordinate;
      type: 'generic' | ResourceType;
      ratio: number;
    }> = [
      // Generic 3:1 ports
      { coord: { q: -2, r: 0 }, type: 'generic', ratio: 3 },
      { coord: { q: 2, r: -1 }, type: 'generic', ratio: 3 },
      { coord: { q: 1, r: 1 }, type: 'generic', ratio: 3 },
      { coord: { q: -1, r: 2 }, type: 'generic', ratio: 3 },
      
      // Specific 2:1 ports
      { coord: { q: 0, r: -2 }, type: 'ore', ratio: 2 },
      { coord: { q: 2, r: 0 }, type: 'wheat', ratio: 2 },
      { coord: { q: 1, r: -2 }, type: 'wood', ratio: 2 },
      { coord: { q: 0, r: 2 }, type: 'brick', ratio: 2 },
      { coord: { q: -2, r: 1 }, type: 'wool', ratio: 2 }
    ];

    const match = portLocations.find(port => 
      port.coord.q === coord.q && port.coord.r === coord.r
    );

    return match ? { type: match.type, ratio: match.ratio } : undefined;
  }

  static coordToKey(coord: HexCoordinate): string {
    return `${coord.q},${coord.r}`;
  }

  private static intersectionToId(coord: HexCoordinate): string {
    return `i_${coord.q},${coord.r}`;
  }

  private static createEdgeId(coord1: HexCoordinate, coord2: HexCoordinate): string {
    // Normalize edge ID to ensure consistent ordering
    const key1 = this.coordToKey(coord1);
    const key2 = this.coordToKey(coord2);
    return key1 < key2 ? `e_${key1}_${key2}` : `e_${key2}_${key1}`;
  }

  private static parseEdgeId(edgeId: string): [string, string] {
    const parts = edgeId.split('_');
    return [this.intersectionToId(this.keyToCoord(parts[1])), 
            this.intersectionToId(this.keyToCoord(parts[2]))];
  }

  private static keyToCoord(key: string): HexCoordinate {
    const [q, r] = key.split(',').map(Number);
    return { q, r };
  }

  // Utility functions for hex coordinate math
  static getDistance(coord1: HexCoordinate, coord2: HexCoordinate): number {
    return (Math.abs(coord1.q - coord2.q) + 
            Math.abs(coord1.q + coord1.r - coord2.q - coord2.r) + 
            Math.abs(coord1.r - coord2.r)) / 2;
  }

  static getNeighbors(coord: HexCoordinate): HexCoordinate[] {
    const { q, r } = coord;
    return [
      { q: q + 1, r: r - 1 }, // northeast
      { q: q + 1, r }, // east
      { q, r: r + 1 }, // southeast
      { q: q - 1, r: r + 1 }, // southwest
      { q: q - 1, r }, // west
      { q, r: r - 1 } // northwest
    ];
  }
}