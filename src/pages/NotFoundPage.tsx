import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui'

export function NotFoundPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-surface-2 text-muted">
        <Compass size={26} />
      </div>
      <h1 className="mt-5 text-2xl font-semibold text-foreground">Page not found</h1>
      <p className="mt-1.5 max-w-sm text-sm text-muted">
        The page you’re looking for doesn’t exist or has been moved.
      </p>
      <Link to="/" className="mt-5">
        <Button>Back to overview</Button>
      </Link>
    </div>
  )
}
