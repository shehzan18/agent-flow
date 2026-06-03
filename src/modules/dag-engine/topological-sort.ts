import { GraphNode, GraphEdge } from "./graph-validator";

export interface ExecutionLevel {
  level: number;
  nodeIds: string[];
}

export interface TopologicalSortResult {
  order: string[];          // flat execution order
  levels: ExecutionLevel[]; // grouped by parallel execution level
}

export function topologicalSort(
  nodes: GraphNode[],
  edges: GraphEdge[]
): TopologicalSortResult {
  // Step 1 — Build adjacency list and in-degree map
  const adjacencyList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  // Initialize every node with in-degree 0
  for (const node of nodes) {
    adjacencyList.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  // Fill adjacency list and count in-degrees
  for (const edge of edges) {
    adjacencyList.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  // Step 2 — Find all nodes with in-degree 0 (no dependencies)
  const queue: string[] = [];

  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  // Step 3 — Kahn's algorithm
  const order: string[] = [];
  const levels: ExecutionLevel[] = [];
  let levelNumber = 0;

  while (queue.length > 0) {
    // All nodes currently in queue can run in parallel
    const currentLevel: string[] = [...queue];
    queue.length = 0; // clear queue

    levels.push({
      level: levelNumber,
      nodeIds: currentLevel,
    });

    for (const nodeId of currentLevel) {
      order.push(nodeId);

      // Reduce in-degree of all neighbors
      const neighbors = adjacencyList.get(nodeId) || [];

      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);

        // If in-degree reaches 0, neighbor is ready
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      }
    }

    levelNumber++;
  }

  return { order, levels };
}

// Explanation:
// In-degree — number of edges pointing INTO a node. Think of it as "how many dependencies does this 
// node have?"
// Input → Research → Writer → Output

// In-degrees:
// Input    = 0  ← no one points to it, ready immediately
// Research = 1  ← Input points to it
// Writer   = 1  ← Research points to it  
// Output   = 1  ← Writer points to it
// For a parallel graph:
//         Input
//        /     \
//   Research  Analyst
//        \     /
//         Writer

// In-degrees:
// Input    = 0
// Research = 1  (Input)
// Analyst  = 1  (Input)
// Writer   = 2  (Research + Analyst)
// How Kahn's works step by step:
// Start: queue = [Input]  (only node with in-degree 0)

// Level 0: process [Input]
//   → reduce Research in-degree: 1→0, add to queue
//   → reduce Analyst in-degree:  1→0, add to queue
//   order = [Input]

// Level 1: process [Research, Analyst]  ← parallel!
//   → reduce Writer in-degree: 2→1 (Research done)
//   → reduce Writer in-degree: 1→0 (Analyst done), add to queue
//   order = [Input, Research, Analyst]

// Level 2: process [Writer]
//   → reduce Output in-degree: 1→0, add to queue
//   order = [Input, Research, Analyst, Writer]

// Level 3: process [Output]
//   order = [Input, Research, Analyst, Writer, Output]
// The levels array is the key insight — every node in the same level has no dependency on each
//  other and can run simultaneously. This is how the execution manager will know to run them in 
//  parallel using BullMQ.
// queue.length = 0 — fastest way to clear an array in JavaScript without creating a new one 