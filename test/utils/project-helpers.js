// BMD-1043 (frontend PR#352): the dashboard row links to
// /projects/{id}/project-summary, so the id is no longer the last path segment.
const PROJECT_ID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

export function projectIdFromHref(href) {
  const match = href?.match(PROJECT_ID_RE)
  if (!match) {
    throw new Error(`No project id in href: ${href}`)
  }
  return match[0]
}

export async function setupProject(
  createProjectFlow,
  projectDashboardPage,
  label
) {
  const name = `${label} ${Date.now()}`
  await createProjectFlow.createProject(name)
  const href = await projectDashboardPage.projectLink(name).getAttribute('href')
  const id = projectIdFromHref(href)
  return { id, name }
}
