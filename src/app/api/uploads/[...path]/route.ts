import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const UPLOADS_DIR = path.join(process.cwd(), 'uploads')

const MIME_MAP: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  pdf: 'application/pdf',
}

export async function GET(_req: Request, { params }: { params: { path: string[] } }) {
  const rel = params.path.join('/')
  // Prevent path traversal
  const abs = path.resolve(UPLOADS_DIR, rel)
  if (!abs.startsWith(UPLOADS_DIR)) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  try {
    const buf = await fs.readFile(abs)
    const ext = abs.split('.').pop()?.toLowerCase() ?? ''
    const contentType = MIME_MAP[ext] ?? 'application/octet-stream'
    return new NextResponse(buf, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new NextResponse('Not Found', { status: 404 })
  }
}
