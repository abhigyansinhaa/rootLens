export type Controllability = 'controllable' | 'partial' | 'observational'

const observational = /tenure|seniority|age|zip|postcode|latitude|longitude|customer[_\s]?id|^id$/i
const partial = /partner|region|gender|marital|dependents|paperless/i
const controllable = /contract|monthly|charges|payment|paperless|service|internet|phone|support|addon|plan|price|discount|offer/i

export function controllabilityForFeature(featureName: string): Controllability {
  const s = featureName.toLowerCase()
  if (observational.test(s)) return 'observational'
  if (controllable.test(s)) return 'controllable'
  if (partial.test(s)) return 'partial'
  return 'partial'
}

export function categoryForDriver(featureName: string): string {
  const s = featureName.toLowerCase()
  if (/charge|bill|payment|monthly|total|balance|fee/.test(s)) return 'Billing'
  if (/internet|phone|streaming|service|fiber|dsl|online/.test(s)) return 'Product'
  if (/contract|commitment|term/.test(s)) return 'Contract'
  if (/ticket|support|complaint|tech/.test(s)) return 'Support'
  if (/tenure|seniority|gender|partner|dependents|citizen/.test(s)) return 'Demographics'
  return 'Other'
}

export function controllabilityBadgeLabel(c: Controllability): string {
  if (c === 'controllable') return 'Controllable'
  if (c === 'partial') return 'Partially controllable'
  return 'Observational only'
}
