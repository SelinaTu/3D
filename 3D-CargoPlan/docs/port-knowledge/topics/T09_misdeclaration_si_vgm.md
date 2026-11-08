<!-- #created 11/08/2026 -->
# T09_misdeclaration_si_vgm · 错报 / SI≠VGM / 品名重量不一致

> **Attention layer** · as_of **2026-10-31** (Asia/Shanghai) · product_use `deep_field` · confidence `medium`
> Not legal advice. Commercial fees ≠ administrative fines. Amounts require source URL + as_of. X evidence is heat/wording only.

**EN:** Misdeclaration · SI vs VGM · description mismatch

## Why attention

安全+费用双风险；近 7 天严口径约 1。与 T02/T08 强相关。

```json
{
  "heat_7d": {
    "misdeclaration": 1
  }
}
```

## Definitions

- **Misdeclaration**（错报/瞒报）: Wrong weight, commodity, hazard class, or quantity vs actual — safety & customs exposure.
- **SI**（装船指示）: Shipping Instruction — docs weight may differ from VGM; carriers may fee large gaps (WDF).
- **Packing list alignment**（箱单一致）: Packing list ↔ load plan ↔ BL ↔ VGM consistency reduces exam/misdeclare risk.

## Who pays / responsible

- Pays: Shipper faces carrier fees, possible authority penalties, cargo claims; amounts jurisdiction-specific — do not invent.
- Note: 
- Responsible: Shipper declarations
- Responsible: Forwarder QC
- Responsible: Carrier acceptance checks

## Common pitfalls

- Updating VGM without SI
- Hazardous misclass
- Using estimated weights as VGM Method 2 without certified process

## Official sources

- [IMO](https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx) — Misdeclared mass safety rationale
- [IMO IMDG](https://www.imo.org/en/ourwork/safety/pages/dangerousgoods.aspx) — Dangerous goods declaration regime (high-level)
- [Maersk](https://www.maersk.com/news/articles/2025/07/31/refresher-of-weight-discrepancy-fee-policy-indonesia) — Commercial consequence of SI/VGM gap

## Country hooks

- **CN**: Customs packing list align checklist 
- **ID**: VGM + WDF 
- **US**: CBP + carrier 
- **NL**: EU customs 

## Port hooks

- `CNSHA` 
- `IDTPP` 
- `USLAX` 
- `NLRTM` 

## FAQ

### Q: SI 和 VGM 必须完全一样吗？

应尽量一致。船司可对超过阈值的差异收 WDF（商业）；SOLAS 关心的是装船用的验证总质量真实性。

### Q: 错报一定有固定罚金吗？

不一定。可能是船司费、海关处罚、民事索赔等不同机制——禁止用传闻金额填 Port Pack。


## X evidence (heat only)

```json
{
  "sample_size_this_run": {
    "counts": 1
  },
  "samples": [
    {
      "url": "https://x.com/JohnSJamesCo/status/1720044368428450261",
      "kind": "media",
      "note": "Weight mis-declaration industry article share"
    },
    {
      "url": "https://x.com/ONeillLogistics/status/1545408023010615297",
      "kind": "corp",
      "note": "Carriers crack down on wrong weights / late VGM"
    }
  ]
}
```

## Gaps

- National criminal/admin misdeclare schedules not compiled

---

*Encyclopedia mirror of `globe/data/topics/*.json`. Not legal advice.*
