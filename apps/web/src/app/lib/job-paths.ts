/** `/api/projects/:project_id/jobs/:job_id` plus an optional sub-path such as `/metrics`. */
export const jobApiPath = (projectId: string, jobId: string, suffix = ''): string =>
  `/api/projects/${encodeURIComponent(projectId)}/jobs/${encodeURIComponent(jobId)}${suffix}`
