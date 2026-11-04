export type Vehicle = {
  year: string
  make: string
  model: string
  stock: string
  row: string
}

export type WatchCriteria = {
  make: string
  model: string
  yearMin: number | null
  yearMax: number | null
}

export function matchesWatch(vehicle: Vehicle, watch: WatchCriteria) {
  if (vehicle.make.toUpperCase() !== watch.make.toUpperCase()) return false
  if (watch.model && !vehicle.model.toUpperCase().includes(watch.model.toUpperCase())) return false
  const year = Number.parseInt(vehicle.year, 10)
  if (!Number.isNaN(year)) {
    if (watch.yearMin && year < watch.yearMin) return false
    if (watch.yearMax && year > watch.yearMax) return false
  }
  return true
}

export function watchLabel(watch: WatchCriteria) {
  const base = `${watch.make} ${watch.model}`.trim()
  if (!watch.yearMin && !watch.yearMax) return base
  if (watch.yearMin && watch.yearMax) return `${base} ${watch.yearMin}–${watch.yearMax}`
  return watch.yearMin ? `${base} ${watch.yearMin}+` : `${base} up to ${watch.yearMax}`
}
