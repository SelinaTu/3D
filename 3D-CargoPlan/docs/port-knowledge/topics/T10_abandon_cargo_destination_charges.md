<!-- #created 11/08/2026 -->
# T10_abandon_cargo_destination_charges · 弃货 / 目的港费用回追

> **Attention layer** · as_of **2026-10-31** (Asia/Shanghai) · product_use `faq_yellow` · confidence `medium_experience_not_statute`
> Not legal advice. Commercial fees ≠ administrative fines. Amounts require source URL + as_of. X evidence is heat/wording only.

**EN:** Abandoned cargo · destination charges chase-back

## Why attention

出口商痛点；近 7 天 abandon 宽查询约 56（含噪声）。经验帖：目的港无人提→堆存/滞箱回追发货人。非法条价目。

```json
{
  "heat_7d": {
    "abandon": 56
  }
}
```

## Definitions

- **Abandoned cargo**（弃货）: Consignee fails to take delivery; cargo sits accruing storage/D&D; may be auctioned/destroyed under local rules.
- **Destination charges**（目的港费用）: THC, storage, demurrage, customs, disposal — who ultimately pays depends on contract & local recovery practice.
- **Chase-back**（回追）: Industry practice of billing origin shipper/forwarder when destination party disappears — contractual, not a universal statute.

## Who pays / responsible

- Pays: Often shipper/forwarder at origin gets chased when consignee abandons — verify BL terms & local law; experience yellow light.
- Note: 
- Responsible: Consignee for delivery
- Responsible: Shipper credit control / release strategy
- Responsible: Carrier recovery teams

## Common pitfalls

- Telex release without payment security
- Verbal '包过' promises
- Ignoring escalating storage while negotiating

## Official sources

- [FIATA](https://fiata.org/n/fiata-calls-for-reasonable-free-time-for-container/) — D&D context when cargo cannot move — still commercial
- [UNCTAD](https://unctad.org/news/demurrage-and-detention-charges-container-shipping) — Industry D&D cost pressure context

## Country hooks

- **CN**: ZH experience posts on chase-back 
- **US**: Longstanding / auction regimes vary by terminal 
- **ID**: Destination dwell + ODOL delays 

## Port hooks

- `USLAX` 
- `USNYC` 
- `CNSHA` 
- `IDTPP` 

## FAQ

### Q: 买家不提货，费用谁扛？

实务上常回追发货人/订舱货代，但取决于运输合同、提单条款与当地处置规则。属经验黄灯，不是单一法典条文。

### Q: 产品建议？

收款/放单节点、信用管控文案；监控目的港费用钟——不做罚单计算。


## X evidence (heat only)

```json
{
  "sample_size_this_run": {
    "counts": 56,
    "archive_zh": 16
  },
  "samples": [
    {
      "url": "https://x.com/APBLOODTYPE/status/2107425676563464254",
      "kind": "organic",
      "note": "Prior corpus: destination fee chase (v1.1)"
    },
    {
      "url": "https://x.com/Vita1945598/status/1847111378789957648",
      "kind": "edu",
      "note": "LCL destination charges education"
    }
  ],
  "honesty": "This-run ZH abandon query was noisy (promo/macro); keep prior organic URL."
}
```

## Gaps

- Per-country abandonment statutory procedures not compiled

---

*Encyclopedia mirror of `globe/data/topics/*.json`. Not legal advice.*
