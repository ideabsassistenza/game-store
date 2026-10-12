import { Link } from 'react-router-dom'

export function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-32 text-center">
      <p className="text-sm text-subtle">Error 404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight">This game isn’t in the library</h1>
      <p className="mt-3 text-muted">The link may be broken or the game was removed.</p>
      <Link
        to="/"
        data-nav
        data-autofocus
        className="mt-8 rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-accent-fg hover:bg-accent-hover"
      >
        Back to library
      </Link>
    </div>
  )
}
