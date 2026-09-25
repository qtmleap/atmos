// Line colours of the comparison chart, c1..c10 of the mock's stylesheet
// (project-jobs-compare.html), in selection order.
export const RUN_COLORS: readonly string[] = [
  'oklch(0.55 0.2 260)',
  'oklch(0.65 0.2 35)',
  'oklch(0.6 0.13 165)',
  'oklch(0.55 0.22 330)',
  'oklch(0.45 0.02 260)',
  'oklch(0.72 0.15 85)',
  'oklch(0.6 0.12 220)',
  'oklch(0.5 0.15 140)',
  'oklch(0.62 0.19 5)',
  'oklch(0.5 0.17 295)',
]

export const runColor = (index: number): string => {
  const color = RUN_COLORS[index % RUN_COLORS.length]
  return color === undefined ? 'currentColor' : color
}
