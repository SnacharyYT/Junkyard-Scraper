'use server'

import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { alertSettings, seenMatches, watchItems, type Frequency } from '@/lib/db/schema'
import { baselineWatchItem, sendMatchEmail } from '@/lib/alerts'
import { fetchInventory } from '@/lib/inventory'
import { matchesWatch, watchLabel } from '@/lib/matching'

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

async function getSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')
  return session.user
}

function parseYear(value: FormDataEntryValue | null) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const year = Number(text)
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw new Error('Years must be between 1900 and 2100.')
  return year
}

export async function addWatchItem(formData: FormData): Promise<ActionResult> {
  try {
    const { id: userId } = await getSessionUser()
    const make = String(formData.get('make') ?? '').trim().toUpperCase().slice(0, 40)
    const model = String(formData.get('model') ?? '').trim().toUpperCase().slice(0, 60)
    const yearMin = parseYear(formData.get('yearMin'))
    const yearMax = parseYear(formData.get('yearMax'))
    if (!make) return { ok: false, error: 'Make is required.' }
    if (yearMin && yearMax && yearMin > yearMax) return { ok: false, error: 'The "from" year must be before the "to" year.' }

    const existing = await db.select().from(watchItems).where(and(eq(watchItems.userId, userId), eq(watchItems.make, make), eq(watchItems.model, model)))
    if (existing.some((w) => w.yearMin === yearMin && w.yearMax === yearMax)) {
      return { ok: false, error: `${watchLabel({ make, model, yearMin, yearMax })} is already on your watchlist.` }
    }

    const [item] = await db.insert(watchItems).values({ userId, make, model, yearMin, yearMax }).returning()
    try {
      await baselineWatchItem(item)
    } catch (error) {
      console.error('Baseline failed; current matches may be emailed on the next check:', error)
    }
    revalidatePath('/')
    return { ok: true, message: `Watching ${watchLabel(item)}` }
  } catch (error) {
    return { ok: false, error: error instanceof Error && error.message !== 'Unauthorized' ? error.message : 'Please sign in to edit your watchlist.' }
  }
}

export async function removeWatchItem(id: number): Promise<ActionResult> {
  const { id: userId } = await getSessionUser()
  await db.delete(watchItems).where(and(eq(watchItems.id, id), eq(watchItems.userId, userId)))
  await db.delete(seenMatches).where(and(eq(seenMatches.watchItemId, id), eq(seenMatches.userId, userId)))
  revalidatePath('/')
  return { ok: true }
}

export async function setWatchNotify(id: number, notify: boolean): Promise<ActionResult> {
  const { id: userId } = await getSessionUser()
  await db.update(watchItems).set({ notify }).where(and(eq(watchItems.id, id), eq(watchItems.userId, userId)))
  revalidatePath('/')
  return { ok: true }
}

const FREQUENCIES: Frequency[] = ['instant', 'daily', 'weekly']

export async function saveAlertSettings(formData: FormData): Promise<ActionResult> {
  const { id: userId } = await getSessionUser()
  const email = String(formData.get('email') ?? '').trim().slice(0, 254)
  const frequency = String(formData.get('frequency') ?? '') as Frequency
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'Enter a valid email address.' }
  if (!FREQUENCIES.includes(frequency)) return { ok: false, error: 'Choose a frequency.' }

  await db
    .insert(alertSettings)
    .values({ userId, email, frequency })
    .onConflictDoUpdate({ target: alertSettings.userId, set: { email, frequency, updatedAt: new Date() } })
  revalidatePath('/')
  return { ok: true, message: 'Alert settings saved.' }
}

export async function sendTestEmail(): Promise<ActionResult> {
  const user = await getSessionUser()
  const [settings] = await db.select().from(alertSettings).where(eq(alertSettings.userId, user.id))
  const to = settings?.email ?? user.email
  const items = await db.select().from(watchItems).where(eq(watchItems.userId, user.id))
  if (!items.length) return { ok: false, error: 'Add a vehicle to your watchlist first.' }

  try {
    const vehicles = await fetchInventory()
    const matches = vehicles.flatMap((v) => {
      const item = items.find((w) => matchesWatch(v, w))
      return item ? [{ ...v, label: watchLabel(item) }] : []
    })
    if (!matches.length) {
      return { ok: false, error: 'None of your watched vehicles are in the yard right now, so there is nothing to send.' }
    }
    await sendMatchEmail(to, matches.slice(0, 50), `Junkyard Scraper test: ${matches.length} watched vehicles in the yard now`)
    return { ok: true, message: `Test email sent to ${to}.` }
  } catch (error) {
    console.error('Test email failed:', error)
    return { ok: false, error: 'Could not send the email. Check that your Resend domain is verified.' }
  }
}
