<!-- #created 11/08/2026 -->
# T01_demurrage_detention_storage_freetime · 滞期 / 滞箱 / 堆存 · Free time 三钟

> **Attention layer** · as_of **2026-10-31** (Asia/Shanghai) · product_use `deep_field` · confidence `high_definition_commercial_rates_variable`
> Not legal advice. Commercial fees ≠ administrative fines. Amounts require source URL + as_of. X evidence is heat/wording only.

**EN:** Demurrage / Detention / Storage · Free time clocks

## Why attention

从业科普最稳主题；近 7 天 EN demurrage|detention 语境约 70，free time 严格约 53；红海声量更大但不替代本条款字段。

```json
{
  "heat_7d": {
    "demurrage_detention_broad": 70,
    "free_time_strict": 53,
    "zh_detention": 5
  },
  "prior_report": "docs/port-knowledge/10_maritime_knowledge_pain_attention.md §A1-P1 / A2-E1",
  "note": "Amounts and free-day counts are carrier×terminal commercial — never invent a global number."
}
```

## Definitions

- **Free time / Free days**（免费用箱/免堆期）: Contracted period before demurrage, detention, or storage charges begin. Often different for import pickup vs empty return vs export gate-in.
- **Last Free Day (LFD)**（最后免费日）: Calendar day when free time ends; next day (or next tariff step) starts charging. Confirm timezone and whether LFD is inclusive.
- **Demurrage**（滞期（码头内））: Charge while the loaded container remains inside the terminal/rail ramp past free time (before pickup). Industry convention: 'inside the fence'.
- **Detention**（滞箱（码头外））: Charge while the carrier's container (and sometimes chassis) remains outside the terminal past free time after pickup, until empty return.
- **Storage / Terminal storage**（堆存）: Terminal/port authority charge for occupying yard space; may run in parallel with carrier demurrage depending on local tariff — verify per port.
- **Combined D&D**（合并计费）: Some carriers bill a single 'demurrage & detention' ladder; still track physical location of the box for dispute evidence.

## Who pays / responsible

- Pays: Merchant (shipper/consignee/forwarder per contract/Incoterms) pays carrier D&D; terminal storage may be billed separately by terminal/NVOCC.
- Note: Who 'stops the clock' during customs exam or terminal inability is contractual/negotiated — FIATA argues free time should extend for periods merchant cannot act.
- Responsible: Carrier publishes free time & tariff (commercial).
- Responsible: Merchant monitors LFD, appointments, empty return.
- Responsible: Terminal controls gate appointments / yard release — may affect ability to pick up.

## Common pitfalls

- Treating demurrage and detention as one fee and disputing the wrong party.
- Assuming '3–7 free days' is a law — it is not; it is tariff/contract.
- Clock continues during customs hold / failed trucker appointment unless tariff or negotiation says otherwise.
- Export demurrage while vessel delayed — FIATA argues carrier should own vessel delay; practice varies.
- Chassis per-diem layered on top of detention in some US trades.

## Official sources

- [FIATA](https://fiata.org/n/fiata-calls-for-reasonable-free-time-for-container/) — 2023-02 press: carriers should provide reasonable free time; points to Toolkit / Best Practice Guide
- [FIATA (mirror PDF)](https://www.elea.ee/wp-content/uploads/2023/05/FIATA_Best-Practice-Guide-on-Demurrage-and-Detention_1810.pdf) — Best Practice Guide on Demurrage and Detention — definitions & negotiation recommendations
- [UNCTAD](https://unctad.org/news/demurrage-and-detention-charges-container-shipping) — Summarizes FIATA WG recommendations (extend free time when terminal cannot release, etc.)
- [CLECAT](https://www.clecat.org/media/CLECAT%20Briefing%20&%20Industry%20Recommendations%20Paper%20on%20D&D%20Practices%20in%20Shipping_1.pdf) — Industry briefing: demurrage inside / detention outside framing
- [Maersk Logistics Explained](https://www.maersk.com/logistics-explained/transportation-and-freight/2023/08/28/what-is-demurrage-detention-in-shipping-for-buyers) — Carrier educational page (fetch occasionally 500 — URL retained as industry glossary)

## Country hooks

- **US**: FMC has engaged on D&D reasonableness historically; still commercial — check carrier tariff + FMC complaint path 
- **CN**: Local terminal storage schedules vary by port; country pack has no unified free-time table 
- **ID**: Port gate ODOL enforcement can delay pickup → watch demurrage clock 
- **NL**: Rotterdam merchant haulage / detention free time often contested in industry papers 
- **SG**: Highly scheduled terminals — appointment failure still commercial risk 

## Port hooks

- `USLAX` USWC — chassis + demurrage narratives common
- `USLGB` Same cluster as LAX
- `USNYC` USEC — rail ramp LFD language common
- `CNSHA` Export demurrage / yard congestion narratives
- `SGSIN` Transshipment dwell + storage
- `NLRTM` EU gateway — D&D education posts frequent
- `IDTPP` Priok — ODOL gate × pickup delay
- `IDSUB` Perak ODOL trial 2026 media

## FAQ

### Q: Demurrage 和 Detention 差在哪？

惯例：Demurrage = 重柜还在码头/堆场内超过 free time；Detention = 提柜后在码头外占有船司箱体超过 free time 未还空。有的船司合并账单，但争议证据仍应按位置分开。出处：FIATA/CLECAT/行业 glossary。

### Q: Free time 法定几天？

没有全球统一法定天数。由船司 tariff、合约或 NVOCC 条款约定。FIATA 主张应给合理免费用箱期，拥堵/码头无法放行时应等比延长——属谈判立场，非自动生效法条。

### Q: 查验期间费用钟停不停？

多数情况下并不自动停钟；是否减免看船司/码头条款与协商。产品侧应标「待核实/合约」，禁止写死「查验免 demurrage」。

### Q: Storage 和 Demurrage 会不会重复收？

可能并行：码头收堆存、船司收 demurrage。逐港核对 tariff，勿假设互斥。


## X evidence (heat only)

```json
{
  "sample_size_this_run": {
    "counts_queries": 3,
    "archive_result_count": 23
  },
  "samples": [
    {
      "url": "https://x.com/CandCWarehouse/status/2114532022844850568",
      "kind": "organic/edu",
      "note": "Inside vs outside clocks"
    },
    {
      "url": "https://x.com/RLGlobal/status/1701928927462076782",
      "kind": "organic/edu",
      "note": "Last Free Day dual meaning"
    },
    {
      "url": "https://x.com/LogTechEric/status/1568240243035308037",
      "kind": "organic",
      "note": "Practitioner: D vs D are different processes"
    },
    {
      "url": "https://x.com/niryatsetu1/status/2105581948458745922",
      "kind": "promo/edu",
      "note": "Inside=Demurrage Outside=Detention meme"
    }
  ],
  "honesty": "Many GMT+7 'receipts folklore' template posts — down-rank as promo/noise."
}
```

## Gaps

- No machine-readable free_time table per carrier×port in this pack
- Maersk glossary URL sometimes HTTP 500 from fetch env
- Terminal storage schedules not ingested

---

*Encyclopedia mirror of `globe/data/topics/*.json`. Not legal advice.*
