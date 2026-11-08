<!-- #created 11/08/2026 -->
# 国际海运常见 QA / 经验语料（含 X 大样本）

> Port Knowledge **v1.1** · as-of **2026-10-30**（Asia/Shanghai）  
> 目的：喂产品 FAQ / Port Pack「经验黄灯」——**不是**法规替代。  
> 证据分层：**官方 FAQ** > **船司/协会 dated 通知** > **X 有机帖** > **货代营销帖** > **论坛（Reddit 等）**。  
> X 原始计数与样例链：`data/x_maritime_qa_sample.yaml`。

---

## 0. 诚实声明（先读）

1. X 上「海运专业帖」噪声极大：货代广告、加密项目蹭词、AI 推广刷帖。本语料**已按主题人工聚类**，并标注 `organic | media | promo | noise`。  
2. **近 7 天**精确检索计数偏低（专业词稀疏）；扩大到 **2023–2026 全量归档**后按主题拉页，单次 API `max_results` 上限约 25/查询，多查询合计 **约 140+ 帖命中（去重前）**，去重后保留 **~95 条有标签样例**写入 YAML。  
3. 中文「超重柜/VGM/印尼」组合在 X 上**远少于**「滞箱/滞港」；印尼话题以 **ODOL 公路执法**为主，而非「柜内 stuffing 禁令」。  
4. Reddit `r/freightforwarding` 等作**二级**补充（WebSearch 摘要），标签 `forum_secondary`。

---

## 1. 主题簇总表（产品可直接挂 FAQ）

| Cluster ID | 主题 | 主要证据源 | X 粗估强度* | 产品动作 |
| --- | --- | --- | --- | --- |
| C1 | **Demurrage vs Detention vs Storage/堆存** | 船司 glossary、中文货代科普帖、大量 X 教育帖 | **高**（教育帖重复多） | 分时钟展示；非行政罚 |
| C2 | **VGM 缺失 / 晚交 / 误差 / 责任在 BL shipper** | IMO MSC.1/Circ.1475；印尼 PM 25/2022；Reddit SI/VGM；X 实务帖 | **中** | 红灯：无 VGM；黄灯：公差 |
| C3 | **超重柜 / CSC max / 公路限重 ≠ ISO 柜 payload** | CSC；各国公路法；X 轴重讨论 | **中** | 三层限重对照 |
| C4 | **印尼 ODOL（出门公路）** | UU 22/2009；Kemenhub；Kompas/X 媒体 | **高（ID）** | ID Port Pack |
| C5 | **Rolled cargo / shut-out / blank sailing** | 船司 market update、X 货代 | **中高** | 舱位缓冲提示 |
| C6 | **ISPM15 / 熏蒸 / 木包装拒收** | IPPC；印尼检疫；X 多为营销 fumigation | **中低有机** | 木包装 checklist |
| C7 | **错报重量 / misdeclaration / packing list 错** | 执法新闻、货代经验 | **中低 on X** | 申报一致性 |
| C8 | **Restow / 倒柜费用** | 船司 tariff（公开少） | **低 on X** | 待核实费率 |
| C9 | **偏载 / 装柜照片 / 破损索赔** | CTU；X 装柜教育 | **中低** | 装柜证 |
| C10 | **弃货 → 发货人扛目的港滞箱滞港** | 中文货代经验帖 | **中（ZH）** | 收款节点建议 |

\*强度 = 本轮检索命中规模与重复度，非正式统计总体。

---

## 2. 官方 / 协会 FAQ（高公信力骨架）

