'use client'

import { useDeferredValue, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Check, Eye, Search } from 'lucide-react'
import { addWatchItem } from '@/app/actions/watchlist'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { RowTag } from '@/components/row-tag'
import { matchesWatch, type Vehicle } from '@/lib/matching'
import type { WatchItemView } from '@/lib/types'

const PAGE_SIZE = 40

export function InventoryCard({
  vehicles,
  watchItems,
  signedIn,
  error,
}: {
  vehicles: Vehicle[]
  watchItems: WatchItemView[]
  signedIn: boolean
  error: boolean
}) {
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(PAGE_SIZE)
  const deferredQuery = useDeferredValue(query)

  const results = useMemo(() => {
    const terms = deferredQuery.toUpperCase().split(/\s+/).filter(Boolean)
    if (!terms.length) return vehicles
    return vehicles.filter((v) => {
      const haystack = `${v.year} ${v.make} ${v.model} ${v.stock} ROW${v.row}`
      return terms.every((t) => haystack.includes(t))
    })
  }, [vehicles, deferredQuery])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Search the yard</CardTitle>
        <CardDescription className="leading-relaxed">
          {error
            ? 'Could not reach RG Pick-A-Part right now. Try again in a few minutes.'
            : `${results.length.toLocaleString()} of ${vehicles.length.toLocaleString()} vehicles`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="relative">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="inventory-search" className="sr-only">
            Search by year, make, model, or stock number
          </label>
          <Input
            id="inventory-search"
            type="search"
            placeholder="e.g. 2005 honda civic"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(PAGE_SIZE)
            }}
            className="h-10 pl-9"
          />
        </div>

        {results.length === 0 && !error ? (
          <p className="rounded-lg border border-dashed border-input p-4 text-center text-sm leading-relaxed text-muted-foreground">
            No vehicles match &ldquo;{query}&rdquo;. Add it to your watchlist to get an email when one arrives.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {results.slice(0, limit).map((v) => (
              <InventoryRow
                key={v.stock}
                vehicle={v}
                watched={watchItems.some((w) => matchesWatch(v, w))}
                signedIn={signedIn}
              />
            ))}
          </ul>
        )}

        {results.length > limit && (
          <Button variant="outline" className="self-center" onClick={() => setLimit((l) => l + PAGE_SIZE * 2)}>
            Show more ({(results.length - limit).toLocaleString()} left)
          </Button>
        )}
      </CardContent>
    </Card>
  )
}

function InventoryRow({ vehicle, watched, signedIn }: { vehicle: Vehicle; watched: boolean; signedIn: boolean }) {
  const [pending, startTransition] = useTransition()
  const [failed, setFailed] = useState(false)
  const name = `${vehicle.year} ${vehicle.make} ${vehicle.model}`.trim()
  const watchTarget = `${vehicle.make} ${vehicle.model}`.trim()

  function watch() {
    const formData = new FormData()
    formData.set('make', vehicle.make)
    formData.set('model', vehicle.model)
    startTransition(async () => {
      const result = await addWatchItem(formData)
      setFailed(!result.ok)
    })
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <RowTag row={vehicle.row} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium">{name}</span>
        <span className="truncate font-mono text-xs text-muted-foreground">{vehicle.stock}</span>
      </div>
      {!signedIn ? (
        <Link href="/sign-in" className={buttonVariants({ variant: 'outline', size: 'sm' })} aria-label={`Sign in to watch ${watchTarget}`}>
          <Eye aria-hidden="true" />
          Watch
        </Link>
      ) : watched ? (
        <span className="flex items-center gap-1 px-2 text-xs font-medium text-primary">
          <Check aria-hidden="true" className="size-3.5" />
          Watching
        </span>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={watch}
          aria-label={`Watch ${watchTarget}`}
          className={failed ? 'border-destructive text-destructive' : undefined}
        >
          <Eye aria-hidden="true" />
          {pending ? 'Adding' : failed ? 'Retry' : 'Watch'}
        </Button>
      )}
    </li>
  )
}
