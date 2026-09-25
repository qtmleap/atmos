// The line under a project list that says which visibilities it holds
// (SPEC §0.3): signed-out visitors see public projects only, members also see
// members-only ones, and private ones show to their owner (and admins).

export const PUBLIC_ONLY_NOTE = '公開プロジェクトのみ表示しています。'

/** Footnote of the project list at `/`. */
export const homeListNote = (signedIn: boolean): string =>
  signedIn
    ? 'ログイン中のため、公開・メンバー限定のプロジェクトに加え、閲覧できる非公開のプロジェクトも表示しています。'
    : PUBLIC_ONLY_NOTE

export type ProfileViewer = 'self' | 'member' | 'signed-out'

export const profileViewer = (signedIn: boolean, isOwnProfile: boolean): ProfileViewer => {
  if (!signedIn) {
    return 'signed-out'
  }
  return isOwnProfile ? 'self' : 'member'
}

/** Footnote of the owned-project list at `/users/:handle`. */
export const profileListNote = (viewer: ProfileViewer): string => {
  switch (viewer) {
    case 'self':
      return 'ログイン中のため、公開・メンバー限定・非公開のすべてのプロジェクトを表示しています。'
    case 'member':
      return '公開・メンバー限定のプロジェクトを表示しています。'
    case 'signed-out':
      return PUBLIC_ONLY_NOTE
  }
}
