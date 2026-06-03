import { GraphEdge } from "./graph-validator";

export enum NodeExecutionState {
  PENDING = "PENDING",     // not started yet
  READY = "READY",         // all dependencies done, can run now
  RUNNING = "RUNNING",     // currently executing
  COMPLETED = "COMPLETED", // finished successfully
  FAILED = "FAILED",       // failed
  SKIPPED = "SKIPPED",     // skipped due to condition
}

export interface NodeState {
  nodeId: string;
  state: NodeExecutionState;
}

export interface ReadyNode {
  nodeId: string;
  canRunAt: number; // timestamp
}

export function getReadyNodes(
  edges: GraphEdge[],
  nodeStates: NodeState[]
): ReadyNode[] {
  // Build state lookup map for O(1) access
  const stateMap = new Map<string, NodeExecutionState>();
  for (const ns of nodeStates) {
    stateMap.set(ns.nodeId, ns.state);
  }

  // Build reverse adjacency list
  // { nodeId: [parentId1, parentId2, ...] }
  const parents = new Map<string, string[]>();
  for (const ns of nodeStates) {
    parents.set(ns.nodeId, []);
  }
  for (const edge of edges) {
    parents.get(edge.target)?.push(edge.source);
  }

  const readyNodes: ReadyNode[] = [];

  for (const ns of nodeStates) {
    // Only consider PENDING nodes
    if (ns.state !== NodeExecutionState.PENDING) {
      continue;
    }

    // Get all parents of this node
    const nodeParents = parents.get(ns.nodeId) || [];

    // Node is ready if ALL parents are COMPLETED
    const allParentsDone = nodeParents.every(
      (parentId) => stateMap.get(parentId) === NodeExecutionState.COMPLETED
    );

    if (allParentsDone) {
      readyNodes.push({
        nodeId: ns.nodeId,
        canRunAt: Date.now(),
      });
    }
  }

  return readyNodes;
}

export function isWorkflowComplete(nodeStates: NodeState[]): boolean {
  return nodeStates.every(
    (ns) =>
      ns.state === NodeExecutionState.COMPLETED ||
      ns.state === NodeExecutionState.SKIPPED
  );
}

export function isWorkflowFailed(nodeStates: NodeState[]): boolean {
  return nodeStates.some((ns) => ns.state === NodeExecutionState.FAILED);
}

export function getFailedNodes(nodeStates: NodeState[]): string[] {
  return nodeStates
    .filter((ns) => ns.state === NodeExecutionState.FAILED)
    .map((ns) => ns.nodeId);
}



// Explanation:
// Why do we need this if we already have topological sort?
// Topological sort gives you a static plan — "run nodes in this order".
//  But during execution things change dynamically:

// A node might fail and need retry
// A node might be slower than expected
// Multiple nodes complete at different times

// The dependency resolver is called every time a node completes. It looks at the current state of all nodes 
// and tells you exactly which ones are ready right now. It's a pure function — same input always gives same
//  output, no side effects.
// Reverse adjacency list — instead of "who does this node point to" we build "who points to this node":
// Forward:  A → B, A → C, B → D, C → D
// Reverse:  B's parents = [A]
//           C's parents = [A]
//           D's parents = [B, C]
// We need this because to check if a node is ready, we need to know all its parents and verify they're all 
// completed.
// The core logic in plain English:
// For each PENDING node:
//   Get all its parent nodes
//   If ALL parents are COMPLETED → this node is READY
//   If ANY parent is not COMPLETED → this node must wait
// every() method — returns true only if the callback returns true for every element. Perfect for "all parents 
// must be completed".
// Three utility functions at the bottom:

// isWorkflowComplete → all nodes completed or skipped → workflow is done
// isWorkflowFailed → any node failed → workflow failed
// getFailedNodes → returns list of which nodes failed → useful for error reporting

// The critical design decision — this is a pure stateless function. It takes graph edges and current node
//  states as input, returns ready nodes as output. It doesn't store anything, doesn't call the database,
//   doesn't know about BullMQ.
// This means the Execution Manager can call it at any point during execution and always get a correct 
// answer based on current state.

