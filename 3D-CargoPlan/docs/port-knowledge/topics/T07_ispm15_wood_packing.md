<!-- #created 11/08/2026 -->
# T07_ispm15_wood_packing · ISPM15 木质包装

> **Attention layer** · as_of **2026-10-31** (Asia/Shanghai) · product_use `faq_yellow` · confidence `high_definition_promo_heavy_on_x`
> Not legal advice. Commercial fees ≠ administrative fines. Amounts require source URL + as_of. X evidence is heat/wording only.

**EN:** ISPM 15 wood packaging

## Why attention

定义清晰；近 7 天约 8，归档页广告比例极高。裁判用 IPPC，不用熏蒸广告罚金话术。

```json
{
  "heat_7d": {
    "ispm15": 8
  }
}
```

## Definitions

- **ISPM 15**（国际植检措施标准第15号）: IPPC standard for wood packaging material in international trade — debarked wood + approved treatment + mark.
- **WPM**（木质包装材料）: Pallets, crates, dunnage of raw wood; excludes processed wood like plywood (generally).
- **Mark**（IPPC 标识）: Symbol + ISO country + producer code + treatment code (HT/DH/MB/SF); legible, durable, not hand-drawn.

## Who pays / responsible

- Pays: Exporter/packer arranges treatment & marking; non-compliance risks refusal/treatment/destruction at import — costs on cargo interest per local NPPO rules.
- Note: 
- Responsible: NPPO authorization of mark users
- Responsible: Packer/shipper compliance
- Responsible: Import NPPO inspection

## Common pitfalls

- Hand-drawn or incomplete marks.
- Treating fumigation ads as statutory fine schedules.
- Forgetting dunnage inside containers.

## Official sources

- [IPPC](https://www.ippc.int/en/publications/640/) — ISPM 15 publication page (fetched 2026-10-31)
- [IPPC PDF](https://www.ippc.int/static/media/files/publication/en/2019/02/ISPM_15_2018_En_WoodPackaging_Post-CPM13_Rev_Annex1and2_Fixed_2019-02-01.pdf) — ISPM 15 2018 EN with Annex 1–2
- [European Commission](https://food.ec.europa.eu/plants/plant-health-and-biosecurity/trade-plants-plant-products-non-eu-countries/requirements-wood-packaging-dunnage_en) — EU import WPM based on ISPM 15

## Country hooks

- **CN**: Checklist ispm15_if_wood in country pack 
- **US**: APHIS enforces ISPM15 
- **NL**: EU regime 
- **DE**: EU regime 
- **ID**: Quarantine interface 

## Port hooks

- `USLAX` 
- `NLRTM` 
- `DEHAM` 
- `CNSHA` 

## FAQ

### Q: 哪些木头要 ISPM15？

国际贸易中的原木包装（含垫木）；经胶合热压等加工材（如胶合板）通常除外——以 ISPM15 正文为准。

### Q: 没标记会怎样？

进口 NPPO 可能拒绝入境、退运、销毁或责令处理；具体措施国别不同。勿用广告里的「罚款 $X」当全球标准。


## X evidence (heat only)

```json
{
  "sample_size_this_run": {
    "archive": 18
  },
  "samples": [
    {
      "url": "https://x.com/shivshakti_ti/status/2061305633379676231",
      "kind": "promo",
      "note": "Myth vs fact ISPM15 — marketing"
    },
    {
      "url": "https://x.com/global_pallets/status/2103351465192640725",
      "kind": "promo",
      "note": "Compliance tip ad"
    }
  ],
  "honesty": "Archive almost all promo; use IPPC as referee."
}
```

## Gaps

- Per-country NPPO refusal fee tables not collected

---

*Encyclopedia mirror of `globe/data/topics/*.json`. Not legal advice.*
