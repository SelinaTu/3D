// #created 11/08/2026
import snapshot from '../../../globe/data/regional-policies.json'
import type { GlobeData, Port, Review } from './model'

export type RegionalPolicy = typeof snapshot.rules[number]
export const regionalPolicies: RegionalPolicy[] = snapshot.rules

/** Explicit port scopes take precedence over country inheritance. */
export function appliesToPort(rule: {ports?: string[]; countries?: string[]}, port: Pick<Port, 'locode' | 'country'>): boolean {
  return rule.ports?.length ? rule.ports.includes(port.locode) : !!rule.countries?.includes(port.country)
}
export function policiesFor(port: Pick<Port, 'locode' | 'country'>): RegionalPolicy[] {
  return regionalPolicies.filter(rule => appliesToPort(rule, port))
}
export function localReviews(data: GlobeData, port: Port): [string, Review][] {
  return Object.entries(data.reviews).filter(([, rule]) => rule.ports?.includes(port.locode))
}
