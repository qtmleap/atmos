// Which full-page error a failed resource load becomes (SPEC §0.3): a signed-out
// visitor on a members-only project (401), a signed-in member without access to
// someone's private project (403), or nothing there at all (404). Other
// failures stay inline so the page can offer a retry.

export type AccessErrorKind = 'signin' | 'forbidden' | 'not-found'

export type AccessErrorSubject = 'project' | 'job'

export const accessErrorKind = (status: number | null): AccessErrorKind | null => {
  switch (status) {
    case 401:
      return 'signin'
    case 403:
      return 'forbidden'
    case 404:
      return 'not-found'
    default:
      return null
  }
}

export interface AccessErrorText {
  code: string
  title: string
  /** One sentence under the title. */
  description: string
  /** Part of `description` that links to the project list (the not-found page). */
  linked?: string
}

const NOUN: Record<AccessErrorSubject, string> = { project: 'プロジェクト', job: 'ジョブ' }

/** Texts of designs/pages/signin-required.html, forbidden.html and not-found.html. */
export const accessErrorText = (
  kind: AccessErrorKind,
  subject: AccessErrorSubject,
): AccessErrorText => {
  switch (kind) {
    case 'signin':
      return {
        code: '401',
        title: 'ログインが必要です',
        description: 'このプロジェクトはメンバー限定です。',
      }
    case 'forbidden':
      return {
        code: '403',
        title: 'このプロジェクトを閲覧する権限がありません',
        description: '非公開のプロジェクトは、所有者と管理者だけが閲覧できます。',
      }
    case 'not-found':
      return {
        code: '404',
        title: `${NOUN[subject]}が見つかりません`,
        description: 'アドレスを確かめるか、プロジェクト一覧に戻ってください。',
        linked: 'プロジェクト一覧',
      }
  }
}

/** `text` cut around the first `part`: [before, part, after], or null when absent. */
export const splitAround = (
  text: string,
  part: string,
): readonly [string, string, string] | null => {
  const at = text.indexOf(part)
  return at < 0 ? null : [text.slice(0, at), part, text.slice(at + part.length)]
}
