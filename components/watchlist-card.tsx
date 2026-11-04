'use client'

import { useRef, useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { addWatchItem, removeWatchItem, setWatchNotify } from '@/app/actions/watchlist'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { MakeModels, WatchItemView } from '@/lib/types'

export function WatchlistCard({ items, makeModels }: { items: WatchItemView[]; makeModels: MakeModels }) {
  const formRef = useRef<HTMLFormElement>(null)
  const [make, setMake] = useState('')
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const makes = Object.keys(makeModels)
  const models = makeModels[make.trim().toUpperCase()] ?? []

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addWatchItem(formData)
      if (result.ok) {
        formRef.current?.reset()
        setMake('')
        setStatus({ ok: true, text: result.message ?? 'Added.' })
      } else {
        setStatus({ ok: false, text: result.error })
      }
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Your watchlist</CardTitle>
        <CardDescription className="leading-relaxed">
          Get an email when a matching vehicle is added to the yard, even if none are there today.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="watch-make">Make</Label>
              <Input
                id="watch-make"
                name="make"
                list="make-options"
                placeholder="NISSAN"
                required
                autoComplete="off"
                value={make}
                onChange={(e) => setMake(e.target.value)}
                className="uppercase"
              />
              <datalist id="make-options">
                {makes.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="watch-model">Model</Label>
              <Input
                id="watch-model"
                name="model"
                list="model-options"
                placeholder="300ZX"
                autoComplete="off"
                className="uppercase"
              />
              <datalist id="model-options">
                {models.map((m) => (
                  <option key={m} value={m} />
                ))}
              </datalist>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="watch-year-min">Year from</Label>
              <Input id="watch-year-min" name="yearMin" type="number" inputMode="numeric" min={1900} max={2100} placeholder="Any" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="watch-year-max">Year to</Label>
              <Input id="watch-year-max" name="yearMax" type="number" inputMode="numeric" min={1900} max={2100} placeholder="Any" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={pending}>
              <Plus aria-hidden="true" />
              {pending ? 'Adding...' : 'Add to watchlist'}
            </Button>
            <p aria-live="polite" className={status?.ok === false ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
              {status?.text}
            </p>
          </div>
        </form>

        {items.length === 0 ? (
          <p className="rounded-lg border border-dashed border-input p-4 text-center text-sm leading-relaxed text-muted-foreground">
            Nothing watched yet. Add a make and model above, or tap Watch on any vehicle in the inventory.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {items.map((item) => (
              <WatchlistRow key={item.id} item={item} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function WatchlistRow({ item }: { item: WatchItemView }) {
  const [notify, setNotify] = useState(item.notify)
  const [pending, startTransition] = useTransition()
  const switchId = `notify-${item.id}`

  return (
    <li className="flex items-center gap-3 px-3 py-3">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-semibold">{item.label}</span>
        <span className="text-xs text-muted-foreground">
          <span className={item.inYard > 0 ? 'font-mono font-bold text-primary' : 'font-mono'}>{item.inYard}</span> in yard
          {' · '}
          <label htmlFor={switchId}>Email {notify ? 'on' : 'off'}</label>
        </span>
      </div>
      <Switch
        id={switchId}
        checked={notify}
        disabled={pending}
        aria-label={`Email notifications for ${item.label}`}
        onCheckedChange={(checked) => {
          setNotify(checked)
          startTransition(async () => {
            await setWatchNotify(item.id, checked)
          })
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label={`Remove ${item.label} from watchlist`}
        onClick={() => startTransition(async () => void (await removeWatchItem(item.id)))}
      >
        <Trash2 aria-hidden="true" />
      </Button>
    </li>
  )
}
