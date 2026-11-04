import { runAlertCheck } from '@/lib/alerts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runAlertCheck()
    return Response.json({ ok: true, ...result })
  } catch (error) {
    console.error('Alert check failed:', error)
    return Response.json({ ok: false, error: 'Alert check failed' }, { status: 500 })
  }
}
