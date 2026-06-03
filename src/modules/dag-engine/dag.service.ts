import { validateGraph, GraphNode, GraphEdge } from "./graph-validator";
import { topologicalSort, TopologicalSortResult } from "./topological-sort";
import {
  getReadyNodes,
  isWorkflowComplete,
  isWorkflowFailed,
  getFailedNodes,
  NodeState,
  ReadyNode,
} from "./dependency-resolver";
import { logger } from "../../config/logger";

export interface WorkflowGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface ExecutionPlan {
  isValid: boolean;
  error?: string;
  cycle?: string[];
  topologicalOrder: string[];
  executionLevels: {
    level: number;
    nodeIds: string[];
  }[];
  totalNodes: number;
  parallelGroups: number;
}

export class DAGService {
  // Validate graph and produce execution plan
  createExecutionPlan(graph: WorkflowGraph): ExecutionPlan {
    logger.debug("Creating execution plan", {
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    });

    // Step 1 — Validate graph
    const validation = validateGraph(graph.nodes, graph.edges);

    if (!validation.isValid) {
      logger.warn("Invalid workflow graph", { error: validation.error });
      return {
        isValid: false,
        error: validation.error,
        cycle: validation.cycle,
        topologicalOrder: [],
        executionLevels: [],
        totalNodes: graph.nodes.length,
        parallelGroups: 0,
      };
    }

    // Step 2 — Topological sort
    const sortResult: TopologicalSortResult = topologicalSort(
      graph.nodes,
      graph.edges
    );

    logger.debug("Execution plan created", {
      totalNodes: graph.nodes.length,
      parallelGroups: sortResult.levels.length,
      executionOrder: sortResult.order,
    });

    return {
      isValid: true,
      topologicalOrder: sortResult.order,
      executionLevels: sortResult.levels,
      totalNodes: graph.nodes.length,
      parallelGroups: sortResult.levels.length,
    };
  }

  // Called every time a node completes during execution
  getNextReadyNodes(edges: GraphEdge[], nodeStates: NodeState[]): ReadyNode[] {
    const readyNodes = getReadyNodes(edges, nodeStates);

    logger.debug("Ready nodes calculated", {
      readyCount: readyNodes.length,
      readyNodeIds: readyNodes.map((n) => n.nodeId),
    });

    return readyNodes;
  }

  // Check if entire workflow is done
  checkWorkflowComplete(nodeStates: NodeState[]): boolean {
    return isWorkflowComplete(nodeStates);
  }

  // Check if workflow has any failures
  checkWorkflowFailed(nodeStates: NodeState[]): boolean {
    return isWorkflowFailed(nodeStates);
  }

  // Get list of failed node IDs
  getFailedNodes(nodeStates: NodeState[]): string[] {
    return getFailedNodes(nodeStates);
  }

  // Validate a single edge before adding to workflow
  validateNewEdge(
    nodes: GraphNode[],
    edges: GraphEdge[],
    newEdge: GraphEdge
  ): { isValid: boolean; error?: string } {
    // Check self loop
    if (newEdge.source === newEdge.target) {
      return {
        isValid: false,
        error: "A node cannot connect to itself",
      };
    }

    // Check if adding this edge would create a cycle
    const testEdges = [...edges, newEdge];
    const validation = validateGraph(nodes, testEdges);

    if (!validation.isValid) {
      return {
        isValid: false,
        error: validation.error,
      };
    }

    return { isValid: true };
  }
}




// Explanation:
// createExecutionPlan — this is called once when a user triggers a workflow execution. It:

// Validates the graph has no cycles
// Runs topological sort to get execution order and parallel groups
// Returns a complete plan the execution manager can use

// The plan tells the execution manager:
// totalNodes: 3
// parallelGroups: 3
// executionLevels: [
//   { level: 0, nodeIds: ["input"] },        ← run first
//   { level: 1, nodeIds: ["researcher"] },   ← run second
//   { level: 2, nodeIds: ["output"] }        ← run last
// ]
// For a parallel workflow it would look like:
// executionLevels: [
//   { level: 0, nodeIds: ["input"] },
//   { level: 1, nodeIds: ["researcher", "analyst"] },  ← run together
//   { level: 2, nodeIds: ["writer"] }
// ]
// getNextReadyNodes — called by execution manager every time a node completes. 
// Returns which nodes are ready to run next based on current states. This is the dynamic part of execution.
// validateNewEdge — this is a bonus method. Before adding an edge to a workflow, we can check if it would
//  create a cycle. We do this by temporarily adding the edge to the existing edges list and running full
//   validation. If it creates a cycle we reject it before saving to database.
// Why wrap everything in a service class instead of just exporting the functions directly?
// Three reasons:

// Single import point — execution manager imports DAGService, not three separate files
// Easy to mock in tests — you can replace the entire DAGService with a fake one
// Logging in one place — all DAG operations are logged consistentl