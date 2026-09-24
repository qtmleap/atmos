// What a link may carry in the history state (`<Link state>`), typed for the
// whole app; TanStack Router's HistoryState is empty until augmented.
import type { ProjectLinkState } from './project-link'

declare module '@tanstack/react-router' {
  interface HistoryState extends Partial<ProjectLinkState> {}
}
