'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { RowTag } from '@/components/row-tag'
import { cn } from '@/lib/utils'
import type { WatchedVehicle } from '@/lib/types'

type SortKey = 'row' | 'make' | 'model' | 'year'

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'row', label: 'Row' },
  { key: 'make', label: 'Make' },
  { key: 'model', label: 'Model' },
  { key: 'year', label: 'Year' },
]

function rowNumber(row: string) {
  const n = Number.parseInt(row, 10)
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n
}

export function WatchedVehiclesCard({ vehicles }: { vehicles: WatchedVehicle[] }) {
  const [sort, setSort] = useState<SortKey>('row')

  const sorted = useMemo(() => {
    const list = [...vehicles]
    list.sort((a, b) => {
      if (sort === 'row') return rowNumber(a.row) - rowNumber(b.row) || a.make.localeCompare(b.make)
      if (sort === 'year') return Number(b.year) - Number(a.year)
      return a[sort].localeCompare(b[sort]) || rowNumber(a.row) - rowNumber(b.row)
    })
    return list
  }, [vehicles, sort])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Watched vehicles in the yard</CardTitle>
        <CardDescription className="leading-relaxed">
          {vehicles.length === 0
            ? 'None of your watched vehicles are on the lot right now.'
            : `${vehicles.length} matching vehicle${vehicles.length === 1 ? '' : 's'} on the lot.`}
        </CardDescription>
      </CardHeader>
      {vehicles.length > 0 && (
        <CardContent className="flex flex-col gap-3">
          <div role="group" aria-label="Sort watched vehicles" className="flex gap-1 rounded-lg bg-muted p-1">
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                aria-pressed={sort === s.key}
                onClick={() => setSort(s.key)}
                className={cn(
                  'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                  sort === s.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <ul className="flex max-h-[32rem] flex-col divide-y divide-border overflow-y-auto rounded-lg border border-border">
            {sorted.map((v) => (
              <li key={v.stock} className="flex items-center gap-3 px-3 py-2.5">
                <RowTag row={v.row} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">
                    {v.year} {v.make} {v.model}
                  </span>
                  <span className="truncate font-mono text-xs text-muted-foreground">{v.stock}</span>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      )}
    </Card>
  )
}
