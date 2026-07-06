import { Queue, Worker } from 'bullmq'
import IORedis from 'ioredis'
import { processBatch } from './prospecting'

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
const QUEUE_NAME = 'prospecting'

let connection: IORedis | null = null

function getConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null })
  }
  return connection
}

let queue: Queue | null = null

export function getProspectingQueue(): Queue {
  if (!queue) {
    queue = new Queue(QUEUE_NAME, { connection: getConnection() })
  }
  return queue
}

export async function enqueueBatch(batchId: string): Promise<void> {
  const q = getProspectingQueue()
  await q.add('process-batch', { batchId }, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  })
}

let worker: Worker | null = null

export function startWorker(): Worker {
  if (worker) return worker

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const { batchId } = job.data as { batchId: string }
      await processBatch(batchId)
    },
    {
      connection: getConnection(),
      concurrency: 2,
    }
  )

  worker.on('failed', (job, err) => {
    console.error(`[queue] Job ${job?.id} failed:`, err.message)
  })

  return worker
}
