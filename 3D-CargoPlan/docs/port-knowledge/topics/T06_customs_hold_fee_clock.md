<!-- #created 11/08/2026 -->
# T06_customs_hold_fee_clock · 海关查验 / Hold 与费用钟

> **Attention layer** · as_of **2026-10-31** (Asia/Shanghai) · product_use `faq_yellow` · confidence `medium`
> Not legal advice. Commercial fees ≠ administrative fines. Amounts require source URL + as_of. X evidence is heat/wording only.

**EN:** Customs hold / exam vs fee clocks

## Why attention

痛点高、结构化弱；近 7 天 customs×D&D 约 6，customs storage 约 10。官方无统一「谁停钟」。

```json
{
  "heat_7d": {
    "customs_hold_dd": 6,
    "customs_storage": 10
  }
}
```

## Definitions

- **Customs hold / exam**（海关查验/扣留）: Cargo held for inspection, docs, or security — dwell increases.
- **Exam fee**（查验相关费）: May include terminal handling to exam site, gov fees, demurrage/storage while waiting — parties vary by country.
- **Fee clock**（费用钟）: Demurrage/detention/storage timers that may keep running during hold unless tariff/waiver says otherwise.

## Who pays / responsible

- Pays: Often consignee/importer on destination exam; origin exam may hit shipper — Incoterms & local practice decide. Not a single global rule.
- Note: 
- Responsible: Customs authority
- Responsible: Broker/forwarder coordination
- Responsible: Carrier/terminal billing desks

## Common pitfalls

- Assuming hold auto-stops demurrage.
- Missing packing-list vs load-plan mismatch that triggers exam.
- No named contact path in Port Pack checklist.

## Official sources

- [FIATA](https://fiata.org/n/fiata-calls-for-reasonable-free-time-for-container/) — Argues free time should reflect periods merchant cannot act (principle, not universal law)
- [FIATA D&D guide](https://www.elea.ee/wp-content/uploads/2023/05/FIATA_Best-Practice-Guide-on-Demurrage-and-Detention_1810.pdf) — Negotiate extension when terminal cannot release

## Country hooks

- **US**: CBP exam + demurrage disputes well-known 
- **CN**: Customs exam + packing list align checklist 
- **ID**: Quarantine/customs interfaces at Priok 
- **NL**: EU customs at Rotterdam 

## Port hooks

- `USLAX` 
- `USNYC` 
- `CNSHA` 
- `NLRTM` 
- `IDTPP` 

## FAQ

### Q: 查验时 demurrage 停不停？

多数不自动停。能否减免看船司/码头条款、当地惯例与协商。Globe 标「待核实/合约」。

### Q: 产品能做什么？

Checklist：谁联系海关/船司/码头、证据留存、并行时钟提示——不是自动免单引擎。


## X evidence (heat only)

```json
{
  "sample_size_this_run": {
    "counts": 6
  },
  "samples": [
    {
      "url": "https://x.com/RecallAntonio/status/2021440019207213295",
      "kind": "promo-template",
      "note": "Mentions customs exam fees with D&D — down-rank template"
    }
  ],
  "honesty": "Sparse high-quality organic; prior 10_* used customs cluster more than this run's strict query."
}
```

## Gaps

- Per-port 'clock stop' rules not sourced
- No structured exam fee tables

---

*Encyclopedia mirror of `globe/data/topics/*.json`. Not legal advice.*
