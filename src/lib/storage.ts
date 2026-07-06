import fs from 'fs/promises'
import path from 'path'

const isLocal =
  process.env.STORAGE_LOCAL === 'true' ||
  (!process.env.AWS_ACCESS_KEY_ID && !process.env.AWS_BUCKET)

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
}

function getS3Config() {
  const bucket = process.env.AWS_BUCKET
  const region = process.env.AWS_REGION || 'us-east-1'
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
  const endpoint = process.env.AWS_ENDPOINT // for MinIO compatibility
  if (!bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('Missing AWS_BUCKET, AWS_ACCESS_KEY_ID, or AWS_SECRET_ACCESS_KEY')
  }
  return { bucket, region, accessKeyId, secretAccessKey, endpoint }
}

async function s3Request(method: string, key: string, body?: Buffer, contentType?: string) {
  const { bucket, region, accessKeyId, secretAccessKey, endpoint } = getS3Config()
  const host = endpoint
    ? new URL(endpoint).host
    : `${bucket}.s3.${region}.amazonaws.com`
  const basePath = endpoint ? `/${bucket}/${key}` : `/${key}`
  const url = endpoint
    ? `${endpoint}/${bucket}/${key}`
    : `https://${bucket}.s3.${region}.amazonaws.com/${key}`

  const now = new Date()
  const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8)
  const amzDate = dateStamp + 'T' + now.toISOString().replace(/[-:]/g, '').slice(9, 15) + 'Z'

  // AWS Signature V4
  const { createHmac, createHash } = await import('crypto')
  const sha256 = (data: string | Buffer) => createHash('sha256').update(data).digest('hex')
  const hmacSha256 = (key: string | Buffer, data: string) =>
    createHmac('sha256', key).update(data).digest()

  const payloadHash = sha256(body || '')
  const headers: Record<string, string> = {
    host,
    'x-amz-date': amzDate,
    'x-amz-content-sha256': payloadHash,
  }
  if (contentType) headers['content-type'] = contentType

  const signedHeaderKeys = Object.keys(headers).sort()
  const signedHeaders = signedHeaderKeys.join(';')
  const canonicalHeaders = signedHeaderKeys.map((k) => `${k}:${headers[k]}\n`).join('')
  const canonicalRequest = [method, basePath, '', canonicalHeaders, signedHeaders, payloadHash].join('\n')

  const scope = `${dateStamp}/${region}/s3/aws4_request`
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n')

  let signingKey: Buffer = hmacSha256('AWS4' + secretAccessKey, dateStamp) as Buffer
  signingKey = hmacSha256(signingKey, region) as Buffer
  signingKey = hmacSha256(signingKey, 's3') as Buffer
  signingKey = hmacSha256(signingKey, 'aws4_request') as Buffer
  const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex')

  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  const res = await fetch(url, {
    method,
    headers: { ...headers, authorization },
    body: body || undefined,
  })

  if (!res.ok && method !== 'DELETE') {
    const text = await res.text()
    throw new Error(`S3 ${method} failed (${res.status}): ${text}`)
  }

  return res
}

export async function uploadFile(key: string, buffer: Buffer, mime: string): Promise<string> {
  if (isLocal) {
    await ensureUploadsDir()
    const filePath = path.join(UPLOADS_DIR, key)
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, buffer)
    return `/api/uploads/${key}`
  }
  await s3Request('PUT', key, buffer, mime)
  return getFileUrl(key)
}

export function getFileUrl(key: string): string {
  if (isLocal) {
    return `/api/uploads/${key}`
  }
  const { bucket, region, endpoint } = getS3Config()
  if (endpoint) return `${endpoint}/${bucket}/${key}`
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`
}

export async function deleteFile(key: string): Promise<void> {
  if (isLocal) {
    const filePath = path.join(UPLOADS_DIR, key)
    await fs.unlink(filePath).catch(() => {})
    return
  }
  await s3Request('DELETE', key)
}
