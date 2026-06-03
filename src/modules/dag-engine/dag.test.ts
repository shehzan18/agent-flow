import { validateGraph } from "./graph-validator";
import { topologicalSort } from "./topological-sort";
import { getReadyNodes, NodeExecutionState } from "./dependency-resolver";
import { DAGService } from "./dag.service";

const dagService = new DAGService();

// ─── Test 1: Valid linear graph ───────────────────────────────
console.log("\n=== Test 1: Linear graph ===");
const linearNodes = [
  { id: "A" },
  { id: "B" },
  { id: "C" },
];
const linearEdges = [
  { source: "A", target: "B" },
  { source: "B", target: "C" },
];
const linearPlan = dagService.createExecutionPlan({
  nodes: linearNodes,
  edges: linearEdges,
});
console.log("Valid:", linearPlan.isValid);
console.log("Order:", linearPlan.topologicalOrder);
console.log("Levels:", JSON.stringify(linearPlan.executionLevels, null, 2));

// ─── Test 2: Parallel graph ───────────────────────────────────
console.log("\n=== Test 2: Parallel graph ===");
const parallelNodes = [
  { id: "Input" },
  { id: "Research" },
  { id: "Analyst" },
  { id: "Writer" },
];
const parallelEdges = [
  { source: "Input", target: "Research" },
  { source: "Input", target: "Analyst" },
  { source: "Research", target: "Writer" },
  { source: "Analyst", target: "Writer" },
];
const parallelPlan = dagService.createExecutionPlan({
  nodes: parallelNodes,
  edges: parallelEdges,
});
console.log("Valid:", parallelPlan.isValid);
console.log("Order:", parallelPlan.topologicalOrder);
console.log("Levels:", JSON.stringify(parallelPlan.executionLevels, null, 2));

// ─── Test 3: Cycle detection ──────────────────────────────────
console.log("\n=== Test 3: Cycle detection ===");
const cycleNodes = [
  { id: "A" },
  { id: "B" },
  { id: "C" },
];
const cycleEdges = [
  { source: "A", target: "B" },
  { source: "B", target: "C" },
  { source: "C", target: "A" },
];
const cyclePlan = dagService.createExecutionPlan({
  nodes: cycleNodes,
  edges: cycleEdges,
});
console.log("Valid:", cyclePlan.isValid);
console.log("Error:", cyclePlan.error);
console.log("Cycle:", cyclePlan.cycle);

// ─── Test 4: Dependency resolver ─────────────────────────────
console.log("\n=== Test 4: Dependency resolver ===");
const nodeStates = [
  { nodeId: "Input",    state: NodeExecutionState.COMPLETED },
  { nodeId: "Research", state: NodeExecutionState.PENDING },
  { nodeId: "Analyst",  state: NodeExecutionState.PENDING },
  { nodeId: "Writer",   state: NodeExecutionState.PENDING },
];
const readyNodes = dagService.getNextReadyNodes(parallelEdges, nodeStates);
console.log("Ready nodes:", readyNodes.map(n => n.nodeId));
// Expected: ["Research", "Analyst"] — both ready since Input completed

// ─── Test 5: New edge cycle validation ───────────────────────
console.log("\n=== Test 5: New edge would create cycle ===");
const result = dagService.validateNewEdge(
  linearNodes,
  linearEdges,
  { source: "C", target: "A" }
);
console.log("Valid:", result.isValid);
console.log("Error:", result.error);