// Per-worker cache for expensive shared test projects, each backed by one or
// more real CDP uploads. `createProjectCache()` returns a memoiser: the build
// for a given key runs at most once, and a rejected build is evicted so a
// transient upload failure can retry on the next caller. Callers supply their
// own build function — what a project needs uploaded (and harvested) varies per
// spec — while this owns the caching and eviction contract in one place.
//
// The cache is per-worker module state, so the spec must run in a single worker
// (via `test.describe.configure({ mode: 'default' })` or `'serial'`) for a key
// to build exactly once.
export function createProjectCache() {
  const cache = new Map()
  return function getOrBuild(key, build) {
    if (!cache.has(key)) {
      cache.set(
        key,
        Promise.resolve()
          .then(build)
          .catch((err) => {
            cache.delete(key)
            throw err
          })
      )
    }
    return cache.get(key)
  }
}
