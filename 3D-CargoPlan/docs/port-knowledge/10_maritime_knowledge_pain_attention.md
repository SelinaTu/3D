<!-- #created 11/08/2026 -->
# 航运/海运知识痛点 · 科普主题 · 公众关注（缺口分析）

> Port Knowledge **v1.2 调研附篇** · as-of **2026-10-31**（Asia/Shanghai）  
> 服务对象：CargoPlan / ClawHunt · **Knowledge Globe / Port Pack**（不是浅 FAQ 清单）  
> 证据：本地 `09_*` + `CLAWHUNT_X_*` + 本轮 X 新鲜检索（≥14 查询族）+ 官方/协会次级（IMO VGM、FIATA D&D、Maersk glossary）  
> 原则：**金额不编造**；X = 措辞/热度黄灯；裁判 = 官方 PDF / 船司 dated tariff。

---

## A. 三张表（主交付）

### A1 · 知识痛点（从业者真正卡壳、易亏钱/延误）

| # | 痛点 | 谁痛 | 证据强度 | 已进 Port Pack / 库？ | 缺口（产品要补什么） |
| ---: | --- | --- | --- | --- | --- |
| P1 | **Demurrage / Detention / Storage 三钟 + Free time 不透明**；查验/约车失败后时钟仍走 | 货主、货代、进口商 | **高**：FIATA/Maersk 定义一致；X 教育帖海量；近 7d EN demurrage\|detention **58**；中文滞箱簇归档有机吐槽（弃货追责、口头「包过」） | 部分：FAQ 骨架在 `09`；国别包**无** carrier×港 free time | 深港需 `free_time_hints`（标 commercial、待核实）；时间线 L4 承运人费与堆存分开 |
| P2 | **VGM 缺失/晚交/误差/责任在 BL shipper**；SI≠VGM；无 VGM 禁装 | 发货人、订舱货代 | **高（官方）/ 低（近 7d X）**：IMO MSC.1/Circ.1475；CN/ID 国别已写；近 7d 精确 VGM+fine **0**；归档仍有实务帖 | **已进**：CN/ID `vgm`；公约层 L1 | 骨架国复称公差表；码头复称优先规则；勿写死「印度 ±1000kg」类民间数 |
| P3 | **限重三层错位：CSC 柜 / VGM·船司 / 公路轴载·ODOL** | 拖车、货主、印尼司机 | **高（ID 政策+媒体）/ 中（实务）**：UU 22/2009；Zero ODOL→2027；近 7d ODOL **21**；精确「超重柜+罚款」近 7d **0** | **已进**：CN 公路表+罚则；ID ODOL 专章；深港 22 个有限 | Pelindo 出门吨位牌；KR/MY/AE 公路罚表（meta.gaps）；JBI≠ISO payload 对照 UI |
| P4 | **Rolled / shut-out / blank sailing → 连锁滞箱与改配成本** | 货主、货代、订舱岗 | **中**：归档「what is rolled」教育+从业帖（如 GuoDavid）；真词近 7d `"rolled cargo"` **仅 2**；宽「甩货」易被体育/隐喻污染 | FAQ 簇 C5 有；港 Pack **无**「甩柜连锁费用」字段 | 时间线提示：甩柜后 demurrage 风险；不预测舱位；链到 blank sailing 市场黄灯 |
| P5 | **海关查验 / hold 期间费用归属不清** | 进口商、货代 | **中**：归档 customs hold + demurrage 同现；近 7d customs 语境 **17**；官方无统一「谁停钟」 | 未结构化进 Pack | Port Pack checklist：查验→联系谁、钟是否继续（**待核实/合约**） |
| P6 | **承运人杂费不透明（WDF、per diem、restow）** | 货主 CFO、货代 | **中低 on X**：Maersk ID WDF 有出处；restow 近 7d **5**、归档几乎无可靠费率；meta 已承认缺口 | 仅示例级（Maersk ID WDF） | L4 分 `carrier_fee` vs `statutory`；restow **禁止填 USD**；按船司 tariff URL 渐进 |
| P7 | **弃货 / 目的港费用回追发货人** | 出口商 | **中（ZH 有机）**：`09` 样例链；非法规条文 | FAQ 经验黄灯 | 收款节点/放单建议（产品文案），非法条 |
| P8 | **木包装 ISPM15 拒收** | 出口包装、货代 | **中低有机 / 高营销**：近 7d **12**；归档大量 fumigation 广告 | checklist 骨架 | 官方 IPPC 优先；拒收案例极少，勿用广告当罚则 |
| P9 | **重量/品名 misdeclaration** | 发货人、船司安全 | **中低**：归档有安全叙事；近 7d **12**；执法新闻偶发 | 申报一致性提示弱 | 红灯：VGM/packing list/BL 一致性；金额仍待核实 |
| P10 | **柜内 stuffing 港别禁令 / 出门吨位（结构化）** | 规划引擎、合规 | **本地缺口声明**：全球几乎无机器可读 stuffing 禁令；Priok 45t 未核实 | **未进**（诚实标薄） | **P0 深挖**：官方码头公告，不靠 X |

