<!-- #created 11/08/2026 -->
# CLAWHUNT X 样本量量化报告（第二轮扩样）

> 生成时间：2026-10-30（Asia/Shanghai）  
> 范围：X 全库 `search_posts_all`，约 2022-01-01 → 检索当日  
> 口径：按 post id 去重；分类见下。**不作市场规模证明。未做回复链深度挖掘（conversation 回复未批量拉取）。**

## 1. 样本量总表

| 指标 | 第一轮（2026-10-30 早） | 第二轮（本轮扩样） | 约倍数 |
| --- | ---: | ---: | ---: |
| 成功查询族（互补 query） | ~6 | **40** | ~6.7× |
| 成功 API 页（含翻页） | ~6–8 | **73** | ~10× |
| 原始命中（含跨 query 重复） | ~132 | **1273** | **~9.6×** |
| 去重后 unique post id | ~80–100（估） | **1204** | **~12×** |
| 单帖点开 / 回复链 | 1 / 0 | 0 / **0**（本轮未挖 conversation） | — |

### 分类（去重后，严格口径）

| 类别 | 数量 | 占比 | 定义 |
| --- | ---: | ---: | --- |
| **vendor_marketing** | **221** | 18.4% | 核心竞品官号（easycargo3d / cargoloader3d / truckpacker_app / LoadMas* / CargoOptixDxb / instadeepai 等）及明显产品号营销 |
| **organic_user（宽）** | **300** | 24.9% | 非官号，且文本与装载/过磅/工程货等物流相关 |
| 　└ 其中 **on_topic organic** | **157** | 13.0% | 明确触及装载规划软件、装柜/load plan、多站卸货序、Excel 装柜等 |
| 　└ 其中 **soft_related organic** | **143** | 11.9% | 过磅执法、工程货宣传、restack 抱怨等弱相关 |
| **adjacent_noise** | **683** | 56.7% | 隐喻 load、航运利用率宏观、服饰 Easy Cargo、学术刷屏、无关中文「倒货」等 |
| **on_topic（含 vendor）** | **243** | 20.2% | 全库与「装载规划产品/痛点」强相关 |
| **soft_related（含 vendor）** | **144** | 12.0% | 弱相关 |

说明：第一轮「~8 条有机硬证据」对应本轮 **on_topic organic ≈ 157** 中真正「吐槽/从业提问」仍稀疏；多数 on_topic organic 是行业新闻、学术、UPS 内部表扬、相邻 SaaS 叙事。可引用级新金句见第 4 节（约 **10–15** 条新增）。

## 2. 主题计数（去重帖文本正则；一帖可多主题）

### 全库 unique

| 主题 | 命中帖数 |
| --- | ---: |
| axle / weigh / overweight | 123 |
| 3D / visualization | 85 |
| utilization / CBM / cube | 83 |
| multi-stop / LIFO / unload order / 倒货 | 57 |
| irregular / project cargo / 异形工程货 | 51 |
| price / expensive / 贵 | 49 |
| Excel / spreadsheet / 纸面手工 | 36 |
| COG / weight distribution / 重心 | 33 |
| SAP / WMS / TMS / ERP / API | 27 |
| paper vs dock（reload/restack/didn't fit） | 17 |

### 仅 on_topic 子集（产品/痛点更干净）

| 主题 | 命中 |
| --- | ---: |
| software / SaaS / 软件 | 110 |
| 3D | 71 |
| multi-stop / LIFO / 卸货序 | 30 |
| utilization / CBM | 30 |
| Excel / 手工 | 19 |
| price | 10 |
| axle | 7 |
| integration | 5 |
| COG | 4 |
| paper vs dock | 2 |
| irregular | 2 |

### 核心官号营销卖点（200 条 from 核心账号）

| 卖点词 | 官号帖命中 |
| --- | ---: |
| 3D | 29 |
| Excel 替代 | 12 |
| multi-stop / grouping / 卸货序 | 11 |
| utilization | 10 |
| axle | 5 |
| reload/dock | 3 |
| price/trial | 3 |
| SAP/WMS/API | 2 |

## 3. 检索执行备注

- 工具：`x.search_posts_all`；`max_results` 请求 100，**API 实际封顶 25/页**；用 `pagination_token`/`next_token` 翻页。
- 时间：`start_time=2022-01-01T00:00:00Z`。
- 过滤：多数 query 带 `-is:retweet`；部分 organic 向 query 加 `-from:vendor`。
- **Rate limit（本轮末次有效响应附近）**：约 **916/1000 day** 剩余（日额重置 2026-10-31 00:00 UTC）；分钟额约 30/min，中途有等待。
- 无效请求：约 3–4 次错误 `next_token`（未计入成功页）。
- **未做**：大规模 conversation 回复拉取；LinkedIn/论坛。

