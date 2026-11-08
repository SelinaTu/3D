<!-- #created 11/08/2026 -->
# X 海运关注热度：近 7 天 vs 近 90 天
- **as_of**：2026-10-31（Asia/Shanghai）
- **90d 窗口**：2026-08-02T11:09:00+08:00 → 2026-10-31T11:09:00+08:00
- **方法**：`search_posts_all` + `start_time`/`end_time`；每查询 max 25，部分翻 1–2 页；`-is:retweet`。
- **诚实边界**：`get_posts_counts_recent` **仅 7 天**。90 天数字是 **检索抽样 retrieved**，顶满分页时记为 `≥N (capped)`，**不是**全库总量。
- **本轮**：20 查询 · raw retrieved **471**（跨查询未做 ID 去重）。

## 对照表

| theme / query | ~90d retrieved | hit cap? | prior 7d count | note |
| --- | ---: | --- | ---: | --- |
| T01 D&D / free time (`dd_freetime_broad`) | 25 | yes | 70 | truck detention / immigration / fan 'free time'; ~half on-topic container D&D |
| T01 free time strict (`free_time_strict`) | 24 | yes | 53 | trucker dock detention + ocean D&D mix |
| T02 VGM (`vgm_solas`) | 23 | yes | 2 | Video Games Monthly #vgm; rest mostly logistics edu/promo |
| T03/T11 ODOL (`odol`) | 49 | yes | 36 | toothpaste slang 'odol' + real truk ODOL; Pelindo Priok / Zero ODOL 2027 / RUU d |
| T04 blank sailing (`blank_sailing`) | 45 | yes | 24 | highly on-topic freight/ops; some spam thread farms |
| T05 Red Sea geopolitics (`red_sea`) | 25 | yes | 1200 | news/geopolitics dominant; market yellow not statute — volume >> page cap |
| T05 SCFI/freight rates (`scfi_rates`) | 25 | yes | 65 | freight marketing + index commentary; B2C noise |
| T05 ZH 运价 (`zh_yunjia`) | 25 | yes | 65 | A-share shipping stocks + tanker; container SCFI on-topic subset |
| T04 rolled (wide) (`rolled_shutout`) | 25 | yes | 19 | HEAVY: FPL/oats/politics; few true rolled-cargo hits |
| T04 rolled (tight) (`rolled_tight`) | 25 | yes | 19 | still polluted; rare genuine 'buffer for rolled cargo' hits |
| T04 ZH 甩货 (`zh_shuai`) | 25 | yes | 2 | NEARLY ALL off-topic ZH chatter (AI/history/stocks); maritime 甩柜 rare |
| T07 ISPM15 (`ispm15`) | 19 | yes | 8 | pallet vendor promo-heavy; some gov quarantine edu |
| T06 customs hold (`customs_hold_dd`) | 24 | yes | 6 | mixed politics/customs admin; some D&D+exam education |
| T06 customs storage (`customs_storage`) | 7 | no/partial | 10 | low volume; destination charge education useful |
| T08 WDF/restow (`wdf_restow_accessorial`) | 21 | yes | 3 | MOSTLY courier/LTL/parcel accessorial + ecom weight discrepancy — NOT ocean WDF |
| T01 ZH 滞箱 (`zh_detention`) | 10 | no/partial | 5 | crypto/WINKLINK spam + DDP ads; sparse genuine ops |
| T09 misdeclaration (`misdeclaration`) | 23 | yes | 1 | PH politics SALN 'misdeclaration'; few cargo/customs hits |
| T10 abandon cargo (`abandon`) | 10 | no/partial | 56 | abandoned ships / slang; destination-charge organic thin |
| T11 Zero ODOL / ETLE (`etle_odol`) | 19 | yes | 0 | ETLE Operasi Patuh spam dominates; Zero ODOL 2027 / Jatim subsidy sparse but rea |
| T12 CRE / 中欧班列 (`cre_rail`) | 22 | yes | 2 | CRE=Commercial Real Estate dominates; 中欧班列 hits few (拼箱/郑州) |

## 读数

1. **宏观声量**（红海/运价/blank sailing）7 天与 90 天都顶满抽样上限；7 天 red_sea=1200 说明 90 天真实声量远大于 25。
2. **条款主题**（D&D、ODOL、VGM）90 天仍可持续检出；VGM 周热度低但 90 天有稳定 edu 基线。
3. **噪声查询**（甩货中文、rolled 宽、misdeclaration、CRE、WDF）retrieved 高≠有用——污染说明已写入表。
4. **产品含义**：Globe 关注层继续用官方/船司做裁判；X 只排优先级与措辞黄灯。

原始 JSON：`data/_attention_topics_x_90d.json`。
