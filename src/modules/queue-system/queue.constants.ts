// Queue names — one queue per job type
export const QUEUE_NAMES = {
  AGENT: "agent-queue",
  RAG: "rag-queue",
  MEMORY: "memory-queue",
  SCHEDULE: "schedule-queue",
  DLQ: "dead-letter-queue",
} as const;

// Job names — what type of work each job represents
export const JOB_NAMES = {
  EXECUTE_AGENT_NODE: "execute-agent-node",
  EXECUTE_RAG_NODE: "execute-rag-node",
  EXECUTE_MEMORY_NODE: "execute-memory-node",
  EXECUTE_INPUT_NODE: "execute-input-node",
  EXECUTE_OUTPUT_NODE: "execute-output-node",
  TRIGGER_SCHEDULED_WORKFLOW: "trigger-scheduled-workflow",
} as const;

// Default job options applied to every job
export const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: "exponential" as const,
    delay: 5000,
  },
  removeOnComplete: {
    count: 100,    // keep last 100 completed jobs in Redis
    age: 3600,     // keep completed jobs for 1 hour
  },
  removeOnFail: {
    count: 200,    // keep last 200 failed jobs for debugging
  },
};

// Concurrency limits per queue
export const QUEUE_CONCURRENCY = {
  AGENT: 5,    // max 5 agent jobs running simultaneously
  RAG: 10,     // RAG is faster, allow more concurrent
  MEMORY: 10,
  SCHEDULE: 3,
} as const;


// as const — tells TypeScript to treat these values as literal types, not just strings. 
// Without it TypeScript sees AGENT: string. With it TypeScript sees AGENT: "agent-queue". 
// This means if you try to use QUEUE_NAMES.AGNT (typo) TypeScript catches it at compile time.
// DEFAULT_JOB_OPTIONS — these options apply to every job we add to any queue:

// attempts: 3 → if a job fails, retry it up to 3 times total
// backoff: exponential → wait 5s before retry 1, 10s before retry 2, 20s before retry 
// 3. Exponential means each wait doubles. This prevents hammering a failing service

// removeOnComplete: { count: 100 } → after a job completes successfully, keep it in Redis 
// for debugging but only keep the last 100. Without this Redis fills up with thousands of completed jobs
// removeOnFail: { count: 200 } → keep more failed jobs because you need them for debugging