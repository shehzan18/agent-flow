-- AlterTable
ALTER TABLE "node_executions" ADD COLUMN     "cost" DOUBLE PRECISION DEFAULT 0;

-- AlterTable
ALTER TABLE "workflow_executions" ADD COLUMN     "total_cost" DOUBLE PRECISION DEFAULT 0;