**与装载产品痛点的关系（勿混）：**  
`CLAWHUNT_X_*` 那套（Excel→3D、多站倒货、轴荷）是 **CargoPlan 规划能力** 痛点；本表是 **条款/港口规则** 痛点。Globe 应服务后者；前者进 Demo/Agent，不靠港点密度假装已解决。

---

### A2 · 科普在讲什么（货代/媒体/船司教育帖高频）

| # | 主题 | 典型话术 | 可信度 | 对产品启示 |
| ---: | --- | --- | --- | --- |
| E1 | **Demurrage vs Detention vs Free time** | 「码头内 / 码头外两个钟」；「free time 过后才开始计费」 | **高**：与 Maersk Logistics Explained、FIATA Best Practice 一致 | Globe 侧栏默认科普卡；金额勿统一写「3–7 天」为法规 |
| E2 | **VGM 是什么、谁负责、Method 1/2** | 「无 VGM 不装船」；「责任在 shipper」 | **高**：IMO SOLAS VI/2、Circ.1475 | L1 公约固定文案 + 国别实施差异折叠 |
| E3 | **Blank sailing / 运力管理解释运价** | 「船司砍航班撑价」；SCFI/WCI 周报话术 | **中**：市场机制描述；非单票条款 | 首页「市场黄灯」可选层，**不进**罚则字段 |
| E4 | **Rolled cargo 是什么** | 「船开了≠你的柜在船上」 | **中高定义 / 低单票证据** | FAQ + 跟踪自查提示 |
| E5 | **ISPM15 / 熏蒸** | 「无标记=拒收/罚款」 | **定义高 / 罚金话术低**（广告夸张） | 只引用 IPPC；拒收流程 checklist |
| E6 | **印尼 Zero ODOL** | 「2025 加强 / 2027 目标」；司机 vs 公司责任 | **政策方向高**；「Rp 500 亿」类 **不可信** | ID Pack 用 UU 条文；舆情金额 `rumor_unverified` |
| E7 | **隐藏附加费 / folklore clocks** | 「BAF、THC、detention ladder 藏在门户后」 | **情绪真、数字常虚**；本轮夹杂 AllScale/GMT+7 刷帖 | 产品卖「可审计时间线」；过滤促销链 |

官方科普锚点（次级 Web）：  
- IMO VGM：https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx  
- Maersk D&D：https://www.maersk.com/logistics-explained/transportation-and-freight/2023/08/28/what-is-demurrage-detention-in-shipping-for-buyers  
- FIATA D&D Best Practice（协会口径）

---

### A3 · 大家在关注什么（近 7 天热度 + 归档簇）

> 计数工具：`x.get_posts_counts_recent` · 窗口约 2026-10-24 → 10-31 · `-is:retweet`  
> **注意**：宽词会污染；表内「校正」列以更严 query 为准。

| 热度序 | 主题 | 近 7d count | 与「条款知识」关系 | 备注 |
| ---: | --- | ---: | --- | --- |
| 1 | **红海 / 地缘 × 航运运价** | **769** | **弱（宏观）** | 最大声量；影响运价与绕航叙事，不替代 Port Pack 字段 |
| 2 | Demurrage/Detention（EN） | **58** | **强** | 持续教育+投诉混合；条款相关 |
| 3 | 运价 / spot / SCFI 语境 | **42** | **弱–中** | 市场关注；可作黄灯 |
| 4 | Free time + D&D | **24** | **强** | 与 P1 同簇 |
| 5 | ODOL / Zero ODOL | **21** | **强（ID 公路）** | 媒体+有机；港口卡口叙事 |
| 6 | Blank sailing | **20** | **中** | 运力/运价解释 |
| 7 | Customs hold 语境 | **17** | **中–强** | 常连带 demurrage |
| 8 | ISPM15 / fumigation | **12** | **中** | 广告比例高 |
| 9 | Misdeclaration 语境 | **12** | **中** | |
| 10 | 中文 滞箱/滞港/滞期 | **5** | **强但稀疏** | ZH 专业词在 X 上少 |
| 11 | Restow | **5** | **强需求 / 弱语料** | 费率几乎挖不到 |
| 12 | `"rolled cargo"` 严口径 | **2** | **强但冷** | 宽「甩货」「shut out」曾到 200+/800+ → **体育/隐喻污染，作废** |
| 13 | 甩柜+船司/舱位（ZH 严） | **2** | **强但冷** | |
| 14 | VGM+fine/mismatch 严口径 | **0** | **关键条款但近周无热帖** | **不能用近 7 天热度否定 VGM 产品优先级** |
| 15 | 超重柜+罚款严口径 | **0** | 同上 | 执法在公路/码头，不在 X 刷屏 |

