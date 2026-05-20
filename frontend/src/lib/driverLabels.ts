/** Presentation labels for encoded model features (mirrors backend driver_labels.py). */

function normalizeKey(value: string): string {
  const s = value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/[\s\-\.]+/g, '_')
  return s.toLowerCase().replace(/^_+|_+$/g, '')
}

function compactKey(value: string): string {
  return normalizeKey(value).replace(/_/g, '')
}

function titleText(value: string): string {
  const capSegment = (segment: string) => {
    if (segment.includes('-')) {
      const parts = segment.split('-').filter(Boolean)
      if (parts.length >= 2) {
        const head = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase()
        const tail = parts.slice(1).map((p) => p.toLowerCase()).join('-')
        return `${head}-${tail}`
      }
    }
    return segment ? segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase() : segment
  }
  const parts = normalizeKey(value).split('_').filter(Boolean)
  return parts.map(capSegment).join(' ')
}

function longestPrefixColumn(
  fname: string,
  rawCols: string[],
): { base: string | null; level: string | null } {
  for (const col of rawCols) {
    const cs = String(col)
    if (fname === cs) return { base: cs, level: null }
    const pref = `${cs}_`
    if (fname.startsWith(pref)) return { base: cs, level: fname.slice(cs.length + 1) || null }
  }

  const fnC = compactKey(fname)
  let bestCol: string | null = null
  let bestLen = -1
  for (const col of rawCols) {
    const cn = compactKey(col)
    if (!cn) continue
    if (fnC === cn) return { base: String(col), level: null }
    if (fnC.startsWith(cn) && cn.length > bestLen) {
      bestCol = String(col)
      bestLen = cn.length
    }
  }
  if (!bestCol) return { base: null, level: null }

  const bc = compactKey(bestCol)
  if (fnC === bc) return { base: bestCol, level: null }

  const suffixC = fnC.slice(bc.length)
  if (suffixC) {
    let levelFromCompact = suffixC
    if (normalizeKey(fname).includes('_')) {
      const tailParts = normalizeKey(fname)
        .split('_')
        .slice(normalizeKey(bestCol).split('_').filter(Boolean).length)
      if (tailParts.length) levelFromCompact = tailParts.join('_')
    }
    return { base: bestCol, level: levelFromCompact }
  }

  const colParts = normalizeKey(bestCol).split('_').filter(Boolean)
  const fnParts = normalizeKey(fname).split('_').filter(Boolean)
  if (fnParts.length > colParts.length && colParts.every((p, i) => fnParts[i] === p)) {
    return { base: bestCol, level: fnParts.slice(colParts.length).join('_') || null }
  }
  if (fname.toLowerCase().startsWith(bestCol.toLowerCase())) {
    return { base: bestCol, level: fname.slice(bestCol.length).replace(/^_+/, '') || null }
  }
  return { base: bestCol, level: null }
}

function levelDisplay(level: string): string {
  const capSegment = (segment: string) => {
    if (segment.includes('-')) {
      const parts = segment.split('-').filter(Boolean)
      if (parts.length >= 2) {
        const head = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase()
        const tail = parts.slice(1).map((p) => p.toLowerCase()).join('-')
        return `${head}-${tail}`
      }
    }
    return segment ? segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase() : segment
  }
  if (level.includes('-') && !level.trim().includes(' ')) {
    const parts = level.split('-').filter(Boolean)
    if (!parts.length) return level
    const head = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase()
    if (parts.length === 1) return head
    return head + '-' + parts.slice(1).map((p) => p.toLowerCase()).join('-')
  }
  const parts = level.replace(/\./g, ' ').split(/[\s_]+/).filter(Boolean)
  if (parts.length > 1) {
    const titled = parts.map(capSegment).join(' ')
    const split = titled.split(' ')
    return split[0] + ' ' + split.slice(1).map((p) => p.toLowerCase()).join(' ')
  }
  return parts.length ? capSegment(parts[0]) : level
}

function humanizeLevel(base: string, level: string): string {
  const baseT = titleText(base)
  const levelT = levelDisplay(level)
  const bl = base.toLowerCase()
  const ll = level.toLowerCase()

  if (ll === 'no' || ll === 'yes') {
    if (ll === 'no') {
      if (bl.includes('security')) return 'Customers Without Online Security'
      if (bl.includes('support') || bl.includes('tech')) return 'Customers Without Tech Support'
      return `Customers Without ${baseT}`
    }
    if (bl.includes('security')) return 'Customers With Online Security'
    if (bl.includes('support') || bl.includes('tech')) return 'Customers With Tech Support'
    return `Customers With ${baseT}`
  }

  if (bl.includes('contract')) return `${levelT} contracts`
  if (bl.includes('internet') && bl.includes('service')) return `${levelT} internet customers`
  if (bl.includes('payment') && bl.includes('method')) return `${titleText(level.replace(/_/g, ' '))} Payment Users`
  if (bl.includes('service')) return `${levelT} ${baseT} customers`
  return `${levelT} (${baseT})`
}

export function formatDriverLabel(feature: string, rawColumns?: string[] | null): string {
  const fname = String(feature)
  const cols = (rawColumns ?? []).map(String).filter(Boolean)
  if (cols.length) {
    if (cols.includes(fname)) return titleText(fname)
    const { base, level } = longestPrefixColumn(fname, cols)
    if (base && level) return humanizeLevel(base, level)
    if (base) return titleText(base)
  }

  const normParts = normalizeKey(fname).split('_').filter(Boolean)
  if (normParts.length >= 2) {
    return humanizeLevel(normParts[0], normParts.slice(1).join('_'))
  }
  return titleText(fname)
}

export function directionForFeature(
  feature: string,
  directionByFeature?: Record<string, string>,
): string | undefined {
  if (!directionByFeature) return undefined
  if (directionByFeature[feature]) return directionByFeature[feature]
  let best = ''
  let dir: string | undefined
  for (const [key, value] of Object.entries(directionByFeature)) {
    if (feature.startsWith(`${key}_`) && key.length > best.length) {
      best = key
      dir = value
    }
  }
  return dir
}

export function humanizeTargetLabel(target: string): string {
  const raw = String(target).trim().toLowerCase().replace(/churned/g, 'churn')
  if (raw === 'churn' || raw === 'churned') return 'churn'
  const titled = titleText(raw)
  return titled.length > 1 ? titled.charAt(0).toLowerCase() + titled.slice(1) : titled.toLowerCase()
}
