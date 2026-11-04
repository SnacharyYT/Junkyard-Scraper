import type { Vehicle } from '@/lib/matching'

export type WatchItemView = {
  id: number
  make: string
  model: string
  yearMin: number | null
  yearMax: number | null
  notify: boolean
  label: string
  inYard: number
}

export type WatchedVehicle = Vehicle & { label: string }

export type MakeModels = Record<string, string[]>
