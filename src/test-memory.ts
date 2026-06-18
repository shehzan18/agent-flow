import { MemoryService } from "./modules/memory/memory.service";

const memoryService = new MemoryService();
const TEST_USER = "b6753b80-cb8f-4a15-9b35-88606b4746fd";

async function test() {
  console.log("\n=== MEMORY ENGINE TEST ===\n");

  // 1. CREATE — three distinct facts
  console.log("--- Saving 3 distinct facts ---");
  const r1 = await memoryService.save({
    content: "User is a final-year CSE student at NIT.",
    importance: 8,
    userId: TEST_USER,
  });
  console.log(`1: ${r1.outcome} → "${r1.content}"`);

  const r2 = await memoryService.save({
    content: "User is targeting backend SDE roles.",
    importance: 9,
    userId: TEST_USER,
  });
  console.log(`2: ${r2.outcome} → "${r2.content}"`);

  const r3 = await memoryService.save({
    content: "User prefers concise technical answers.",
    importance: 6,
    userId: TEST_USER,
  });
  console.log(`3: ${r3.outcome} → "${r3.content}"`);

  // 2. UPDATE test — near-identical fact should update, not create
  console.log("\n--- Saving a near-identical fact (expect UPDATE) ---");
  const r4 = await memoryService.save({
    content: "User is a final year Computer Science student at NIT.",
    importance: 8,
    userId: TEST_USER,
  });
  console.log(`4: ${r4.outcome} → "${r4.content}"`);

  // 3. MERGE test — related fact should merge
  console.log("\n--- Saving a related fact (expect MERGE or CREATE) ---");
  const r5 = await memoryService.save({
    content: "User also wants to explore AI engineer positions.",
    importance: 7,
    userId: TEST_USER,
  });
  console.log(`5: ${r5.outcome} → "${r5.content}"`);

  // 4. RECALL test
  console.log("\n--- Recalling: 'what kind of jobs is the user looking for?' ---");
  const recalled = await memoryService.recall({
    query: "what kind of jobs is the user looking for?",
    userId: TEST_USER,
    topK: 5,
  });

  recalled.forEach((m, i) => {
    console.log(
      `${i + 1}. [final=${m.scores.final.toFixed(3)} sim=${m.scores.similarity.toFixed(2)} rec=${m.scores.recency.toFixed(2)} imp=${m.scores.importance.toFixed(2)}] "${m.content}"`
    );
  });

  console.log("\n=== DONE ===\n");
}

test().catch(console.error);