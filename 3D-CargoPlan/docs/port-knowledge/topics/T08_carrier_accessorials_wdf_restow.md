<!-- #created 11/08/2026 -->
# T08_carrier_accessorials_wdf_restow · 承运人杂费 · WDF / Restow / Per diem

> **Attention layer** · as_of **2026-10-31** (Asia/Shanghai) · product_use `deep_field` · confidence `medium_one_carrier_example`
> Not legal advice. Commercial fees ≠ administrative fines. Amounts require source URL + as_of. X evidence is heat/wording only.

**EN:** Carrier accessorials · WDF / Restow / Per diem

## Why attention

L4 层核心；Maersk WDF 有公开 advisory。Restow 费率几乎挖不到。近 7 天宽查询约 3，且易被快递 weight discrepancy 污染。

```json
{
  "heat_7d": {
    "wdf_restow_accessorial": 3
  }
}
```

## Definitions

- **Accessorial**（附加服务费）: Carrier charges beyond ocean freight (THC, demurrage, WDF, restow, amendment, etc.).
- **WDF**（重量不符费）: Weight Discrepancy Fee — commercial; e.g. Maersk when |SI weight − VGM| > threshold or VGM vs CSC/tare invalid.
- **Restow**（倒柜/重积载）: Moving containers on vessel/yard due to plan change — cost often commercial opaque.
- **Per diem**（按日设备费）: Often synonym/near to detention or chassis daily in US trades — check tariff wording.

## Who pays / responsible

- Pays: Shipper/merchant per carrier invoice; NOT an administrative fine.
- Note: 
- Responsible: Carrier tariff publication
- Responsible: Shipper accurate SI/VGM

## Common pitfalls

- Writing WDF into fine_refs as government penalty.
- Inventing restow USD amounts without tariff URL.
- Confusing courier 'weight discrepancy' tweets with ocean WDF.

## Official sources

- [Maersk](https://www.maersk.com/news/articles/2025/07/31/refresher-of-weight-discrepancy-fee-policy-indonesia) — ID refresher: WDF USD 300/container; >3000 kg SI vs VGM; VGM>max gross; VGM<tare (commercial)
- [Maersk](https://www.maersk.com/news/articles/2024/09/12/update-wdf-weight-discrepancy-fee) — 2024-10-15 effective update — USD 300 world origins stated
- [Maersk](https://www.maersk.com/news/articles/2026/04/28/weight-discrepancy-fee-update-pre-notification) — 2026-05-07 cutoff-date billing + pre-notification; tank threshold 5000 kg
- [IMO](https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx) — VGM statutory backdrop for WDF commercial overlays

## Country hooks

- **ID**: Documented in countries.json · `carrier_fees_examples Maersk WDF`
- **SG**: Maersk WDF PDF advisory also for SG local info 
- **CN**: Other carriers' WDF TBD 

## Port hooks

- `IDTPP` 
- `IDSUB` 
- `SGSIN` 
- `CNSHA` 

## FAQ

### Q: Maersk WDF 多少钱？

公开 advisory 写 USD 300/柜（条件：SI 与 VGM 差 >3000 kg 等）。这是承运人费，不是行政罚。以船司当期通知为准（2026-05 起计费时点改到 cutoff）。

### Q: Restow 为什么不写金额？

可靠公开价目稀缺；禁止编造。有 dated tariff URL 再写入 L4。


## X evidence (heat only)

```json
{
  "sample_size_this_run": {
    "archive": 19
  },
  "samples": [],
  "honesty": "search for WDF|restow|accessorial returned mostly India courier Shiprocket disputes — not ocean. Prefer Maersk URLs over X."
}
```

## Gaps

- Hapag/MSC/COSCO WDF tables
- Restow rate cards
- Chassis per-diem US schedules

---

*Encyclopedia mirror of `globe/data/topics/*.json`. Not legal advice.*
