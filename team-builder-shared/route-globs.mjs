// route-globs.mjs — the routing path vocabulary and exact glob reasoning.
//
// Both the validator and the generator have to agree on what a routing path
// covers, so the rules live here once. Deliberately no CLI and no side
// effects: validate-manifest.mjs runs a selftest from its module body, so it
// cannot be imported statically by the generator.
//
// A routing path is a `/`-separated list of segments. A segment is a literal,
// `*` (exactly one segment), or `**` (any number of segments, including none).
// Partial-segment wildcards (`a*`, `*.md`) are deliberately excluded: they make
// containment undecidable by inspection and let two routes overlap with neither
// containing the other, which leaves ownership with no most-specific winner.

const LIT = 'lit'
const STAR = 'star'
const GLOBSTAR = 'globstar'

// Problems with a path's shape, as human-readable reasons. Empty means valid.
export function routePathProblems(path) {
  if (typeof path !== 'string' || path === '') return ['dolu bir string olmalı']
  const segs = path.split('/')
  const problems = []
  // A leading or trailing slash produces an empty segment too, so this one
  // check covers `/docs/**`, `docs/` and `docs//x/**` alike.
  if (segs.some(seg => seg === '')) {
    problems.push('boş segment — başta, sonda ya da arada fazladan `/`')
  }
  if (segs.some(seg => seg === '.' || seg === '..')) {
    problems.push('`.` ya da `..` segmenti — yollar proje kökünden yazılır')
  }
  if (segs.some(seg => seg.includes('*') && seg !== '*' && seg !== '**')) {
    problems.push(
      'segment içinde kısmi joker (`a*`, `*.md`) — bir segment ya düz metin, ya `*`, ya `**` olmalı'
    )
  }
  for (let i = 0; i + 1 < segs.length; i++) {
    if (segs[i] === '**' && segs[i + 1] === '**') {
      problems.push('ardışık `**`')
      break
    }
  }
  return problems
}

// Tokens for a path. A path with no wildcard names a directory and governs
// what sits under it, so it is read as `<path>/**`.
export function routeTokens(path) {
  const segs = path.split('/').filter(seg => seg !== '')
  const tokens = segs.map(seg =>
    seg === '**' ? { type: GLOBSTAR } : seg === '*' ? { type: STAR } : { type: LIT, value: seg }
  )
  if (!tokens.some(t => t.type === GLOBSTAR || t.type === STAR)) {
    tokens.push({ type: GLOBSTAR })
  }
  return tokens
}

// Does `outer` match every path `inner` matches?
export function routeContains(outer, inner) {
  const O = routeTokens(outer)
  const I = routeTokens(inner)
  const memo = new Map()
  const go = (i, j) => {
    const key = i * (I.length + 1) + j
    if (memo.has(key)) return memo.get(key)
    let result
    if (i === O.length) {
      result = j === I.length
    } else if (O[i].type === GLOBSTAR) {
      // Absorb zero or more of inner's segments, whatever they are.
      result = go(i + 1, j) || (j < I.length && go(i, j + 1))
    } else if (j === I.length) {
      result = false
    } else if (I[j].type === GLOBSTAR) {
      // Inner can expand to several segments here; a single outer token
      // cannot cover them all.
      result = false
    } else if (O[i].type === STAR) {
      result = go(i + 1, j + 1)
    } else {
      result = I[j].type === LIT && I[j].value === O[i].value && go(i + 1, j + 1)
    }
    memo.set(key, result)
    return result
  }
  return go(0, 0)
}

// Is there any path both routes match?
export function routesOverlap(a, b) {
  const A = routeTokens(a)
  const B = routeTokens(b)
  const memo = new Map()
  const go = (i, j) => {
    const key = i * (B.length + 1) + j
    if (memo.has(key)) return memo.get(key)
    let result
    if (i === A.length && j === B.length) {
      result = true
    } else if (i < A.length && A[i].type === GLOBSTAR) {
      result = go(i + 1, j) || (j < B.length && go(i, j + 1))
    } else if (j < B.length && B[j].type === GLOBSTAR) {
      result = go(i, j + 1) || (i < A.length && go(i + 1, j))
    } else if (i === A.length || j === B.length) {
      result = false
    } else {
      const compatible =
        A[i].type === STAR || B[j].type === STAR || A[i].value === B[j].value
      result = compatible && go(i + 1, j + 1)
    }
    memo.set(key, result)
    return result
  }
  return go(0, 0)
}
