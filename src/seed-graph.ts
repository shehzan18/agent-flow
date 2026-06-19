import { WorkflowService } from "./modules/workflows/workflow.service";

const workflowService = new WorkflowService();
const TEST_USER = "b6753b80-cb8f-4a15-9b35-88606b4746fd";

async function seed() {
  console.log("\n=== SEEDING CONTENT PIPELINE GRAPH ===\n");

  const workflow = await workflowService.createWorkflow(TEST_USER, {
    name: "Content Brief Pipeline",
    description: "Planner → (Researcher + Writer in parallel) → Critic → Output",
  });
  const wf = workflow.id;
  console.log(`Workflow created: ${wf}`);

  // Nodes
  const input = await workflowService.addNode(wf, TEST_USER, {
    type: "input",
    name: "Topic",
    config: {},
    positionX: 100,
    positionY: 250,
  });

  const planner = await workflowService.addNode(wf, TEST_USER, {
    type: "agent",
    name: "Planner",
    config: { agentType: "planner" },
    positionX: 320,
    positionY: 250,
  });

  const researcher = await workflowService.addNode(wf, TEST_USER, {
    type: "agent",
    name: "Researcher",
    config: { agentType: "researcher" },
    positionX: 560,
    positionY: 130,
  });

  const writer = await workflowService.addNode(wf, TEST_USER, {
    type: "agent",
    name: "Writer",
    config: { agentType: "writer" },
    positionX: 560,
    positionY: 370,
  });

  const critic = await workflowService.addNode(wf, TEST_USER, {
    type: "agent",
    name: "Critic",
    config: { agentType: "critic" },
    positionX: 800,
    positionY: 250,
  });

  const output = await workflowService.addNode(wf, TEST_USER, {
    type: "output",
    name: "Final Brief",
    config: {},
    positionX: 1040,
    positionY: 250,
  });

  console.log("6 nodes created.");

  // Edges: input → planner → (researcher + writer) → critic → output
  const edges: [string, string][] = [
    [input.id, planner.id],
    [planner.id, researcher.id],
    [planner.id, writer.id],
    [researcher.id, critic.id],
    [writer.id, critic.id],
    [critic.id, output.id],
  ];

  for (const [source, target] of edges) {
    await workflowService.addEdge(wf, TEST_USER, { source, target });
  }

  console.log(`${edges.length} edges created.\n`);
  console.log("=== GRAPH READY ===");
  console.log(`Workflow ID: ${wf}`);
  console.log(`Structure: Input → Planner → [Researcher + Writer] → Critic → Output`);
  console.log(`\nTrigger with this body:`);
  console.log(`{ "input": { "query": "Write a short brief on the benefits of using Redis for caching in web applications." } }`);
  console.log("=====================\n");
}

seed().catch(console.error);