import Link from 'next/link'
import { asc, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { alertSettings, watchItems, type Frequency } from '@/lib/db/schema'
import { fetchInventory } from '@/lib/inventory'
import { matchesWatch, watchLabel, type Vehicle } from '@/lib/matching'
import type { MakeModels, WatchedVehicle, WatchItemView } from '@/lib/types'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SiteHeader } from '@/components/site-header'
import { WatchlistCard } from '@/components/watchlist-card'
import { WatchedVehiclesCard } from '@/components/watched-vehicles-card'
import { AlertSettingsCard } from '@/components/alert-settings-card'
import { InventoryCard } from '@/components/inventory-card'

function buildMakeModels(vehicles: Vehicle[]): MakeModels {
  const map = new Map<string, Set<string>>()
  for (const v of vehicles) {
    if (!v.make) continue
    if (!map.has(v.make)) map.set(v.make, new Set())
    if (v.model) map.get(v.make)!.add(v.model)
  }
  return Object.fromEntries(
    [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([make, models]) => [make, [...models].sort()]),
  )
}

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() })

  let vehicles: Vehicle[] = []
  let inventoryError = false
  try {
    vehicles = await fetchInventory()
  } catch (error) {
    console.error('Inventory fetch failed:', error)
    inventoryError = true
  }

  let items: WatchItemView[] = []
  let watched: WatchedVehicle[] = []
  let settings = { email: session?.user.email ?? '', frequency: 'instant' as Frequency }

  if (session?.user) {
    const userId = session.user.id
    const [rows, [saved]] = await Promise.all([
      db.select().from(watchItems).where(eq(watchItems.userId, userId)).orderBy(asc(watchItems.make), asc(watchItems.model)),
      db.select().from(alertSettings).where(eq(alertSettings.userId, userId)),
    ])
    if (saved) settings = { email: saved.email, frequency: saved.frequency as Frequency }

    items = rows.map((w) => ({
      id: w.id,
      make: w.make,
      model: w.model,
      yearMin: w.yearMin,
      yearMax: w.yearMax,
      notify: w.notify,
      label: watchLabel(w),
      inYard: vehicles.filter((v) => matchesWatch(v, w)).length,
    }))
    watched = vehicles.flatMap((v) => {
      const item = items.find((w) => matchesWatch(v, w))
      return item ? [{ ...v, label: item.label }] : []
    })
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:py-10">
      <SiteHeader email={session?.user.email} vehicleCount={inventoryError ? null : vehicles.length} />

      {session?.user ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-6">
            <WatchlistCard items={items} makeModels={buildMakeModels(vehicles)} />
            <AlertSettingsCard email={settings.email} frequency={settings.frequency} />
          </div>
          <WatchedVehiclesCard vehicles={watched} />
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="leading-relaxed text-pretty text-muted-foreground">
              <span className="font-semibold text-foreground">Looking for a specific car?</span> Create a free account to
              build a watchlist and get emailed the moment it shows up at the yard.
            </p>
            <Link href="/sign-up" className={buttonVariants({ className: 'self-start sm:self-auto' })}>
              Start a watchlist
            </Link>
          </CardContent>
        </Card>
      )}

      <InventoryCard vehicles={vehicles} watchItems={items} signedIn={!!session?.user} error={inventoryError} />
    </main>
  )
}
