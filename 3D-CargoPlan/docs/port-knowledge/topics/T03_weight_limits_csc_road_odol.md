<!-- #created 11/08/2026 -->
# T03_weight_limits_csc_road_odol · 限重三层 · CSC / 船司·VGM / 公路·ODOL

> **Attention layer** · as_of **2026-10-31** (Asia/Shanghai) · product_use `deep_field` · confidence `high_cn_id_skeleton_elsewhere`
> Not legal advice. Commercial fees ≠ administrative fines. Amounts require source URL + as_of. X evidence is heat/wording only.

**EN:** Three-layer weight limits · CSC / VGM-carrier / Road ODOL

## Why attention

规划引擎核心；印尼 ODOL 近 7 天约 36；「超重柜+罚款」严口径近周可为 0——执法在公路/卡口不在刷屏。

```json
{
  "heat_7d": {
    "odol": 36,
    "etle_odol": 0
  },
  "prior_report": "10_* §A1-P3; 02b_indonesia_national.md"
}
```

## Definitions

- **CSC max gross**（柜铭牌最大总重）: Structural limit on CSC Safety Approval Plate — cargo+tare must not exceed.
- **VGM / stowage limit**（船侧重量）: SOLAS VGM + carrier/stack rules — can be stricter commercially than CSC.
- **Road axle / GVW**（公路轴载/车货总重）: National highway limits (e.g. CN MOT table; ID UU 22/2009 Kelas + MST; US Bridge Formula).
- **ODOL**（超限超载）: Indonesia Over Dimension Over Loading — road enforcement at ports/tolls/industrial zones.
- **JBI / JBKI**（允许总重/列车总重）: Vehicle-specific permitted mass on KIR — NOT equal to ISO container payload.

## Who pays / responsible

- Pays: Administrative fines hit vehicle operator/owner per national law; commercial refusal/WDF hit shipper; product must separate the two.
- Note: 
- Responsible: Shipper/packer for mass distribution
- Responsible: Haulier for road legality
- Responsible: Terminal gate for local tonnage plaques (verify)
- Responsible: Police/transport authority for ODOL/road

## Common pitfalls

- Using ISO payload as road legal weight.
- Writing Rp 50 miliar ODOL fine into Pack — rumor_unverified vs UU caps.
- Ignoring Kelas road length/height (HC + chassis > 4.2 m).
- Mixing CN ¥30k road fine with carrier WDF USD.

## Official sources

- [IMO CSC](https://www.imo.org/en/about/conventions/pages/international-convention-for-safe-containers-%28csc%29.aspx) — Safe Containers Convention
- [China gov.cn](https://www.gov.cn/zhengce/zhengceku/2021-08/26/content_5633469.htm) — MOT overlimit regulation — mass table + Art.43 fine formula
- [UU 22/2009 mirror](https://pelayanan.jakarta.go.id/download/regulasi/undang-undang-nomor-22-tahun-2009-tentang-lalu-lintas-dan-angkutan-jalan.pdf) — ID road class + MST; Pasal 277/307 fine caps
- [Permenhub 18/2021](https://peraturan.bpk.go.id/Download/311148/2021pmkemenhub018.pdf) — Freight loading supervision / JBI
- [US FHWA](https://ops.fhwa.dot.gov/freight/SW/faqs/qa.cfm) — Federal weight FAQ — no national fine schedule
- [IMO CTU Code](https://www.imo.org/en/ourwork/safety/pages/ctu-code.aspx) — Packing / load distribution practice (non-mandatory)

## Country hooks

- **CN**: Thick — ¥500/t over 1t cap ¥30k · `road_limits + fine_refs CN-OW-MASS`
- **ID**: Thick — Rp 24jt / Rp 500rb statutory caps · `road_limits MST + fine_refs Pasal 277/307`
- **US**: Federal limits; state fines — skeleton 
- **DE**: BKatV % bands — see 05_fines 
- **NL**: ILT overbelading 
- **KR**: Road fines unverified gap 
- **MY**: Road fines unverified gap 
- **AE**: Road fines unverified gap 
- **SG**: Island road limits TBD skeleton 

## Port hooks

- `IDTPP` Priok toll access 45t media 2017 — current plaque unverified
- `IDSUB` Perak ODOL trial 2026 (Kompas)
- `IDBLW` Belawan ODOL gate narrative
- `CNSHA` CN highway after gate
- `USLAX` CA state/county schedules

## FAQ

### Q: 柜能装的重量 = 能上路的重量吗？

不一定。CSC/ISO payload、VGM/船司、公路轴载/ODOL 是三层；任一超限都可能「装得上船、出不了门」。

### Q: 印尼超载罚多少？

可引用 UU 22/2009：Pasal 307 上限约 Rp 500.000（装载/daya angkut）；Pasal 277 上限约 Rp 24.000.000（技术/改型语境）。网上「Rp 500 亿」类 → rumor_unverified，不进罚金字段。

### Q: 中国治超封顶多少？

治超规章第 43 条叙述：未超 1000 kg 警告；其后每超 1000 kg ¥500，封顶 ¥30,000（以 gov.cn 现行文为准）。

### Q: Zero ODOL 2027 是新罚金表吗？

政策节奏是更严执行既有法，不是自动替换罚金表；港口是卡口之一。


## X evidence (heat only)

```json
{
  "sample_size_this_run": {
    "odol_7d": 36,
    "archive": 20
  },
  "samples": [
    {
      "url": "https://x.com/kompascom/status/2109900925871820827",
      "kind": "media",
      "note": "Perak ODOL trial → Zero ODOL 2027"
    },
    {
      "url": "https://x.com/KompasOtomotif/status/2109127884266954994",
      "kind": "media",
      "note": "ODOL enforcement to ports"
    },
    {
      "url": "https://x.com/hubdat151/status/1624778488795496449",
      "kind": "gov",
      "note": "Ditjen Hubdat Zero ODOL messaging"
    },
    {
      "url": "https://x.com/soloposdotcom/status/1945742205592723690",
      "kind": "media",
      "note": "Policy discussion"
    }
  ],
  "rumor_unverified": [
    "Rp 50 miliar / Rp50 M ODOL headline amounts — not mapped to UU article in our verification"
  ]
}
```

## Gaps

- Pelindo current gate tonnage plaques
- KR/MY/AE road fine tables
- Machine-readable stuffing bans none

---

*Encyclopedia mirror of `globe/data/topics/*.json`. Not legal advice.*
