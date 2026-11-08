<!-- #created 11/08/2026 -->
# X 航运关注趋势：近 90 天事件类型迁移

- **as_of**：2026-10-31（Asia/Shanghai）
- **窗口**：2026-08-02 → 2026-10-31（UTC：M1 `08-02→09-01` / M2 `09-01→10-01` / M3 `10-01→10-31T03:09Z`）
- **方法**：内置 `x.search_posts_all`，**8 条清洁查询** × 3 月，每格 max=25、`-is:retweet`、relevancy；另 `search_news`（≤720h）补命名事件。
- **诚实边界**：均为 **检索抽样**；有 next_token 或 n≈25 视为 **capped**，**≠全库总量**。跨查询按 post id 去重后启发式标注事件类型。X = **黄灯**（措辞/优先级），非法条裁判。
- **标注量**：unique **459** · on-topic **424** · noise **35**

## Executive：是否有转移？

**有「层内迁移」，没有「主题换挡」。**

三个月抽样里，航运可见声量仍是 **A 地缘（红海/Houthi）+ B 运力排班（blank sailing）+ C 运价叙事** 的宏观顶层，叠 **D 滞期滞箱教育** 与 **E 治超/ODOL** 的稳定中层；VGM/ISPM/海关时钟为长尾。

相对变化：8 月 **Tihamah 等致命袭击** 把 A 推到中心；8 月末–9 月 **Golden Week blank / Drewry 多周取消班期** 把 B 钉成产能工具；C 在表上「上升」但 **M1 SCFI 格几乎被股票垃圾号占满**，故 C 轨迹含样本伪影。印尼 **Zero ODOL 2027** 三旬都在——**不是**从合规迁走。结论：**宏观黄灯更吵，条款黄灯仍在**；产品勿把声量迁移读成法规迁移。

## 事件类型占比（去噪 on-topic 抽样）

> 下表是 **类型构成**，因每格封顶 25，**不能**当市场份额。

| type | M1 Aug | M2 Sep | M3 Oct | traj |
| --- | ---: | ---: | ---: | --- |
| `A_geopolitics_disruption` | 24 (18.8%) | 19 (13.2%) | 18 (11.8%) | **falling** |
| `B_capacity_schedule` | 22 (17.2%) | 22 (15.3%) | 25 (16.4%) | **flat** |
| `C_rate_index` | 5 (3.9%) | 27 (18.8%) | 26 (17.1%) | **peaked_m2** |
| `D_commercial_charges` | 15 (11.7%) | 23 (16.0%) | 24 (15.8%) | **rising** |
| `E_compliance_weight` | 30 (23.4%) | 26 (18.1%) | 32 (21.1%) | **flat** |
| `F_quarantine_packaging` | 25 (19.5%) | 12 (8.3%) | 10 (6.6%) | **falling** |
| `G_customs_clock` | 7 (5.5%) | 15 (10.4%) | 17 (11.2%) | **rising** — rising in clean sample but absolute n still small; many consumer/customs-storage false friends filtered |

| month | on-topic n |
| --- | ---: |
| 2026-08 | 128 |
| 2026-09 | 144 |
| 2026-10 | 152 |

### 分查询 retrieved（on = 去噪估计；* = capped）

| query | M1 | M2 | M3 |
| --- | ---: | ---: | ---: |
| blank_sailing | 23* / on 23 | 24* / on 24 | 25* / on 25 |
| red_sea | 24* / on 24 | 21* / on 21 | 18* / on 18 |
| scfi_rates | 10* / on 1 | 24* / on 24 | 25* / on 25 |
| dd_freetime | 25* / on 18 | 25* / on 25 | 25* / on 25 |
| odol | 25* / on 25 | 23* / on 23 | 23* / on 23 |
| vgm | 5* / on 5 | 3* / on 3 | 9* / on 9 |
| ispm15 | 25* / on 25 | 14* / on 12 | 10* / on 10 |
| customs_dd | 17* / on 10 | 23* / on 19 | 25* / on 18 |

## 命名事件时间线（抽样，非穷尽）

