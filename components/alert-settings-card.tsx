'use client'

import { useState, useTransition } from 'react'
import { saveAlertSettings, sendTestEmail, type ActionResult } from '@/app/actions/watchlist'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { Frequency } from '@/lib/db/schema'

const OPTIONS: { value: Frequency; label: string; hint: string }[] = [
  { value: 'instant', label: 'As soon as found', hint: 'One email each time new matches show up' },
  { value: 'daily', label: 'Daily digest', hint: 'At most one email per day' },
  { value: 'weekly', label: 'Weekly digest', hint: 'At most one email per week' },
]

export function AlertSettingsCard({ email, frequency }: { email: string; frequency: Frequency }) {
  const [selected, setSelected] = useState<Frequency>(frequency)
  const [status, setStatus] = useState<ActionResult | null>(null)
  const [saving, startSaving] = useTransition()
  const [testing, startTesting] = useTransition()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Email alerts</CardTitle>
        <CardDescription className="leading-relaxed">Where and how often to send new-vehicle alerts.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={(formData) => startSaving(async () => setStatus(await saveAlertSettings(formData)))}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="alert-email">Send alerts to</Label>
            <Input id="alert-email" name="email" type="email" required defaultValue={email} autoComplete="email" />
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium">Frequency</legend>
            {OPTIONS.map((o) => (
              <label
                key={o.value}
                className={cn(
                  'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                  selected === o.value ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted',
                )}
              >
                <input
                  type="radio"
                  name="frequency"
                  value={o.value}
                  checked={selected === o.value}
                  onChange={() => setSelected(o.value)}
                  className="mt-1 accent-primary"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{o.label}</span>
                  <span className="text-xs leading-relaxed text-muted-foreground">{o.hint}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save settings'}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={testing}
              onClick={() => startTesting(async () => setStatus(await sendTestEmail()))}
            >
              {testing ? 'Sending...' : 'Send test email'}
            </Button>
          </div>
          <p aria-live="polite" className={cn('text-sm leading-relaxed', status?.ok === false ? 'text-destructive' : 'text-muted-foreground')}>
            {status ? (status.ok ? status.message : status.error) : null}
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
