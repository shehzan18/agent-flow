export interface GraphNode {
  id: string;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  cycle?: string[];
}

enum VisitState {
  WHITE = "WHITE", // not visited
  GRAY = "GRAY",   // currently visiting
  BLACK = "BLACK", // fully visited
}

export function validateGraph(
  nodes: GraphNode[],
  edges: GraphEdge[]
): ValidationResult {
  // Empty graph is valid
  if (nodes.length === 0) {
    return { isValid: true };
  }

  // Build adjacency list
  // { nodeId: [neighborId1, neighborId2, ...] }
  const adjacencyList = new Map<string, string[]>();

  for (const node of nodes) {
    adjacencyList.set(node.id, []);
  }

  for (const edge of edges) {
    // Check edge references valid nodes
    if (!adjacencyList.has(edge.source)) {
      return {
        isValid: false,
        error: `Edge references unknown source node: ${edge.source}`,
      };
    }
    if (!adjacencyList.has(edge.target)) {
      return {
        isValid: false,
        error: `Edge references unknown target node: ${edge.target}`,
      };
    }

    adjacencyList.get(edge.source)!.push(edge.target);
  }

  // DFS cycle detection
  const visitState = new Map<string, VisitState>();
  const parent = new Map<string, string | null>();

  for (const node of nodes) {
    visitState.set(node.id, VisitState.WHITE);
    parent.set(node.id, null);
  }

  // Reconstruct cycle path from parent map
  function reconstructCycle(start: string, end: string): string[] {
    const cycle: string[] = [end];
    let current = start;

    while (current !== end) {
      cycle.unshift(current);
      current = parent.get(current)!;
    }

    cycle.unshift(end);
    return cycle;
  }

  // DFS function — returns cycle if found
  function dfs(nodeId: string): string[] | null {
    visitState.set(nodeId, VisitState.GRAY);

    const neighbors = adjacencyList.get(nodeId) || [];

    for (const neighbor of neighbors) {
      if (visitState.get(neighbor) === VisitState.GRAY) {
        // Found cycle — reconstruct it
        parent.set(neighbor, nodeId);
        return reconstructCycle(nodeId, neighbor);
      }

      if (visitState.get(neighbor) === VisitState.WHITE) {
        parent.set(neighbor, nodeId);
        const cycle = dfs(neighbor);
        if (cycle) return cycle;
      }
    }

    visitState.set(nodeId, VisitState.BLACK);
    return null;
  }

  // Run DFS from every unvisited node
  for (const node of nodes) {
    if (visitState.get(node.id) === VisitState.WHITE) {
      const cycle = dfs(node.id);
      if (cycle) {
        return {
          isValid: false,
          error: `Cycle detected in workflow: ${cycle.join(" → ")}`,
          cycle,
        };
      }
    }
  }

  return { isValid: true };
}


// This makes it fast to look up which nodes a given node connects to.
// Three visit states:

// WHITE → haven't visited this node yet
// GRAY → currently on our DFS path, visiting this node's subtree
// BLACK → done with this node completely

// Why GRAY detects cycles: When we're doing DFS and we reach a node that's already GRAY, it means we started 

// at that node, followed some path, and came back to it. That's a cycle by definition.
// Parent map — we track which node we came from to reach each node. When we find a cycle we use this to
//  reconstruct the exact path of nodes that form the cycle. So instead of just saying "cycle exists" we say 
//  "cycle: A → B → C → A" which is much more useful.
// Running DFS from every node — a workflow graph might not be fully connected. Some nodes might be isolated
//  or in separate components. So we run DFS from every WHITE node to make sure we check the entire graph.