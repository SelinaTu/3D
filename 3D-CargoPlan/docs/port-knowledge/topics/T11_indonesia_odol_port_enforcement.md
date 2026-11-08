<!-- #created 11/08/2026 -->
# T11_indonesia_odol_port_enforcement · 印尼 Zero ODOL · 港口卡口执法

> **Attention layer** · as_of **2026-10-31** (Asia/Shanghai) · product_use `deep_field` · confidence `high_policy_direction`
> Not legal advice. Commercial fees ≠ administrative fines. Amounts require source URL + as_of. X evidence is heat/wording only.

**EN:** Indonesia Zero ODOL · port-gate enforcement

## Why attention

从 T03 拆出的关注簇：2026 媒体报道 Perak 等港口试执法；目标年多报 2027。ETLE+ODOL 近 7 天精确计数 0。

```json
{
  "heat_7d": {
    "odol": 36,
    "etle_odol": 0
  },
  "prior_report": "02b_indonesia_national.md §2.5–2.6"
}
```

## Definitions

- **Zero ODOL**（零超限超载目标）: Policy push to eliminate ODOL practice; 2025 messaging emphasized enforcing existing UU rather than new fine statute; target year often reported 2027.
- **Port as checkpoint**（港口卡口）: Enforcement narrative includes pelabuhan, toll, industrial zones — containers leaving gate enter road regime.
- **WIM**（动态称重）: Weigh-in-motion systems mentioned in enforcement modernization — verify deployment status per corridor.

## Who pays / responsible

- Pays: Vehicle operator under UU 22/2009; cargo interest may face delay/refusal commercially.
- Note: 
- Responsible: Kemenhub / Hubdat
- Responsible: Korlantas
- Responsible: Pelindo/terminal gate processes
- Responsible: Hauliers

## Common pitfalls

- Treating 2027 as a new Rp fine table
- Ignoring JBI on KIR
- Using 2017 Priok 45t article as current without re-verify

## Official sources

- [Kemenhub](https://kemenhub.go.id/post/read/menhub-dudy-tegaskan-penanganan-angkutan-odol-harus-segera-dilaksanakan) — Minister statement on ODOL handling
- [Korlantas](https://korlantas.polri.go.id/pemerintah-komitmen-sosialisasikan-strategi-penegakan-hukum-terhadap-kendaraan-truk-over-dimension-dan-overload/) — Enforcement socialization
- [Hubdat Stop ODOL](https://hubdat.dephub.go.id/id/bptd/sulteng/publikasi/stop-odol/) — Campaign page (availability intermittent)
- [UU 22/2009](https://pelayanan.jakarta.go.id/download/regulasi/undang-undang-nomor-22-tahun-2009-tentang-lalu-lintas-dan-angkutan-jalan.pdf) — Statutory fine caps Pasal 277/307

## Country hooks

- **ID**: Thick country pack · `countries.ID`

## Port hooks

- `IDSUB` 2026 Kompas: Perak trial site
- `IDTPP` National hub — gate ODOL pressure
- `IDBLW` Belawan
- `IDSRG` Emas
- `IDMAK` Makassar

## FAQ

### Q: 港口治超和公路治超一样吗？

港口是卡口叙事的一部分：出门即进入公路/ODOL 体制。具体吨位牌以码头现行公告为准（Priok 45t 为历史报道，待核实）。

### Q: ETLE 自动罚 ODOL？

本轮近 7 天 ETLE+ODOL 精确计数为 0；不要把电子警察传说写成现行自动罚则。


## X evidence (heat only)

```json
{
  "sample_size_this_run": {
    "odol_archive": 20
  },
  "samples": [
    {
      "url": "https://x.com/kompascom/status/2109900925871820827",
      "kind": "media",
      "note": "Perak ODOL trial"
    },
    {
      "url": "https://x.com/jasacustoms/status/2105223867862040585",
      "kind": "organic",
      "note": "Zero ODOL 2027 landside pressure"
    },
    {
      "url": "https://x.com/hubdat151/status/1624778488795496449",
      "kind": "gov",
      "note": "Hubdat campaign"
    }
  ],
  "rumor_unverified": [
    "Rp50 miliar headlines"
  ]
}
```

## Gaps

- Pelindo plaque photos/as_of
- WIM corridor list

---

*Encyclopedia mirror of `globe/data/topics/*.json`. Not legal advice.*
