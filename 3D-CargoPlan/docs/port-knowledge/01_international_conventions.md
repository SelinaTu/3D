<!-- #created 11/08/2026 -->
# 01 · 国际公约与全球实践守则

> as-of 2026-10-30 Asia/Shanghai · 只记要点 + 官方链接；**非全文译本**。

---

## 1. SOLAS · Verified Gross Mass（VGM）

| 项 | 内容 |
| --- | --- |
| 法律位置 | 《国际海上人命安全公约》第 VI 章第 2 条修正（MSC.380(94)）；2016-07-01 生效 |
| 核心义务 | **托运人**负责验证装箱集装箱的验证总质量（VGM），并提前提供给船长/代理与码头代表，供配载计划使用 |
| Method 1 | 装箱并铅封后，用检定设备称整箱 |
| Method 2 | 称量所有货件、托盘、垫料、系固材料后加箱皮重；方法须经装箱完成国主管机关认可 |
| 硬条件 | **无 VGM 不得装船**（除非船长与码头代表通过其他方式取得 VGM） |
| 产品含义 | Port Pack：缺 `vgm` 字段 → 阻断「可装船」状态；Method 偏好可按国别 stub |

**官方源：**
- IMO 专题页：https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx  
- 指南 MSC.1/Circ.1475：https://wwwcdn.imo.org/localresources/en/OurWork/Safety/Documents/MSC.1%20Circ.1475.pdf  

**行业 FAQ（非立法）：** World Shipping Council / TT Club container weighing FAQs（见 IMO 页引用）。

---

## 2. IMO/ILO/UNECE CTU Code（装箱实践守则）

| 项 | 内容 |
| --- | --- |
| 性质 | **非强制**全球实践守则；可被各国立法引用 |
| 覆盖 | CTU 适宜性、装箱与系固、危险货物、培训、全程联运 |
| 核心章 | Chapter 9 装箱操作；Annex 7 载荷分布与系固评估 |
| 产品含义 | 生成「重心/系固/摩擦」检查项与 Audit 文案的权威叙事源；**不是**港别禁令表 |

**官方源：**
- IMO CTU 页：https://www.imo.org/en/ourwork/safety/pages/ctu-code.aspx  
- UNECE 多语种下载：https://unece.org/transport/documents/standards/ctu-code  
- MSC.1/Circ.1497 PDF：https://wwwcdn.imo.org/localresources/en/OurWork/Safety/Documents/1497.pdf  
- 2025 revision 工作文件（UNECE，2026-07 公开）：https://unece.org/transport/documents/2026/07/working-documents/imoilounece-code-practice-packing-cargo-transport → 产品跟进是否已正式取代 2014 版：**待核实落地状态**

---

## 3. CSC · International Convention for Safe Containers (1972)

| 项 | 内容 |
| --- | --- |
| 核心 | 集装箱结构安全；**CSC Safety Approval Plate**（最大总质量、堆码、检验/ACEP 等） |
| 与装载 | 货重 + 箱皮 ≤ 箱体额定/铭牌最大营运总质量；超铭牌是安全违规，不仅是商业问题 |
| 产品含义 | 校验 `cargo_mass + tare ≤ max_gross`；提示检查 CSC 铭牌有效性（作业现场） |

**官方源：** https://www.imo.org/en/about/conventions/pages/international-convention-for-safe-containers-%28csc%29.aspx  

---

## 4. ISPM 15 · 木质包装材料

| 项 | 内容 |
| --- | --- |
| 主管 | IPPC / FAO |
| 适用 | 国际贸易中的原木包装（含垫木 dunnage）；胶合板等经加工材料通常除外 |
| 要求 | 去皮木材 + 批准处理方式 + **ISPM 15 标识**（在 NPPO 授权下加施） |
| 产品含义 | 货单含木质包装 → checklist「ISPM15 标记 / 熏蒸证明」；与海关动植物检疫衔接（中国见 `02_china_national.md`） |

**官方 PDF：** https://www.ippc.int/static/media/files/publication/en/2019/02/ISPM_15_2018_En_WoodPackaging_Post-CPM13_Rev_Annex1and2_Fixed_2019-02-01.pdf  

---

## 5. IMDG Code（危险品 · 高层）

| 项 | 内容 |
| --- | --- |
| 性质 | SOLAS 下强制性危险货物海运规则（细节以现行修正案为准） |
| 产品边界 | CargoPlan MVP：**不**做完整 UN 编号分类引擎；只做「危品标记 → 港口危货作业 / 隔离提示」钩子 |
| 深化 | Phase2+ 可接 IMDG 数据商或开源子集 |

IMO Dangerous Goods 入口：https://www.imo.org/en/ourwork/safety/pages/dangerousgoods.aspx  

---

## 6. 海关 / WCO（与 stuffing 弱相关）

WCO 协调制度、舱单数据标准等影响**申报单证**多于柜内摆法。产品侧：装箱清单（packing list）与 3D 装载图一致性 → 查验留证加分；不宣称 WCO 级标准符合性。

---

## 7. 待核实

- [ ] CTU Code 2025 revision 对各缔约方的采纳时间表  
- [ ] 各国 Method 2 认证机关清单（仅缓存常用出口国）  
- [ ] CSC ACEP 公开查询接口是否可机器读  
