<!-- #created 11/08/2026 -->
# X 竞品与痛点速查（2026-10-30）

口径：公开帖检索；竞品官号内容记为「市场叙事」；独立用户帖记为「有机信号」。样本量有限，不作市场规模证明。

## 活跃/相关产品账号（X）

| 账号 | 定位 | 备注 |
| --- | --- | --- |
| [@easycargo3d](https://x.com/easycargo3d) | 卡车/集装箱装载 SaaS，浏览器端 | 官号发帖密集，明确卖点：Excel 替代、轴重、多站分组、3D |
| [@cargoloader3d](https://x.com/cargoloader3d) | 免费在线装载 | 强调按卸货优先级 Grouping，适合多站 |
| [@LoadMas83325827](https://x.com/LoadMas83325827) | LoadMaster 装载率/效率 | 客户反馈向营销 |
| [@instadeepai](https://x.com/instadeepai) DeepPack | AI 3D packing + routing | 空运货会等 B2B AI 叙事 |
| [@truckpacker_app](https://x.com/truckpacker_app) | 厢式车装箱 | 直接问用户：先按重量还是先按站点顺序 |
| 中文开源向 | [@findhappyman](https://x.com/findhappyman) 等 | Python/OpenGL 集装箱配载可视化 |

## 反复出现的痛点主题

### 1. Excel / 人工规划慢且易错（竞品主打，有机侧也有）
- EasyCargo 反复攻击：Excel 耗时、无法脑补三维、到港发现对不上、临时加两托又要重算一夜。
- 中文外贸讨论：合格业务员用纸图 → Excel + 3D；装柜额外人工 vs 多装几箱运费要权衡（[@qiangwaizhenhua](https://x.com/qiangwaizhenhua/status/1967164241217286223)）。
- 独立发问：香港用什么软件做不同尺寸货模拟装箱（[@gaoweimaster](https://x.com/gaoweimaster/status/2031200597563838733)）；做 3D packing 难在时间 vs 近优 + 用户约束爆炸（[同作者](https://x.com/gaoweimaster/status/2035555379464348072)）。

### 2. 多站装卸顺序 / 倒货（与我们 Demo 最对齐）
- 从业提示：多站区域配送要把路线与装载顺序一起审，避免卸 A 时挪后面站的货（[@Capertransport](https://x.com/Capertransport/status/2115511507513385350)，2026-10-28）。
- EasyCargo 梗图：「最后一站货在车头最里面」；四仓一路到站发现托盘埋在尾部 → 路边重排 = 油耗、安全、延误（[Jan](https://x.com/easycargo3d/status/2014006322572796383)、[Oct](https://x.com/easycargo3d/status/2113652918943617099)）。
- CargoLoader3D：Grouping = 按卸货优先级组织，关 Grouping 则纯空间优化（[帖](https://x.com/cargoloader3d/status/1889932563445362784)）。
- Truck Packer 问调研：多站 box truck 先按重量还是先按停靠顺序？（[帖](https://x.com/truckpacker_app/status/2110471246072737935)）→ **重量/轴荷 vs 卸货序是真实权衡，不是伪需求。**

### 3. 轴重 / 过磅罚款 / 重心
- 竞品高频：装完才发现轴超 → 过磅站重装；重心偏导致看似体积够仍罚。
- 对黑客松：我们已有重心展示；若 Demo 做卡车可加「轴荷」一句话；集装箱场景可弱化轴荷、强化遮挡倒货。

### 4. 纸面方案 vs 现场装卸现实
- 「纸上完美，码头多耗 40 分钟；托盘要重排、轴荷不对、司机发火」；「Excel 说 fit，码头说重来」。
- 含义：只出坐标不够，要能解释通道/支撑/卸货步骤——正是 Agent 解释 + 3D 步进的卖点。

### 5. 价格与上手成本
- 有机帖：[Why is container packing software so expensive?](https://x.com/DanielW_Kiwi/status/1805529114730020953)（524 曝光，6 赞）。
- EasyCargo 反面营销：别上要顾问才能配的工具；拖 Excel → 立刻 3D；新人 Day1 手册。
- 商业化叙事可用：中小承运商觉得「贵 / 重」，需要轻量、中文约束、可审计，而不是又一个重 SaaS。

### 6. 末端仍大量人工（机器人叙事边界）
- UPS 枢纽：卸/装集装箱内包裹仍大量人工码放（中文讨论）。
- 港口 5G 远程装卸火，但**柜内作业序列**仍空白 → 我们输出「任务草案」合理，勿宣称已控机。



### 有机金句（非官号）
- Daniel（NZ）：[付了好几万美元买托盘装箱软件，赛道贵且不够好，我们仍没有想要的方案](https://x.com/DanielW_Kiwi/status/1689358466819977216)。
- 另帖：[为什么集装箱装箱软件这么贵？](https://x.com/DanielW_Kiwi/status/1805529114730020953)
- 运输圈评论：有的公司路线/装载规划极好，另一端朋友因规划还在 Excel 而辞职（[QuijoteMike](https://x.com/QuijoteMike/status/1670062507312963584)）。
- CargoOptix（迪拜新玩家）在问货代：客户问「装得下吗」你用 Excel CBM、经验、软件还是打电话问仓？（[帖](https://x.com/CargoOptixDxb/status/2108059951683785084)）——说明默认基线仍是 Excel/经验。

## 对 CargoPlan Agent 的含义

| 可站得住 | 不要乱说 |
| --- | --- |
| 多站顺序与空间利用率冲突是公开讨论的真问题 | 「X 上没人做过多站」——EasyCargo/CargoLoader 已明确做分组 |
| 纸面方案与现场倒货/重排是痛点 | 「我们独家 3D」 |
| 复杂约束 + 可解释阻挡/倒货次数是差异切口 | 「已服务机器人现场」 |
| Excel 仍是默认基线，付费意愿在「少罚/少倒货/可给客户看 3D」 | 用竞品官号点赞数当 traction |

## 黑客松可用的一句话证据（路演）

> 多站司机最怕「最后一站货压在最里面」；调度在「轴重/稳性」和「卸货顺序」之间拉扯——现有工具多做分组装载，很少把**遮挡导致的倒货步骤**讲清楚并再校验。



## 样本量升级（第二轮｜2026-10-30）

> 目标：相对第一轮（~132 raw / ~80–100 unique）扩大约一个数量级。完整量化表见同目录 [CLAWHUNT_X_SAMPLE_QUANT.md](./CLAWHUNT_X_SAMPLE_QUANT.md)。

### 执行量

| 项 | 数值 |
| --- | ---: |
| 互补查询族 | **40** |
| 成功 API 页（含翻页） | **73** |
| 原始命中（含重复） | **1273**（≈第一轮 9.6×） |
| 去重 unique id | **1204**（≈第一轮 12×） |
| vendor_marketing | **221** |
| organic_user（物流相关宽口径） | **300**（其中 on_topic **157** / soft **143**） |
| adjacent_noise | **683** |
| 回复链深度 | **0**（本轮未拉取 conversation） |
| 日额度余量（末次附近） | ~**916/1000** day left |

时间窗：`2022-01-01` → 检索日；中英双语；`-is:retweet`；部分 `-from:vendor`。

### 主题计数（unique 文本，可多标）

全库最高频：轴重/过磅 **123**、3D **85**、利用率/CBM **83**、多站/LIFO/卸货序 **57**、异形/工程货 **51**、价格 **49**、Excel/手工 **36**、重心 **33**、集成 **27**、码头重排/装不下 **17**。  
官号仍主打：3D、Excel 替代、multi-stop grouping、利用率。

### 第二轮新增有机信号（节选）

- 中文求装柜软件：[macOS 有类似装箱大师的吗？](https://x.com/just4v2ex/status/1560061849504186369)
- 有人在做「比 EasyCargo / GoodLoading 更简单」的 load planning：[帖](https://x.com/h_ngping/status/1976872334452732050)
- 装载位置导致驱动轴没牵引力 = poor load planning：[帖](https://x.com/Touch4lyf/status/1533189813951766528)
- 现场被迫 restack 托盘的情绪成本：[帖](https://x.com/Goldy_Souls/status/1485055896677851140)
- 多港装卸要排摆放顺序的常识提问：[帖](https://x.com/great_Aweaken24/status/1528174788908560384)
- 卸货顺序被当作硬约束提起：[帖](https://x.com/6K4H7zpl11pwwqd/status/1548474305297600513)
- 国内人工便宜 → 散装硬塞；托盘化改造麻烦：[帖](https://x.com/IanIanIanC/status/1684305299723935751)
- load plan 清晨发现超长托盘塞不下、要另派车：[帖](https://x.com/SmokingWaffle/status/1950234060032528816)
- 中文开源配载可视化持续出现：[@findhappyman](https://x.com/findhappyman/status/2013598094668242987)
- 大 WMS（Manhattan Load Builder）把出库装载规划产品化：[帖](https://x.com/ManhAssocNews/status/1887664166040690811)

### 结论是否变化？

**没有推翻第一轮。** 红海能力集（Excel→3D、多站分组、轴荷叙事）更清楚；有机硬吐槽仍稀，但「易用性缺口 / 现场 restack / 多停靠顺序 / 超重现实」证据略增。差异化叙事仍建议：**异形·工程约束 + 逐站倒货可解释 + Agent 证据链 + 可审计作业草案**，而不是再做一个分组 3D。


## 检索备注

- 工具：X 全库 `search_posts_all`；中英查询；第一轮约 2023–2026，第二轮扩至 **2022–2026**。
- 第二轮量化：见上文「样本量升级」与 `CLAWHUNT_X_SAMPLE_QUANT.md`（1273 raw / 1204 unique）。
- 局限：垂直物流从业者更多在 LinkedIn/论坛；X 上有机吐槽稀疏，竞品官号与无关 load 隐喻噪声高；**未做回复链挖掘**。