### M1 · 2026-08
- **2026-08-05** [`A_geopolitics_disruption`] Houthi claim strike on NCC WAFA tanker — [2084915351628697664](https://x.com/WindwardAI/status/2084915351628697664)
- **2026-08-11** [`D_commercial_charges`] Empty-return friction + detention complaints (e.g. NAGAFF/NG) — [2087277146154705064](https://x.com/GuardianNigeria/status/2087277146154705064)
- **2026-08-12** [`E_compliance_weight`] Indonesia Zero ODOL 2027 discourse — [2087430767043571946](https://x.com/kompascom/status/2087430767043571946)
- **2026-08-06** [`A_geopolitics_disruption`] Bab el-Mandeb transit suppression narrative — [2085360285393834178](https://x.com/PiQMarkets/status/2085360285393834178)
- **2026-08-17** [`A_geopolitics_disruption`] Tihamah Bab el-Mandeb fatal attack (~4 crew) — [2089155832005222586](https://x.com/IntelHQ26/status/2089155832005222586)
- **2026-08-27** [`B_capacity_schedule`] Drewry blank-sailing / WCI capacity print; Multi-week blank sailing slate (capacity defense) — [2093119539873779905](https://x.com/Shipsnapxx/status/2093119539873779905)
- **2026-08-25** [`B_capacity_schedule`] Multi-week blank sailing slate (capacity defense) — [2092382778293666133](https://x.com/container_news/status/2092382778293666133)
- **2026-08-25** [`B_capacity_schedule`] Carrier Golden Week blank sailings (MSC/Maersk); Multi-week blank sailing slate (capacity defense) — [2092266026687692926](https://x.com/riyadhcargo/status/2092266026687692926)

### M2 · 2026-09
- **2026-09-14** [`B_capacity_schedule`] Multi-week blank sailing slate (capacity defense) — [2099401511038013614](https://x.com/Twaharashid/status/2099401511038013614)
- **2026-09-24** [`B_capacity_schedule`] Drewry blank-sailing / WCI capacity print — [2103116489494519897](https://x.com/christankerfund/status/2103116489494519897)
- **2026-09-25** [`E_compliance_weight`] Indonesia Zero ODOL 2027 discourse — [2103370802926329913](https://x.com/kompascom/status/2103370802926329913)
- **2026-09-18** [`B_capacity_schedule`] Carrier Golden Week blank sailings (MSC/Maersk); Multi-week blank sailing slate (capacity defense) — [2101017669113717193](https://x.com/Gatewaylines/status/2101017669113717193)
- **2026-09-05** [`D_commercial_charges`] Empty-return friction + detention complaints (e.g. NAGAFF/NG) — [2096357969772318903](https://x.com/Suppplychain/status/2096357969772318903)
- **2026-09-24** [`C_rate_index`] Carrier earnings / capacity-discipline narrative — [2103064166013776126](https://x.com/algotradingdesk/status/2103064166013776126)
- **2026-09-09** [`C_rate_index`] SCFI/index rate commentary — [2097709114923110662](https://x.com/yiba484655/status/2097709114923110662)
- **2026-09-17** [`G_customs_clock`] High-attention: If you have ever successfully shipped goods from overseas to Nigeria, you will understand that clearing them i — [2100634732748828778](https://x.com/General_Oluchi/status/2100634732748828778)

### M3 · 2026-10
- **2026-10-13** [`E_compliance_weight`] Indonesia Zero ODOL 2027 discourse — [2109900925871820827](https://x.com/kompascom/status/2109900925871820827)
- **2026-10-20** [`B_capacity_schedule`] Carrier Golden Week blank sailings (MSC/Maersk); Multi-week blank sailing slate (capacity defense); SCFI/index rate commentary — [2112441219364336010](https://x.com/Evergreener1977/status/2112441219364336010)
- **2026-10-08** [`B_capacity_schedule`] Drewry blank-sailing / WCI capacity print; Multi-week blank sailing slate (capacity defense) — [2108215905654308954](https://x.com/TerminusRisk/status/2108215905654308954)
- **2026-10-30** [`A_geopolitics_disruption`] Bab el-Mandeb transit suppression narrative — [2116117255415079089](https://x.com/free_watcher_DI/status/2116117255415079089)
- **2026-10-30** [`B_capacity_schedule`] Multi-week blank sailing slate (capacity defense) — [2116213541090812268](https://x.com/FARPOINTGLOBAL/status/2116213541090812268)
- **2026-10-27** [`D_commercial_charges`] High-attention: 📦 ERADICATING INTERMODAL FREIGHT FRICTION: AUTOMATING PORT DETENTION RECONCILIATIONS  Global container shippin — [2115155903746056641](https://x.com/kimkhanhlinh179/status/2115155903746056641)
- **2026-10-27** [`G_customs_clock`] High-attention: 🧊 PRESERVING VACCINE EFFICACY: PARAMETRIC SPOILAGE INDEMNITY CONTRACTS FOR BIOLOGICS SHIPMENTS  The internatio — [2115157704469803509](https://x.com/kimkhanhlinh179/status/2115157704469803509)
- **2026-10-22** [`A_geopolitics_disruption`] High-attention: Is the Red Sea safe?  An accelerating return of container shipping to the Suez Canal, Red Sea and Bab El Mande — [2113233495380066374](https://x.com/mercoglianos/status/2113233495380066374)

### News 侧写（`search_news`，≤约 30 天）

X News 对象字段因条目而异；原始见 `data/_trend_90d_raw/news_*.json`。机读摘录写入 `_attention_trend_90d.json` → `news_sample`（含 id/url）。命名事件仍以帖文时间线为主。

## 需要注意什么（产品 / 运营）

- **[market_yellow]** 红海/Bab el-Mandeb 袭击与过境压制（Tihamah 致命袭击、NCC WAFA 宣称打击等）→ Cape 绕航/港口扎堆 → ETA 与 free time 风险；非法条
- **[market_yellow]** Blank sailing 工具化（Drewry 多周取消班期、MSC/Maersk Golden Week blanks）→ 订舱、甩柜缓冲、船期变更通知进产品
- **[market_yellow]** 运价/指数叙事（WCI/SCFI/跨太 vs 亚欧）持续；X 垃圾号多，只作优先级黄灯，不写进费率字段
- **[statute_or_ops]** D&D / free time 教育与还箱难投诉（含目的港协会声量）→ 继续船司条款+港 Pack 为裁判
- **[statute_or_ops]** 印尼 Zero ODOL 2027 / Pelindo·Kemenhub 治超 → 国别包跟官方；X 标热度不写法条
- **[statute_or_ops]** VGM SOLAS、ISPM15 为长尾合规教育（周热度低、90 天有基线）→ 保持官方 FAQ 深链
- **[ops]** 海关查验/仓储与 demurrage 时钟叠加主题上升但仍小样本 → 产品区分行政滞留 vs 承运人费
- **[product]** 关注层分权：A/B/C=market yellow；D/E/F/G=可核字段+官方 URL；勿把声量迁移误读为法规迁移

### 与 prior 7d 连续性

- Red Sea prior 7d=1200 与三旬抽样持续高相关 → 宏观地缘声量连续，非法条「转移」。
- Blank sailing 7d=24 与 M1–M3 均可检且与 WCI/Golden Week 同框 → 产能工具叙事连续。
- D&D 7d=70；清洁后仍为稳定商业条款层（教育+投诉）。
- ODOL 7d=36；Zero ODOL 2027 三旬都在 → 合规重量层未退潮。
- VGM 7d=2 但分月有基线 → 非热点迁出，属长尾。
- SCFI 7d=65；M1 查询几乎被股票垃圾号占满，M2/M3 有效帖回升——「C rising」含样本结构伪影，解读需谨慎。

## Gaps / next deepen

- 每格 1 页 25：红海真实声量远大于抽样（7d=1200）。深化可按周切片 + 多页，或固定权威账号 timeline。
- SCFI 必须白名单/`is:verified`，否则 M1 类垃圾号会扭曲类型轨迹。
- ODOL 继续 Pelindo/Kemenhub 限定，防牙膏 slang。
- 海关查询消费/搬家噪声多，G rising 需更多页验证。
- 命名事件未做跨源核实；落地仍以官方/船司 URL 为准。
- 原始：`data/_trend_90d_raw/`；摘要：`data/_attention_trend_90d.json`。
