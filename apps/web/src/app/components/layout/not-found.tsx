import { Link } from '@tanstack/react-router'
import { useIntlayer } from 'react-intlayer'

export default function NotFound() {
  const content = useIntlayer('not-found')
  return (
    <div className="px-4 py-16 sm:px-6">
      <h1 className="text-lg font-semibold">{content.title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {content.before}
        <Link to="/" className="underline underline-offset-4">
          {content.link}
        </Link>
        {content.after}
      </p>
    </div>
  )
}
