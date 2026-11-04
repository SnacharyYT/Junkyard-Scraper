import { cn } from '@/lib/utils'

export function RowTag({ row, className }: { row: string; className?: string }) {
  const assigned = row.trim() !== ''
  return (
    <span
      className={cn(
        'inline-flex min-w-16 shrink-0 items-center justify-center gap-1 rounded-sm px-2 py-1 font-mono text-xs font-bold uppercase tracking-wider',
        assigned ? 'bg-primary text-primary-foreground' : 'border border-dashed border-input text-muted-foreground',
        className,
      )}
    >
      {assigned ? (
        <>
          <span className="font-normal opacity-70">Row</span>
          {row}
        </>
      ) : (
        'No row'
      )}
    </span>
  )
}
