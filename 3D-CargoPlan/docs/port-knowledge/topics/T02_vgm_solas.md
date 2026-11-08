<!-- #created 11/08/2026 -->
# T02_vgm_solas · VGM · SOLAS 验证总质量

> **Attention layer** · as_of **2026-10-31** (Asia/Shanghai) · product_use `deep_field` · confidence `high_statutory`
> Not legal advice. Commercial fees ≠ administrative fines. Amounts require source URL + as_of. X evidence is heat/wording only.

**EN:** VGM · SOLAS Verified Gross Mass

## Why attention

装船硬条件；近 7 天 X 精确热度仅约 2，但产品优先级不因此下降。CN/ID 国别包已有实施钩子。

```json
{
  "heat_7d": {
    "vgm_solas": 2
  },
  "prior_report": "10_* §A1-P2 / A2-E2 — 近周热度≠重要性"
}
```

## Definitions

- **VGM**（验证总质量）: Verified gross mass of a packed container (cargo + packing + dunnage + tare). Required under SOLAS VI/2 as amended.
- **Method 1**（方法一）: Weigh the packed sealed container using calibrated equipment.
- **Method 2**（方法二）: Weigh all packages/items/securing material + add container tare using a method certified by the competent authority of the packing State.
- **Shipper (SOLAS)**（托运人）: Party named on BL/sea waybill (or who concluded the contract of carriage) — responsible for providing VGM (MSC.1/Circ.1475).
- **No VGM no load**（无 VGM 不得装船）: Availability of VGM to master and terminal sufficiently in advance for stowage plan is a condition for loading (not an entitlement to load).

## Who pays / responsible

- Pays: Shipper obtains/pays for weighing; if terminal weighs on behalf of shipper, commercial parties apportion cost (Circ.1475 §13 contingencies).
- Note: 
- Responsible: Shipper: obtain & document VGM, submit in time.
- Responsible: Master & terminal: must have VGM before loading under SOLAS.
- Responsible: National competent authority: Method 2 certification framework.

## Common pitfalls

- Confusing SI cargo weight with VGM — they can differ; large gaps trigger carrier WDF (commercial).
- Late VGM → rolled cargo / missed cutoff.
- Inventing national tolerances (e.g. folklore ±1000 kg) without statute URL.
- Assuming terminal reweigh always replaces shipper duty — contingencies are commercial.

## Official sources

- [IMO](https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx) — Official VGM page — SOLAS VI/2, Methods 1/2, shipper duty (fetched 2026-10-31)
- [IMO](https://wwwcdn.imo.org/localresources/en/OurWork/Safety/Documents/MSC.1%20Circ.1475.pdf) — MSC.1/Circ.1475 Guidelines
- [UK MCA](https://www.gov.uk/government/publications/mgn-534-mf-guidance-on-the-implementation-of-the-solas-vi-regulation-2-amendment-requiring-the-verification-of-the-gross-mass-of-packed-containers) — MGN 534 national implementation guidance
- [Kemenhub JDIH](https://jdih.kemenhub.go.id/) — ID PM 25/2022 replaces PM 53/2018 — no VGM no load
- [China MOT MSA](https://xxgk.mot.gov.cn/2020/jigou/haishi/202006/t20200630_3319189.html) — CN SOLAS VGM implementation narrative (country pack)

## Country hooks

- **CN**: required_for_load; tolerance narrative ±5%/≤1t — verify current MSA text · `countries.CN.vgm`
- **ID**: PM 25/2022; terminal reweigh ≥5% often refuse load (national dossier) · `countries.ID.vgm`
- **SG**: Skeleton — SOLAS applies; local filing channels TBD 
- **US**: Skeleton — SOLAS applies via Coast Guard / industry practice 
- **NL**: Skeleton 
- **DE**: Skeleton 
- **KR**: Skeleton 
- **MY**: Skeleton 
- **AE**: Skeleton 

## Port hooks

- `CNSHA` Deep pack inherits country VGM
- `CNSZX` Deep pack inherits country VGM
- `CNNGB` Deep pack inherits country VGM
- `IDTPP` Deep pack inherits country VGM
- `IDSUB` Deep pack inherits country VGM
- `SGSIN` Deep pack inherits country VGM
- `NLRTM` Deep pack inherits country VGM
- `DEHAM` Deep pack inherits country VGM
- `USLAX` Deep pack inherits country VGM
- `USNYC` Deep pack inherits country VGM

## FAQ

### Q: 谁必须交 VGM？

SOLAS 下责任在 shipper（提单/运输合同托运人）。货代可代办，但法律责任框架仍指向 shipper 定义（Circ.1475）。

### Q: 没有 VGM 能装船吗？

原则上不能。指南允许船长与码头代表代为取得 VGM（如码头称重），费用分摊由商业约定——不是免费豁免。

### Q: Method 1 / 2 怎么选？

Method 1 整柜称重；Method 2 分项累加+皮重，且方法须经装箱完成国主管机关认可。选法看设施与国别规则。

### Q: 近 7 天 X 几乎没人聊 VGM，还重要吗？

重要。热度低说明是「默会规则」而非热点八卦；装船阻断不依赖社媒刷屏。


## X evidence (heat only)

```json
{
  "sample_size_this_run": {
    "counts": 2,
    "archive_result_count": 25
  },
  "samples": [
    {
      "url": "https://x.com/cargolinked_com/status/2111381707144245751",
      "kind": "edu",
      "note": "No VGM → box rolls"
    },
    {
      "url": "https://x.com/FirstExplog/status/2106043136019431808",
      "kind": "promo/edu",
      "note": "No VGM. No loading."
    },
    {
      "url": "https://x.com/JohnSJamesCo/status/1720044368428450261",
      "kind": "media",
      "note": "Mis-declaration rampant narrative via Loadstar"
    },
    {
      "url": "https://x.com/BartGonnissen/status/1895056979250323950",
      "kind": "organic",
      "note": "Wrong VGM used in stow plan anecdote"
    }
  ]
}
```

## Gaps

- National Method-2 authority lists incomplete
- Dock reweigh priority rules per terminal thin

---

*Encyclopedia mirror of `globe/data/topics/*.json`. Not legal advice.*