**归档簇强度（既有 v1.1 + 本轮页样本，非正式总体）：**  
ODOL、D&D 教育、blank sailing/运价、rolled 定义 > VGM 实务 > ISPM15 有机 > restow 费率。

**本轮归档拉页：** 15 查询 · API `result_count` 合计 **约 320** · 去重 unique **303** · 标签粗分 organic≈272 / media≈14 / promo≈15 / noise≈2（**organic 含一批「GMT+7 folklore / receipts」模板刷帖，实际有效有机低于字面**）。

---

## B. 结论（给 Knowledge Globe / Port Pack）

### 什么该进 Knowledge Globe **深挖**
1. **Free time × Demurrage × Detention × Storage** 分时钟模型（按船司×码头渐进，标 commercial）  
2. **VGM / 无 VGM 禁装 / 国别复称**（已有 CN/ID，扩骨架国实施细则）  
3. **限重三层 + ODOL/公路出门**（ID 厚化：Pelindo 吨位牌；CN 已有轴载表）  
4. **查验/hold 与费用钟是否并行**（合约/港实践，诚实「待核实」）  
5. **甩柜后费用连锁**（定性 checklist，不编造金额）

### 什么只做 FAQ **黄灯**
- Demurrage vs Detention 名词科普（已高度标准化）  
- Blank sailing / SCFI 运价解释（市场层）  
- ISPM15「要有标记」级常识（广告话术降权）  
- 「船开了要自己查 tracking」类操作提示  
- 弃货追责经验帖

### 什么 **不该用 X 当裁判**
- 任何 **罚金/费率具体数字**（含 Rp50 miliar、restow USD、统一 free time 天数）  
- Pelindo / 码头现行出门吨位  
- 柜内 stuffing「某港禁止某种装法」传说  
- 近 7 天热度为 0 的主题（如 VGM）→ **不等于不重要**

### 诚实：样本量与局限
| 来源 | 量级 | 能证明什么 | 不能证明什么 |
| --- | --- | --- | --- |
| 地球仪港点 | 11,835 thin / 22 deep | 地图密度 | 条款完备 |
| 国别包 | 厚 2 + 骨架 7 | 规则骨架 | 全球罚则全表 |
| X 装载产品痛点（早） | 40 查询 · ~1204 unique · on_topic organic ~157 | 规划赛道红海/切口 | 港口罚则 |
| X 海运条款 v1.1 | 11 查询 · ~140 raw · ~40 标签样例 | 主题簇方向 | 字段级完备 |
| **本轮新鲜 X** | **14+ counts · 15 archive 页 · ~303 unique** | 近周关注排序；科普话术 | 市场规模；费率真值 |
| 官方/协会 | IMO / FIATA / Maersk 文 | 定义与责任 | 各港操作细节 |

**总判：** 公众近周盯的是 **地缘×运价**；从业教育反复讲的是 **D&D/Free time 与 VGM**；真正亏钱缺口仍是 **港×船司可执行字段**（free time、出门吨位、杂费表）。Globe「密」应用 **深港字段密度** 衡量，不是 LOCODE 点数。

---

## C. Append · 本轮 X 查询与样例

### C1 · 近 7 天 counts

