<!-- #created 11/08/2026 -->
# T04_rolled_blank_sailing · 甩柜 / Rolled · 空班 Blank sailing

> **Attention layer** · as_of **2026-10-31** (Asia/Shanghai) · product_use `faq_yellow` · confidence `medium_definition_low_ticket_evidence`
> Not legal advice. Commercial fees ≠ administrative fines. Amounts require source URL + as_of. X evidence is heat/wording only.

**EN:** Rolled cargo / shut-out · Blank sailing

## Why attention

定义教育稳定；严口径 rolled 近周冷，宽词易被体育污染。Blank sailing 近 7 天约 24，常绑运价。

```json
{
  "heat_7d": {
    "rolled_shutout": 19,
    "blank_sailing": 24,
    "zh_shuai": 2
  }
}
```

## Definitions

- **Rolled cargo**（甩柜/甩货）: Cargo booked but not loaded on the intended vessel (overbooking, docs, operational, weight, VGM late, etc.).
- **Shut-out**（关舱未上）: Often used similarly to rolled when cargo misses cutoff / not accepted for that sailing.
- **Blank sailing / void sailing**（空班/取消班期）: Carrier cancels a scheduled sailing or omits ports — capacity management or disruption.
- **Port omission**（跳港）: Vessel skips a port in rotation — cargo may roll or transship.

## Who pays / responsible

- Pays: Rebooking, storage, demurrage after roll often land on merchant depending on reason & contract; blank sailing is carrier schedule tool — liability case-by-case.
- Note: 
- Responsible: Carrier space control
- Responsible: Shipper docs/VGM/cutoff readiness
- Responsible: Forwarder booking protection practices

## Common pitfalls

- Assuming AIS 'vessel sailed' means YOUR container is aboard — verify container tracking.
- Wide Chinese '甩货' search polluted by sports metaphors — use strict queries.
- Ignoring demurrage clock after roll while box sits at origin terminal.

## Official sources

- [IMO](https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx) — Late/missing VGM is a common operational cause of not loading
- [FIATA](https://fiata.org/n/fiata-calls-for-reasonable-free-time-for-container/) — Export demurrage free time vs vessel delay — related negotiation theme

## Country hooks

- **CN**: Export roll narratives at SHA/NGB peaks 
- **US**: Import roll rare; blank sailing affects ETA 
- **ID**: Feeder rolls to Priok common in industry talk — verify per booking 

## Port hooks

- `CNSHA` 
- `CNNGB` 
- `CNSZX` 
- `SGSIN` 
- `NLRTM` 
- `USLAX` 

## FAQ

### Q: 船开了柜一定在船上吗？

不一定。Rolled cargo 就是订了舱但未装上原定船。应用箱号跟踪核验，不要只看船名 AIS。

### Q: Blank sailing 违法吗？

一般是船司运力管理/市场工具，不是「违法罚则」。影响是船期与舱位，可能连带费用钟。

### Q: 被甩后会不会产生滞期？

柜若仍在起运港码头超过 free time，可能产生 export demurrage/堆存——取决于条款与责任归属。


## X evidence (heat only)

```json
{
  "sample_size_this_run": {
    "archive_rolled": 20,
    "archive_blank": 16
  },
  "samples": [
    {
      "url": "https://x.com/GuoDavid/status/2114916498036732410",
      "kind": "organic",
      "note": "Ship left ≠ container on it"
    },
    {
      "url": "https://x.com/integralcargo/status/1750134016835993995",
      "kind": "promo/edu",
      "note": "What is rolled cargo"
    },
    {
      "url": "https://x.com/djnel15/status/1486922491461345284",
      "kind": "organic",
      "note": "Overbook bump experience"
    },
    {
      "url": "https://x.com/tatin17/status/1966417125674725631",
      "kind": "organic",
      "note": "SCFI + blank sailings"
    },
    {
      "url": "https://x.com/flexport/status/1819053919277818119",
      "kind": "corp",
      "note": "Blank sailings with SCFI"
    }
  ]
}
```

## Gaps

- No predictive space model
- Carrier liability clauses not digitized

---

*Encyclopedia mirror of `globe/data/topics/*.json`. Not legal advice.*
