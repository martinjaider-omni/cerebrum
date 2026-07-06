import fs from 'fs/promises'
import path from 'path'

const isLocal =
  process.env.STORAGE_LOCAL === 'true' ||
  (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_BUCKET)

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
}

export async function uploadFile(key: string, buffer: Buffer, mime: string): Promise<string> {
  if (isLocal) {
    await ensureUploadsDir()
    const filePath = path.join(UPLOADS_DIR, key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buffer)
    return `/api/uploads/${key}`
  }
  throw new Error('S3 storage not configured')
}

export function getFileUrl(key: string): string {
  if (isLocal) {
    return `/api/uploads/${key}`
  }
  const bucket = process.env.AWS_BUCKET
  const region = process.env.AWS_REGION
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

export async function deleteFile(key: string): Promise<void> {
  if (isLocal) {
    const filePath = path.join(UPLOADS_DIR, key)
    await fs.unlink(filePath).catch(() => {})
    return
  }
  throw new Error('S3 storage not configured')
}
