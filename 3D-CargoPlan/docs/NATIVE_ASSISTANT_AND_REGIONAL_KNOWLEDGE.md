<!-- #created 11/08/2026 -->
# CargoPlan 1.6 · 悬浮助手与地区作业知识

2026-10-31。保留网页；原生装配使用 SceneKit，地球使用 RealityKit。知识详情复用网页组件。

## 本次体验

- 切换工作区保留本次对话，选中港口进入助手上下文；可以收起或清空。清空不改变货物或计算结果。
- 支持导入、编辑约束、待装、主动重算、多站点等操作问答，以及附参考来源的航运实务问答。
- 当前是本地知识检索，不是接入外部模型的聊天代理，不会代替用户执行计算、改货或判定罚单。

## 海运知识库对齐

原生地球旧版使用独立的文本拼接器，只展示了部分 JSON 字段。本版改用 `NativePortDossier` 和网页版共用的 `PortDetails`。地球保持 RealityKit，右侧详情直接使用同一份网页组件与数据。

统一详情包括：地区差异、国家法规、港口作业、商业费用、通用公约，保留原始分册、出处、生效与核对时间、资料缺口。原生“完整知识目录”仍可打开完整目录、主题与看板。并不声称所有原生搜索控件已逐一复制网页筛选器。

删除“与天津相关的航运问题”等按国别挂载通用主题的区域。国际通用问题在助手和主题目录检索；不再借 VGM、木包装等公共要求制造港口差异。

覆盖保持透明：11,835 个 UN/LOCODE 港点、22 个已建港口包、9 个国别包，其中只有 2 个国别包较厚；坐标覆盖不等于法规完整。

## 地区规则及罚则

规则按“范围、触发条件、作业动作、后果、生效时间、核对时间、来源”结构化。港别范围优先于国家范围，天津的条目不会因为同属中国而应用到上海。国家规则继承有明确标记。

本轮新增并核对：

- 天津接驳道路的排放及区域限行，区分 2026-10-01 生效措施和 2027-01-01 后续扩大范围。不把滨海新区核心区限行误写成整个天津港禁入；不为通告虚构统一罚额。[天津三部门通告](https://www.tj.gov.cn/zwgk/zfxxgkzl/fdzdgknr/zdmsxx220316/hjbh_157364/zcwj_157407/202610/t20261015_7632438.html)
- 中国公路车货总质量、轴型与轴荷；重量超限处罚条件及整改。与箱体载荷、VGM 和商业费用分开。[交通运输部现行规章](https://xxgk.mot.gov.cn/2020/gz/202112/t20211221_3632243.html)
- 印尼超载与违规改装责任的区别。依据主管部门说明，展示具体条款的条件，不把普通超载和非法改装罚则合并。[印尼 NTT 交通厅说明](https://dishub.nttprov.go.id/jaga-keselamatan-jalan-dishub-ntt-imbau-pelaku-usaha-patuhi-ketentuan-dimensi-dan-muatan-angkutan-barang/)

原有新加坡危货申报、欧盟 ICS2、洛杉矶 Clean Truck Fund、Maersk 印尼 WDF 等资料继续使用同一数据和审阅记录，商业收费与法定责任分别标示。

问答中的明确国家或港口覆盖当前选中港口。未收录的地区罚则、特定危货罚则会回复缺口，不用其他违法类型补答案。政策作为核查资料展示；本轮未把它们自动加入装配硬约束，也不提供道路导航或实时费率。

## 维护入口

| 位置 | 职责 |
| --- | --- |
| `src/support/knowledge.ts` | 共用检索与问答边界 |
| `src/support/SupportAssistant.tsx` | 网页和原生共用问答 UI |
| `mac/assembly/Sources/FloatingSupport.swift` | 原生窗口内悬浮入口与面板 |
| `src/knowledge/globe/PortDetails.tsx` | 共用港口详情 |
| `src/knowledge/globe/NativePortDossier.tsx` | 原生详情入口 |
| `src/knowledge/globe/RegionalSummary.tsx`、`regional.ts` | 地区展示与适用范围 |
| `globe/data/regional-policies.json` | 本轮结构化地区规则 |
| `globe/data/reviews.json`、`countries.json`、`port_packs/` | 原有资料与来源核对记录 |

助手、详情和编辑器复用原生主工作区的同一个本地计算服务。独立编辑器关闭不会停止主服务。

## 验证

单元测试覆盖地区范围优先、跨国家上下文、操作问答、VGM 来源、未知问题和未知罚则。原生 `--support-smoke` 验证四区悬浮、历史保留、天津资料、HTML / 原生详情一致、单窗口与货物集合不变；同时回归壳、完整编辑器、拖拽、多站车型和取消计算。

实际日志与截图见 `output/native-160-validation/`；以目录内验收记录中的状态为准。
