// Members: GET /api/users (designs/pages/users.html), GET /api/users/:handle
// and GET /api/users/:handle/projects (designs/pages/user-profile.html).
import type { Project, User } from '../../src/shared/types'
import { ME } from './me'
import { type FixtureHandler, json, notFound, paginate } from './respond'

const member = (handle: string, displayName: string, createdAt: string): User => ({
  id: `usr_${handle}`,
  handle,
  display_name: displayName,
  avatar_url: null,
  role: 'user',
  created_at: createdAt,
})

const { cf_access_email: _email, ...meAsUser } = ME

/** The ten rows of users.html, in its order. */
const LISTED: readonly User[] = [
  meAsUser,
  member('yuto_s', '佐藤 悠斗', '2026-08-02T09:00:00Z'),
  member('aoi_ml', '鈴木 葵', '2026-08-03T09:00:00Z'),
  member('ren_t', '高橋 蓮', '2026-08-04T09:00:00Z'),
  member('rin_ito', '伊藤 凛', '2026-08-05T09:00:00Z'),
  member('haruto_w', '渡辺 陽翔', '2026-08-06T09:00:00Z'),
  member('sakura_y', '山本 桜', '2026-08-07T09:00:00Z'),
  member('minato_n', '中村 湊', '2026-08-08T09:00:00Z'),
  member('yui_k', '小林 結衣', '2026-08-09T09:00:00Z'),
  member('sota_kato', '加藤 颯太', '2026-08-10T09:00:00Z'),
]

/** Past the first page ("続きあり"); not drawn in any mock. */
const MORE: readonly User[] = [
  member('yamato_y', '吉田 大和', '2026-08-11T09:00:00Z'),
  member('mei_yamada', '山田 芽依', '2026-08-12T09:00:00Z'),
  member('ao_sasaki', '佐々木 蒼', '2026-08-13T09:00:00Z'),
  member('himari_y', '山口 陽葵', '2026-08-14T09:00:00Z'),
  member('hiroto_m', '松本 大翔', '2026-08-15T09:00:00Z'),
  member('tsumugi_i', '井上 紬', '2026-08-16T09:00:00Z'),
]

export const MEMBERS: readonly User[] = [...LISTED, ...MORE]

export const findMember = (handle: string): User | undefined =>
  MEMBERS.find((user) => user.handle === handle)

/** `Project.owner` for a member handle; throws on a typo in the fixtures. */
export const ownerOf = (handle: string): Project['owner'] => {
  const user = findMember(handle)
  if (user === undefined) {
    throw new Error(`fixture owner @${handle} is not a member`)
  }
  return { id: user.id, handle: user.handle, display_name: user.display_name }
}

const owned = (id: string, name: string, visibility: Project['visibility'], date: string) => ({
  id,
  name,
  visibility,
  owner: ownerOf(ME.handle),
  created_at: `${date}T09:00:00Z`,
})

/** The five rows of user-profile.html ("すべて表示しました": no next page). */
const PROFILE_PROJECTS: Readonly<Record<string, readonly Project[]>> = {
  [ME.handle]: [
    owned('prj_tts_ja_model', '音声合成 / 日本語モデル', 'private', '2026-09-18'),
    owned('prj_image_cls_baseline', '画像分類 / ベースライン比較', 'public', '2026-09-12'),
    owned('prj_lm_ja_finetune', '言語モデル / 日本語ファインチューニング', 'private', '2026-09-08'),
    owned('prj_asr_speaker_adapt', '音声認識 / 話者適応', 'public', '2026-08-26'),
    owned('prj_embedding_eval', '埋め込みモデル / 検索精度評価', 'private', '2026-08-10'),
  ],
}

export const listUsers: FixtureHandler = ({ url }) => json(paginate(MEMBERS, url, LISTED.length))

export const getUser: FixtureHandler = ({ params }) => {
  const user = findMember(String(params.handle))
  return user === undefined ? notFound(`user @${params.handle}`) : json(user)
}

export const listUserProjects: FixtureHandler = ({ params, url }) => {
  const handle = String(params.handle)
  if (findMember(handle) === undefined) {
    return notFound(`user @${handle}`)
  }
  const projects = PROFILE_PROJECTS[handle]
  return json(paginate(projects === undefined ? [] : projects, url))
}

/** No member has an avatar image in the mocks; the UI falls back to the initial. */
export const getUserAvatar: FixtureHandler = ({ params }) => notFound(`avatar of @${params.handle}`)
