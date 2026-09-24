import type { Visibility as VisibilityKind } from '@/shared/types'
import { VISIBILITY_LABELS } from '../../lib/format'
import { Badge } from '../ui/badge'
import { Visibility } from '../ui/status'

/**
 * Public or private as an outlined badge (the mock's `.badge.badge-outline.visibility`):
 * a globe or lock plus the label, or the label alone with `plain`.
 */
export function VisibilityBadge({
  visibility,
  plain = false,
}: {
  visibility: VisibilityKind
  plain?: boolean
}) {
  const label = VISIBILITY_LABELS[visibility]
  return (
    <Badge variant="outline">
      {plain ? (
        <span className="text-xs leading-4 text-muted-foreground">{label}</span>
      ) : (
        <Visibility isPublic={visibility === 'public'} className="leading-4">
          {label}
        </Visibility>
      )}
    </Badge>
  )
}
