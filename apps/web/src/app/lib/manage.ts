// Pure parts of editing and deleting a project or a job from its heading:
// who may, the form checks, and the wording of the delete confirmations.
import { z } from 'zod'
import type { Role, UpdateJobRequest, UpdateProjectRequest, Visibility } from '@/shared/types'

/**
 * The owner or an admin, as canManageProject (src/api/lib/auth.ts) decides on
 * the server; the menu is hidden from everyone else.
 */
export const canManage = (
  user: { id: string; role: Role } | null,
  ownerId: string | undefined,
): boolean => user !== null && (user.role === 'admin' || user.id === ownerId)

export interface EditProjectFormInput {
  name: string
  visibility: Visibility
}

export type FormValidation<T> = { success: true; data: T } | { success: false; message: string }

const firstIssue = (error: z.ZodError): string => {
  const [issue] = error.issues
  return issue === undefined ? '入力内容を確認してください' : issue.message
}

const projectNameSchema = z.string().trim().nonempty('プロジェクト名を入力してください')
const jobNameSchema = z.string().trim().nonempty('ジョブ名を入力してください')

export const validateEditProjectForm = (
  input: EditProjectFormInput,
): FormValidation<UpdateProjectRequest> => {
  const result = projectNameSchema.safeParse(input.name)
  return result.success
    ? { success: true, data: { name: result.data, visibility: input.visibility } }
    : { success: false, message: firstIssue(result.error) }
}

export const validateRenameJobForm = (name: string): FormValidation<UpdateJobRequest> => {
  const result = jobNameSchema.safeParse(name)
  return result.success
    ? { success: true, data: { name: result.data } }
    : { success: false, message: firstIssue(result.error) }
}

/** The name has to be typed exactly before a project can be deleted. */
export const deleteConfirmed = (typed: string, name: string): boolean => typed === name

/** "… と、その中のジョブ 12 件の…"; the count is left out while the API does not send it. */
export const projectDeleteDescription = (name: string, jobCount: number | undefined): string =>
  `${name} と、その中のジョブ${jobCount === undefined ? '' : ` ${jobCount} 件`}のメトリクス・ログ・メディアをすべて削除します。元に戻せません。`

export const jobDeleteDescription = (name: string): string =>
  `${name} のメトリクス・ログ・メディアをすべて削除します。元に戻せません。`
