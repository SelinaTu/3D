// #created 11/08/2026
import raw from './shipping-cards.json'
import { safeSource } from '../knowledge/globe/model'

type ShippingHit = { title: string; text: string; scope: string; sources: { url: string; title: string }[] }

type ShippingPlace = { id: string; names: string[]; locodes: string[] }
type ShippingCard = {
  id: string
  title: string
  text: string
  locator: string
  url: string
  places: ShippingPlace[]
  amount: boolean
  wide: boolean
  evidence?: {source_id:string;sha256:string;page:number|null;locator?:string;status?:string;automatic_decision_allowed:false}
}

const cards = raw as ShippingCard[]
const skip = new Set(['怎么', '如何', '什么', '是否', '可以', '我们', '这个', '请问', '一下', '知道', '办理', '处理', '多少', '几天', '哪些', '有没有'])

function score(query: string, card: ShippingCard) {
  const hay = `${card.title} ${card.text}`.toLowerCase()
  let total = 0
  const seen = new Set<string>()
  for (let size = 8; size >= 2; size--) {
    for (let index = 0; index + size <= query.length; index++) {
      const gram = query.slice(index, index + size)
      if (seen.has(gram) || skip.has(gram) || /^[\s\d？?，,。、·]+$/.test(gram)) continue
      if (!hay.includes(gram)) continue
      seen.add(gram)
      total += size >= 4 ? size * size : 3
    }
  }
  return total
}

function namedPortIds(query: string) {
  const ids = new Set<string>()
  for (const card of cards) {
    for (const place of card.places) {
      if (place.names.some(name => query.includes(name.toLowerCase()))) ids.add(place.id)
    }
  }
  return ids
}

function scopeKey(card: ShippingCard) {
  if (!card.places.length) return '*'
  if (card.wide) return 'CN'
  return card.places.map(place => place.id).sort().join('+')
}

function scopeLabel(card: ShippingCard) {
  if (!card.places.length) return '国际规则，非单一港口'
  if (card.wide) return '中国口岸规则，非单一码头'
  const names = card.places.flatMap(place => place.names)
  return names.find(name => /[\u4e00-\u9fff]/.test(name)) ?? names[0] ?? card.places.map(place => place.id).join('/')
}

function toAnswer(card: ShippingCard, named: boolean): ShippingHit {
  const limit = !named && card.places.length && !card.wide ? `这条只适用于${scopeLabel(card)}，不能套到其他港口。\n` : ''
  const money = card.amount ? '\n原文含单价或罚额。这里不抄数字，也不能当作本票报价或罚单。' : ''
  return {
    title: card.title,
    text: `${limit}${card.text}${money}\n出处：${card.locator}${card.evidence ? `\n证据源 ${card.evidence.source_id} · SHA-256 ${card.evidence.sha256} · ${card.evidence.page ? `第 ${card.evidence.page} 页` : "页码未提供"}；来源文件指纹已核对，适用性仍待复核。` : "\n证据指纹待核实。"}`,
    scope: `${scopeLabel(card)} · ${card.id} · 条件参考，不自动裁决`,
    sources: card.url && safeSource(card.url) ? [{ url: card.url, title: card.locator || card.id }] : []
  }
}

export function queryNamesPort(query: string) {
  return namedPortIds(query.toLowerCase()).size > 0
}

export function searchShippingCards(query: string, portCode?: string): ShippingHit | null {
  const q = query.toLowerCase()
  const named = namedPortIds(q)
  const ranked = cards
    .filter(card => {
      if (named.size) return !card.places.length || card.places.some(place => named.has(place.id))
      if (portCode) return !card.places.length || card.places.some(place => place.locodes.includes(portCode))
      return true
    })
    .map(card => ({ card, score: score(q, card) }))
    .filter(item => item.score >= 8)
    .sort((a, b) => b.score - a.score || a.card.id.localeCompare(b.card.id))
  const best = ranked[0]
  if (!best) return null
  const band = ranked.filter(item => item.score >= 8 && item.score >= best.score - 6)
  const scopes = [...new Set(band.map(item => scopeKey(item.card)))]
  if (!named.size && !portCode && scopes.length > 1) {
    const picked: ShippingCard[] = []
    for (const key of scopes) {
      const hit = band.find(item => scopeKey(item.card) === key)
      if (hit && picked.length < 4) picked.push(hit.card)
    }
    return {
      title: '多个范围都有规定，需要指定港口',
      text: picked.map(card => `${scopeLabel(card)}：${card.title}`).join('\n'),
      scope: '未指定港口 · 不能把一港的规则套到另一港',
      sources: []
    }
  }
  return toAnswer(best.card, named.size > 0 || Boolean(portCode))
}
