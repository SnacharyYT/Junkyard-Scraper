import Link from 'next/link'
import { buttonVariants } from '@/components/ui/button'
import { SignOutButton } from '@/components/sign-out-button'

export function SiteHeader({ email, vehicleCount }: { email?: string; vehicleCount: number | null }) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">Junkyard Scraper</h1>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
          {vehicleCount !== null ? `${vehicleCount.toLocaleString()} vehicles` : 'Inventory'} at{' '}
          <a
            href="https://www.rgpick-a-part.com/inventory.php"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-4 hover:text-primary"
          >
            RG Pick-A-Part
          </a>
          , refreshed every 10 minutes
        </p>
      </div>
      {email ? (
        <div className="flex items-center gap-3">
          <span className="truncate text-sm text-muted-foreground">{email}</span>
          <SignOutButton />
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className={buttonVariants({ variant: 'outline' })}>
            Sign in
          </Link>
          <Link href="/sign-up" className={buttonVariants()}>
            Create account
          </Link>
        </div>
      )}
    </header>
  )
}