| Q | A（压缩） | 出处 |
| --- | --- | --- |
| 什么是 VGM？谁负责？ | SOLAS VI/2：装船前须有 Verified Gross Mass；**shipper** 负责提供。 | [IMO VGM](https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx) · [MSC.1/Circ.1475](https://wwwcdn.imo.org/localresources/en/OurWork/Safety/Documents/MSC.1%20Circ.1475.pdf) |
| Method 1 / 2？ | 1=整柜称重；2=分项累加+柜皮。 | 同上；印尼 PM 25/2022 Pasal 39 |
| 无 VGM？ | **不得装船**（各国实施细则不一；印尼写死）。 | IMO；PM 25/2022 Pasal 38 |
| Demurrage vs Detention？ | Demurrage≈箱在**码头内**超 free time；Detention≈箱在**码头外**未按时还空。 | 行业通行定义；X 大量教育帖一致 |
| CTU 管什么？ | 装载与系固非强制公约但行业基准。 | [UNECE CTU](https://unece.org/transport/documents/standards/ctu-code) |
| ISPM15？ | 国际贸易木包装热处理/熏蒸标记。 | [IPPC ISPM15](https://www.ippc.int/) |

---

## 3. 印尼相关（政策 × X）

### 3.1 可核政策（详见 `02b_indonesia_national.md`）

- Overload 法定罚金上限常被引用为 **Rp 500.000**（Pasal 307）；Over dimension / uji tipe 语境 **Rp 24.000.000**（Pasal 277）。  
- Zero ODOL：**2025 加强执法既有法**，目标年多报 **2027**；港口是重点卡口之一。  
- VGM：PM 25/2022；码头复称 **5%**；超 CSC 禁装。  
- 商业：Maersk WDF **USD 300**（>3 t 差 / 超 CSC / VGM&lt;tare）。

### 3.2 X 印尼簇观察（2024–2026）

- 媒体账号（Kompas、kumparan、SINDOnews、CNBC Indonesia）密集发 **Zero ODOL / 司机抗议 / 2027**。  
- 有机讨论：司机 vs 货主责任（「公司逼超载、罚司机」）；港口出场重车与 ODOL 关系。  
- **标题「Rp50 miliar」类**：作舆情信号，**不作罚金字段**（待核实立法）。  
样例：  
- https://x.com/kompascom/status/1933815591330345361（Zero ODOL 自 2025-06-01）  
- https://x.com/pasfm/status/2014548688652455983（2026 试验执法→2027）  
- https://x.com/soberbuthappy/status/1936104291959455936（司机被刑事化担忧，提 Pasal 307）  
- https://x.com/media_akurat/status/2086744451846897746（2027 罚金——**金额待核实**）

---

## 4. 国际实务 QA（聚类详解）

### C1 · 滞期 / 滞箱 / Free time

**常见问法：** Demurrage 和 Detention 有什么区别？Free time 几天？  
**经验要点：**  
- 两个钟、两张账单；free time 因船司×码头×合约而异（常见转述进口 3–7 天——**非统一法规**）。  
- 中文区分：STORAGE/堆存、DETENTION/滞箱、DEMURRAGE/滞期（码头内）——见 https://x.com/Vita1945598/status/1851877069762056297  
- 货代口头「包过」不挡查验后滞港——https://x.com/aaugeART/status/2100073714545205535  
- 弃货风险：目的港费用可能回追发货人——https://x.com/APBLOODTYPE/status/2107425676563464254  

**X 特征：** 教育帖与营销帖大量重复同一对比图；计入「高曝光、低新颖」。

### C2 · VGM

**常见坑：** SI 重量 ≠ VGM；用了旧 tare；超 CSC；晚于 cutoff。  
**证据：**  
- Reddit：SI/VGM 一字之差可拖柜产 demurrage（`r/freightforwarding` 摘要）。  
- X：India ±1000 kg 公差误区帖（促销号，作线索）https://x.com/_shipping_sssm_/status/2077613860840997286  
- 印尼法定 5% 复称规则（PM 25/2022）优先于民间数字。  
- Maersk ID WDF USD300（承运人费）。

### C3 · 超重与限重三层

1. **柜**：CSC max gross  
2. **船**：VGM / 船司政策  
3. **路**：轴载 / 总重 / 道路等级（印尼 MST 10/8 t；中国六轴 49 t 等）  

X：https://x.com/DuncanMaritime/status/2045493603594608662（payload 计算教育）

### C5 · Rolled / shut-out

**经验：** 「船开了」≠「你的柜在船上」；旺季/台风/blank sailing 后 rolled 连锁 demurrage。  
样例：https://x.com/GuoDavid/status/2114916498036732410 · https://x.com/UniversalCargo/status/2016922659477758168

### C6 · ISPM15

有机拒收故事在 X 上少于营销「fumigation 服务」帖。仍应 checklist。官方优先于 X。

### C8 · Restow

本轮 X **几乎无可靠费率帖** → 标 **待核实**；产品勿编造 restow USD。

---

## 5. 检索方法与局限（可复现）

**工具：** Grok Bot 内置 `x.search_posts_all` / `get_posts_counts_recent`（全量归档 + 近 7 天计数）。  

**查询族（节选）：**  
EN: ODOL+kontainer, VGM+fine/mismatch, demurrage|detention+container, shut out|rolled cargo, ISPM15+reject, CSC+overweight  
ZH: 滞箱|滞港|超重柜|VGM + 海运|货代|集装箱  
ID: ODOL+denda|Zero|Menhub|Korlantas  

**局限：**  
- `max_results` 单次封顶；分页未穷尽全部历史。  
- ZH 超重柜命中被无关帖污染，有效帖少于 EN demurrage。  
- 促销与「收据链」刷帖需人工降权。

---

## 6. 对 CargoPlan 的直接产品启示

1. Port Pack 对 **ID** 必须同时亮：**VGM / CSC / ODOL-JBI**。  
2. FAQ 首页优先 **C1+C2+C5+C4**（样本与投诉密度最高）。  
3. 所有金额字段分 `statutory_cap` vs `carrier_fee` vs `rumor_unverified`。  
4. X 只作「话题热度与措辞」，**裁判仍看官方 PDF**。
