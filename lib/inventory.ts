import 'server-only'
import * as cheerio from 'cheerio'
import type { Vehicle, WatchCriteria } from '@/lib/matching'

export const YARD_URL = 'https://www.rgpick-a-part.com/inventory.php'

export async function fetchInventory({ fresh = false } = {}): Promise<Vehicle[]> {
  const res = await fetch(YARD_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) JunkyardScraper' },
    ...(fresh ? { cache: 'no-store' as const } : { next: { revalidate: 600 } }),
  })
  if (!res.ok) throw new Error(`Inventory request failed: HTTP ${res.status}`)

  const $ = cheerio.load(await res.text())
  const vehicles: Vehicle[] = []
  $('#vehicles tr').each((_, tr) => {
    const cols = $(tr)
      .find('td')
      .map((__, td) => $(td).text().trim())
      .get()
    if (cols.length < 5 || !cols[3]) return
    vehicles.push({ year: cols[0], make: cols[1], model: cols[2], stock: cols[3], row: cols[4] })
  })

  if (vehicles.length === 0) throw new Error('No vehicles parsed - the site layout may have changed.')
  return vehicles
}

export type { Vehicle, WatchCriteria }