### 40 个查询族一览（页数 / 原始命中）

见同目录检索过程文件；摘要：vendor `from:` 6 页 143 hits；CN 倒货/卸货序 3 页 67；轴重类合计百级；装载软件名/Goodloading/CLP 各数十。

## 4. 相对第一轮：结论有没有变？

**主结论不变，证据变厚：**

1. 「算满 + 3D + 按站分组」仍是红海（官号密集打 Excel / 3D / multi-stop）。
2. Excel/经验仍是货代默认基线（有机 + CargoOptix 问卷叙事仍在）。
3. 轴荷/过磅在 X 上**执法吐槽极多**，但多数是 CMV 临检，不是装载软件用户故事；产品含义仍成立，但勿把执法帖当 SaaS 需求量。
4. **新增强化**：开源/简易装柜工具需求（中文问 mac 装柜软件；有人自称在做「比 EasyCargo/GoodLoading 更好用」的 load planning）；WMS 大厂把 Load Builder 写进出库装载；演艺巡演用 TruckPacker 分享 load plan（跨行业 3D 装载）。
5. **新增边界**：异形/工程货在 X 上多为货代广告，很少「软件装不了异形」的有机长文；倒货/多港顺序有中文提问，但样本量仍小。
6. 价格吐槽仍稀，Daniel「为什么这么贵 / 付了数万美元」仍是最硬有机价格证据。

## 5. 新增有机金句（第二轮，非第一轮已引用）

1. [macOS 有装柜软件吗？类似装箱大师](https://x.com/just4v2ex/status/1560061849504186369) — 工具发现/平台缺口  
2. [正在做像 EasyCargo3d、GoodLoading 但更好用的 load planning](https://x.com/h_ngping/status/1976872334452732050) — 赛道仍有人进入，痛点=易用  
3. [货压拖车尾 → 上坡驱动轴没牵引力 = poor load planning](https://x.com/Touch4lyf/status/1533189813951766528) — 重心/轴荷与装载位置  
4. [不得不 restack 托盘，气疯了](https://x.com/Goldy_Souls/status/1485055896677851140) — 现场重码情绪成本  
5. [多港装卸是不是很麻烦，摆放顺序要安排好？](https://x.com/great_Aweaken24/status/1528174788908560384) — 多停靠顺序常识提问  
6. [且不说管制，卸货顺序等问题…](https://x.com/6K4H7zpl11pwwqd/status/1548474305297600513) — 卸货序作为约束被点名  
7. [国内装柜人工便宜才散装硬塞；改托盘要叉车场地，很麻烦](https://x.com/IanIanIanC/status/1684305299723935751) — 人工成本 vs 规范化装载  
8. [40 尺别超重；市内可躲磅站](https://x.com/Laosan34505203/status/2044196051339620594) — 超重合规现实（灰色）  
9. [早上看 load plan：3m 托盘塞不下，能不能另派车直送客户](https://x.com/SmokingWaffle/status/1950234060032528816) — 计划与异形尺寸冲突  
10. [Manual errors and inefficient load planning disrupt freight](https://x.com/mettlertoledo/status/1988898655290445886) — 计量/尺寸设备商侧面证实人工误差（偏厂商叙事，非纯用户）  
11. [开源 Python+OpenGL 集装箱配载可视化](https://x.com/findhappyman/status/2013598094668242987) — 中文开源替代冲动  
12. [Manhattan Active WM Load Builder：出库装载规划自动化](https://x.com/ManhAssocNews/status/1887664166040690811) — 大 WMS 把 load planning 产品化  

（第一轮金句 Daniel×2、Capernaum 多站、外贸 Excel+3D、Truck Packer 问卷、CargoOptix 基线问卷、QuijoteMike 等仍然有效，此处不重复占条。）

## 6. 对 CargoPlan / ClawHunt 的含义（更新后）

| 仍可站 | 仍不要说 |
| --- | --- |
| 多站顺序 vs 空间/轴荷是公开真问题 | X 上没人做多站 / 独家 3D |
| Excel 基线 + 贵/难用有有机信号（稀但硬） | 用官号曝光当 traction |
| 现场 restack / 计划塞不下是体验缺口 | 已服务机器人现场 |
| 差异切口仍是：异形约束可解释、倒货步骤可审计、Agent 证据链 | 把过磅执法帖数量当成付费用户池 |

---

原始页 JSON 缓存在执行机 `/workspace/x-research/raw/`（共 73 页）；本文件为量化结论稿。
