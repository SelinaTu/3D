// #created 11/08/2026
/** Numbers the customer-value page is allowed to show. Each one is either measured in this repo or copied from a named public price or filing count. */
export const demoLoad = {
  pieces: 29,
  weightKg: 2738.09,
  stops: 3,
  landBlocksWhenOrderIgnored: 3,
  seaBlocksWhenOrderIgnored: 7,
  blocksWhenUnloadOrderKept: 0,
}

export const competitorSeat = {
  easyCargoAnnualUsd: 799,
  cubeMasterStandardMonthlyUsd: 49,
}

export const buyers = {
  /** 广州市商务局，截至 2024-12-31，备案法人。 */
  guangzhouLegalPersons: 4516,
  /** 中国货代协会《中国国际货代物流行业发展蓝皮书（2022）》，新华网 2023-11-18 报道。截至 2022 年底商务部备案系统中的法人企业。 */
  nationalLegalPersonsEnd2022: 77367,
}

export function annualSeatUsd(monthlyUsd: number) {
  return monthlyUsd * 12
}

/** One public seat price × one named filing count. This is an upper bound: every legal-person forwarder buys one seat. */
export function seatPoolUsd(companies: number, annualUsd: number) {
  return companies * annualUsd
}