| id | query（摘要） | total_tweet_count |
| --- | --- | ---: |
| c01 | `(demurrage OR detention) (container OR shipping) -is:retweet` | 58 |
| c02 | `(滞箱 OR 滞港 OR 滞期) (集装箱 OR 海运 OR 货代) -is:retweet` | 5 |
| c03 | `VGM (container\|shipping\|柜) (fine\|mismatch\|late\|罚款\|cutoff) -is:retweet` | 0 |
| c04 | `(ODOL OR "Zero ODOL") (kontainer\|truk\|overweight\|denda) -is:retweet` | 21 |
| c05 | `("rolled cargo" OR shut-out OR 甩货) …` **宽** | 203 **（污染，作废作排序）** |
| c05b | `"rolled cargo" (container\|shipping\|booking\|vessel\|forwarder)` **严** | **2** |
| c05c | `(甩柜 OR 被甩货 OR 甩货) (船司\|舱位\|海运\|集装箱\|订舱)` **严** | **2** |
| c06 | `("blank sailing" OR "blank sailings") …` | 20 |
| c07 | `("freight rate" OR "spot rate" OR SCFI OR 运价 OR 现货运价) …` | 42 |
| c08 | `("free time" OR freetime) (demurrage OR detention OR container)` | 24 |
| c09 | `(ISPM15 OR ISPM-15 OR fumigation) (container\|wooden\|…)` | 12 |
| c10 | `("customs hold" OR 查验 OR 卡关) …` | 17 |
| c11 | `(restow OR restowing OR 倒柜) …` | 5 |
| c12 | `(misdeclaration OR wrong weight OR 错报 OR 瞒报重量) …` | 12 |
| c13 | `(超重柜 OR overweight container) (罚款\|fine\|VGM\|…)` | 0 |
| c14 | `("Red Sea" OR 红海 OR Cape… OR 绕航) (shipping\|freight\|运价\|…)` | **769** |

### C2 · 归档 search_posts_all（max_results=25，去重后见 JSON）

原始页缓存摘要：`data/_pain_attention_x_run.json`  
`raw≈320` · `unique≈303` · 分簇 API result_count：demurrage_edu 24 · zh_detention 21 · vgm 14 · odol 24 · rolled 25 · blank_sailing 25 · spot_rate 24 · free_time 22 · ispm15 25 · customs 25 · restow 9 · misdecl 23 · zh_shuaihuo 22 · red_sea 21 · zh_yunjia 16。

### C3 · 样例 URL（每簇≤3，优先非广告）

| 簇 | kind | url | 备注 |
| --- | --- | --- | --- |
| D&D 时钟 | organic | https://x.com/rodericuss/status/2019639683538645359 | free-time / demurrage ladders |
| D&D 时钟 | organic | https://x.com/RadioSpook/status/2021434689261797533 | surcharge + rolled folklore（模板帖，降权） |
| ODOL | organic/media | https://x.com/e100ss/status/2000811708101910685 | Zero ODOL 2027 |
| ODOL | media-ish | https://x.com/soloposdotcom/status/1945742205592723690 | 政策讨论 |
| Rolled | organic | https://x.com/GuoDavid/status/2114916498036732410 | 「船开了≠柜在船上」 |
| Rolled | promo/edu | https://x.com/integralcargo/status/1750134016835993995 | what is rolled cargo |
| Blank/rates | organic | https://x.com/tatin17/status/1966417125674725631 | SCFI + blank sailing |
| Spot | organic | https://x.com/Ole_S_Hansen/status/2034619655696871728 | Drewry 指数 |
| Free time | organic | https://x.com/maphumanintent/status/1853536981902315838 | 约车系统 vs detention 吐槽 |
| ISPM15 | promo | https://x.com/shahworldtrade/status/2011715688797528241 | 熏蒸营销（降权） |
| Misdecl/VGM | organic | https://x.com/RahatTalreja/status/2065055590142062942 | wrong VGM 安全叙事 |
| 运价 ZH | organic | https://x.com/fingraph66/status/2034399950876954775 | 红海×运价 |
| 甩货/运力 ZH | organic | https://x.com/AsksReceives/status/2087157453343375510 | 运费翻番/绕航（宏观） |
| 既有弃货 | organic | https://x.com/APBLOODTYPE/status/2107425676563464254 | 目的港费用回追（v1.1） |
| 既有 ZH D&D | organic | https://x.com/Vita1945598/status/1851877069762056297 | STORAGE/DETENTION/DEMURRAGE |

### C4 · YAML 速记

```yaml
as_of: "2026-10-31"
timezone: Asia/Shanghai
fresh_x:
  count_queries: 16  # including refined rolled/甩货
  archive_queries: 15
  archive_raw_posts: ~320
  archive_unique_ids: ~303
  note: >
    Wide shut-out/甩货 counts discarded for ranking.
    Strict rolled cargo 7d=2; VGM fine 7d=0; Red Sea 7d=769.
prior_corpus:
  maritime_qa_v1_1: {queries: 11, raw_approx: 140, labeled: ~40}
  load_planning_pain: {queries: 40, unique: 1204, on_topic_organic: 157}
globe_meta_gaps:
  - thin ports majority
  - Pelindo gate tonnage
  - carrier accessorials beyond Maersk ID WDF
  - KR/MY/AE road fines
  - no machine-readable stuffing bans
```

---

*本文件服务产品缺口决策；不构成法律或运价建议。*
