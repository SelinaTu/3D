<!-- #created 11/08/2026 -->
# T05_freight_rates_geopolitics · 运价与地缘（市场黄灯）

> **Attention layer** · as_of **2026-10-31** (Asia/Shanghai) · product_use `market_yellow` · confidence `high_attention_not_statutory`
> Not legal advice. Commercial fees ≠ administrative fines. Amounts require source URL + as_of. X evidence is heat/wording only.

**EN:** Freight rates & geopolitics (market yellow light)

## Why attention

近 7 天最大声量：红海/地缘×航运约 1200；SCFI/运价语境约 65。服务「关注层」叙事，不进罚则/Port Pack 法定字段。

```json
{
  "heat_7d": {
    "red_sea": 1200,
    "scfi_rates": 65,
    "blank_sailing": 24
  }
}
```

## Definitions

- **SCFI**（上海出口集装箱运价指数）: Shanghai Containerized Freight Index — spot market indicator, not a contract rate.
- **WCI**（德路里世界集装箱指数）: Drewry World Container Index — composite spot assessment.
- **Spot vs contract**（即期 vs 合约）: Spot fluctuates weekly; long-term contracts differ — neither is a 'fine'.
- **Cape rerouting**（绕好望角）: Avoiding Red Sea/Suez lengthens transit, absorbs capacity, supports rates narratives.

## Who pays / responsible

- Pays: Shipper pays freight + bunker/accessorials per booking; geopolitics is market risk not a statutory fine.
- Note: 
- Responsible: Carriers set blank sailings/rates
- Responsible: BCOs/forwarders watch indices

## Common pitfalls

- Putting SCFI numbers into fine_refs.
- Treating a tweeted index print as contractual quote.
- Ignoring that blank sailings are capacity tools tied to rate defense.

## Official sources

- [UNCTAD](https://unctad.org/topic/transport-and-trade-logistics) — Trade logistics / maritime transport research hub
- [IMO](https://www.imo.org/) — Safety/security context — not a freight index publisher

## Country hooks

- **CN**: SCFI origin 
- **US**: Transpacific demand narratives 
- **NL**: Asia-Europe gateway 
- **AE**: Hub on diversion routes 

## Port hooks

- `CNSHA` 
- `SGSIN` 
- `NLRTM` 
- `AEJEA` 
- `DEHAM` 

## FAQ

### Q: 为什么 Globe 要放运价层？

因为公众与货主近周真正刷屏的是地缘×运价；产品用「市场黄灯」分隔，避免与治超/VGM 法定层混淆。

### Q: 能用 X 上的运价数字下单吗？

不能。以船司/货代正式报价与合约为准；指数仅供趋势。


## X evidence (heat only)

```json
{
  "sample_size_this_run": {
    "red_sea_7d": 1200,
    "rates_7d": 65
  },
  "samples": [
    {
      "url": "https://x.com/tatin17/status/1966417125674725631",
      "kind": "organic",
      "note": "SCFI weekly + blank sailings"
    },
    {
      "url": "https://x.com/EGoh3SAM/status/2086445062574231654",
      "kind": "organic",
      "note": "Drewry WCI outlook"
    },
    {
      "url": "https://x.com/Shipsnapxx/status/2082973470032634203",
      "kind": "media-ish",
      "note": "Blank sailings to defend rates"
    }
  ]
}
```

## Gaps

- No live index API in offline globe
- Geopolitical events change faster than packs

---

*Encyclopedia mirror of `globe/data/topics/*.json`. Not legal advice.*
