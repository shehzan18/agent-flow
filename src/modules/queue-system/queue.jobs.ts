// Base job data every job must have
export interface BaseJobData {
  executionId: string;
  workflowId: string;
  userId: string;
  correlationId?: string;
}

// Agent node job
export interface AgentNodeJobData extends BaseJobData {
  nodeId: string;
  nodeType: "agent";
  nodeName: string;
  config: {
    agentType: "planner" | "researcher" | "critic" | "writer";
    model?: string;
    maxTokens?: number;
    systemPrompt?: string;
  };
  input: Record<string, any>;
}

// RAG node job
export interface RagNodeJobData extends BaseJobData {
  nodeId: string;
  nodeType: "rag";
  nodeName: string;
  config: {
    topK?: number;
    threshold?: number;
    namespace?: string;
  };
  input: {
    query: string;
  };
}

// Memory node job
export interface MemoryNodeJobData extends BaseJobData {
  nodeId: string;
  nodeType: "memory";
  nodeName: string;
  config: {
    operation: "read" | "write";
    memoryType?: "episodic" | "preference" | "knowledge";
  };
  input: Record<string, any>;
}

// Input node job
export interface InputNodeJobData extends BaseJobData {
  nodeId: string;
  nodeType: "input";
  nodeName: string;
  input: Record<string, any>;
}

// Output node job
export interface OutputNodeJobData extends BaseJobData {
  nodeId: string;
  nodeType: "output";
  nodeName: string;
  input: Record<string, any>;
}

// Schedule trigger job
export interface ScheduleTriggerJobData {
  scheduleId: string;
  workflowId: string;
  userId: string;
  triggerTime: string;
}

// Job result — what every worker returns
export interface JobResult {
  success: boolean;
  nodeId: string;
  executionId: string;
  output?: Record<string, any>;
  error?: string;
  tokensUsed?: {
    input: number;
    output: number;
    total: number;
  };
  latencyMs?: number;
}

// Union type of all possible job data
export type AnyJobData =
  | AgentNodeJobData
  | RagNodeJobData
  | MemoryNodeJobData
  | InputNodeJobData
  | OutputNodeJobData;



// Defines the exact shape of data that goes into each job. 
// Think of it as the typed payload for every job type. When you add a job to the queue, 
// TypeScript will enforce that you're sending the right data.

// Explanation:
// BaseJobData — every single job regardless of type must carry these four fields:
// executionId  → which workflow execution this belongs to
// workflowId   → which workflow
// userId       → who triggered it
// correlationId → for tracing logs across services

// This is important because when a worker finishes a job it needs to report back to the execution manager —
//  and it needs these IDs to know where to report.
// extends BaseJobData — each specific job type inherits all base fields and adds its own. So AgentNodeJobData
//  has everything in BaseJobData plus nodeId, nodeType, config, input. TypeScript inheritance.
// Extract<NodeType, "agent"> — NodeType is the Prisma enum with all node types. Extract pulls out just the
//  "agent" literal. So nodeType can only ever be "agent" in AgentNodeJobData. This prevents you from accidentally 
//  putting a RAG job in the agent queue with wrong type.
// config is different per job type:

// Agent config has agentType, model, maxTokens, systemPrompt
// RAG config has topK, threshold, namespace
// Memory config has operation (read or write), memoryType

// Each node type needs completely different configuration. Separate interfaces enforce the right shape for each.

// JobResult — what every worker returns when it finishes:

// success → did it work or not
// output → the result data (agent response, retrieved chunks, etc.)
// error → if it failed, why
// tokensUsed → for cost tracking — how many tokens the LLM used
// latencyMs → how long it took — for observability

// AnyJobData — a union type combining all job data types. Used in places where you handle any job regardless
//  of type.

// Done? Tell me and we move to queue.service.ts — the main queue file that creates all queues and provides
//  methods to add jobs.