export async function setupProject(
  createProjectFlow,
  projectDashboardPage,
  label
) {
  const name = `${label} ${Date.now()}`
  await createProjectFlow.createProject(name)
  const href = await projectDashboardPage.projectLink(name).getAttribute('href')
  const id = href.split('/').pop()
  return { id, name }
}
