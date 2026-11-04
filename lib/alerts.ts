import 'server-only'
import { and, eq, inArray, isNull, notInArray } from 'drizzle-orm'
import { Resend } from 'resend'
import { db } from '@/lib/db'
import { alertSettings, seenMatches, user, watchItems, type Frequency, type WatchItem } from '@/lib/db/schema'
import { fetchInventory, YARD_URL, type Vehicle } from '@/lib/inventory'
import { matchesWatch, watchLabel } from '@/lib/matching'

const DIGEST_INTERVAL_MS: Record<Frequency, number> = {
  instant: 0,
  daily: 23 * 60 * 60 * 1000,
  weekly: (7 * 24 - 1) * 60 * 60 * 1000,
}

type MatchRow = typeof seenMatches.$inferInsert

function matchRows(item: WatchItem, vehicles: Vehicle[], notifiedAt: Date | null): MatchRow[] {
  return vehicles
    .filter((v) => matchesWatch(v, item))
    .map((v) => ({
      watchItemId: item.id,
      userId: item.userId,
      stock: v.stock,
      year: v.year,
      make: v.make,
      model: v.model,
      row: v.row,
      notifiedAt,
    }))
}

/** Marks every vehicle currently in the yard as already seen, so only new arrivals trigger email. */
export async function baselineWatchItem(item: WatchItem) {
  const vehicles = await fetchInventory()
  const rows = matchRows(item, vehicles, new Date())
  if (rows.length) await db.insert(seenMatches).values(rows).onConflictDoNothing()
}

function fromAddress() {
  const domain = process.env.RESEND_EMAIL_DOMAIN
  if (!domain) throw new Error('RESEND_EMAIL_DOMAIN is not set')
  return `Junkyard Scraper <alerts@${domain}>`
}

export async function sendMatchEmail(to: string, matches: Array<Pick<MatchRow, 'year' | 'make' | 'model' | 'stock' | 'row'> & { label: string }>, subject: string) {
  const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  const lines = matches.map((m) => `${m.year} ${m.make} ${m.model} | Row ${m.row || 'TBD'} | ${m.stock} (watch: ${m.label})`)
  const rowsHtml = matches
    .map(
      (m) =>
        `<tr><td style="padding:6px 10px">${escape(`${m.year} ${m.make} ${m.model}`)}</td><td style="padding:6px 10px;font-family:monospace">Row ${escape(m.row || 'TBD')}</td><td style="padding:6px 10px;font-family:monospace;color:#666">${escape(m.stock)}</td></tr>`,
    )
    .join('')

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: fromAddress(),
    to,
    subject,
    text: `${lines.join('\n')}\n\nFull inventory: ${YARD_URL}`,
    html: `<div style="font-family:system-ui,sans-serif"><p>Vehicles matching your watchlist at RG Pick-A-Part:</p><table style="border-collapse:collapse">${rowsHtml}</table><p><a href="${YARD_URL}">View full inventory</a></p></div>`,
  })
  if (error) throw new Error(`Resend error: ${error.message}`)
}

export async function runAlertCheck() {
  const vehicles = await fetchInventory({ fresh: true })
  const items = await db.select().from(watchItems)

  for (const item of items) {
    const rows = matchRows(item, vehicles, item.notify ? null : new Date())
    if (rows.length) await db.insert(seenMatches).values(rows).onConflictDoNothing()
  }

  const currentStocks = vehicles.map((v) => v.stock)
  await db.delete(seenMatches).where(notInArray(seenMatches.stock, currentStocks))

  const pending = await db
    .select({
      watchItemId: seenMatches.watchItemId,
      userId: seenMatches.userId,
      stock: seenMatches.stock,
      year: seenMatches.year,
      make: seenMatches.make,
      model: seenMatches.model,
      row: seenMatches.row,
      watchMake: watchItems.make,
      watchModel: watchItems.model,
      yearMin: watchItems.yearMin,
      yearMax: watchItems.yearMax,
    })
    .from(seenMatches)
    .innerJoin(watchItems, eq(watchItems.id, seenMatches.watchItemId))
    .where(and(isNull(seenMatches.notifiedAt), eq(watchItems.notify, true)))

  const byUser = Map.groupBy(pending, (p) => p.userId)
  let emailsSent = 0
  let emailErrors = 0

  for (const [userId, matches] of byUser) {
    const [settings] = await db.select().from(alertSettings).where(eq(alertSettings.userId, userId))
    const [account] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId))
    const to = settings?.email ?? account?.email
    if (!to) continue

    const frequency = (settings?.frequency ?? 'instant') as Frequency
    const lastSent = settings?.lastSentAt?.getTime() ?? 0
    if (Date.now() - lastSent < DIGEST_INTERVAL_MS[frequency]) continue

    try {
      await sendMatchEmail(
        to,
        matches.map((m) => ({
          ...m,
          label: watchLabel({ make: m.watchMake, model: m.watchModel, yearMin: m.yearMin, yearMax: m.yearMax }),
        })),
        `Junkyard Scraper: ${matches.length} new vehicle${matches.length === 1 ? '' : 's'} at RG Pick-A-Part`,
      )
    } catch (error) {
      // Leave matches pending so the next run retries this user.
      console.error(`Alert email to user ${userId} failed:`, error)
      emailErrors++
      continue
    }
    emailsSent++

    const now = new Date()
    for (const [watchItemId, group] of Map.groupBy(matches, (m) => m.watchItemId)) {
      await db
        .update(seenMatches)
        .set({ notifiedAt: now })
        .where(and(eq(seenMatches.watchItemId, watchItemId), inArray(seenMatches.stock, group.map((m) => m.stock))))
    }
    await db
      .insert(alertSettings)
      .values({ userId, email: to, frequency, lastSentAt: now })
      .onConflictDoUpdate({ target: alertSettings.userId, set: { lastSentAt: now } })
  }

  return { vehicles: vehicles.length, watchItems: items.length, pendingMatches: pending.length, emailsSent, emailErrors }
}
