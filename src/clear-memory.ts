import { Pinecone } from "@pinecone-database/pinecone";
import { MemoryRepository } from "./modules/memory/memory.repository";
import { env } from "./config/env";

const TEST_USER = "b6753b80-cb8f-4a15-9b35-88606b4746fd";

async function clear() {
  const repo = new MemoryRepository();

  // Wipe Postgres records
  const memories = await repo.findByUserId(TEST_USER, 1000);
  const ids = memories.map((m) => m.id);
  if (ids.length > 0) {
    await repo.deleteMany(ids);
  }

  // Wipe the entire Pinecone namespace in one shot
  const pc = new Pinecone({ apiKey: env.PINECONE_API_KEY! });
  const index = pc.index(env.PINECONE_INDEX_NAME!);
  const namespace = `memory_${TEST_USER}`;

  try {
    await index.namespace(namespace).deleteAll();
    console.log(`Cleared namespace ${namespace} and ${ids.length} Postgres records.`);
  } catch (e: any) {
    // deleteAll throws if namespace doesn't exist — that's fine, means already empty
    console.log(`Postgres cleared (${ids.length}). Pinecone namespace was already empty.`);
  }
}

clear().catch(console.error);