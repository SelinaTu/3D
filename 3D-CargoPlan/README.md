<!-- #created 11/08/2026 -->
# 3D CargoPlan · 3D舱策 · 集装箱装载优化工作台

**Mac APP 开发交接（1.7.2 / 2026-10-31）：[CURSOR_HANDOVER.md](CURSOR_HANDOVER.md)**。主原生源码为 `mac/assembly/`，当前默认安装入口 `/Applications/CargoPlan.app`；网页与算法专项历史说明见下文。

已接入完整伊拉克 Villa 样例、真实装箱引擎、独立约束校验、3D / 俯视图和方案导出。当前交付目录为 `/Users/lege/Documents/ChatGPT/集装箱运筹`；原目录 `/Users/lege/Projects/cargoplan` 保持原样。

**2026-10-18 PDF 校准交付（第二轮）**：1371 件完整装入 11 柜，排序尾柜由原方案 39.312163 m³ 降至 **35.581997 m³（减少 9.489%）**，前 10 柜最低装载模型实体利用率由 63.520229% 提高至 **66.218462%**。这是当前找到的最好可行解，未证明全局最优。打开 [离线3D报告及逐件清单](output/reports/iraq-villa-current-best.html)，验收及复现入口见 [本轮交付说明](docs/DELIVERY_V3.md)，计算过程见 [第二轮复盘](docs/OPTIMIZATION_ROUND2.md)及[计算总复盘](docs/OPTIMIZATION_V3_RECAP.md)。

## 三步启动

需要 Node.js 22.12 或更高版本。

```sh
cd /Users/lege/Documents/ChatGPT/集装箱运筹
npm ci
npm run build
npm start
```

打开 <http://127.0.0.1:3001>。本次验收实例使用 <http://127.0.0.1:3101>，以避开原目录的开发服务。也可运行 `./start.sh` 自动构建后启动。

## 使用

网页导航为「装箱工作台」「海陆样例」「客户价值」「海运知识库」；港口问答仅在海运知识库中打开。

1. 加载示例，或下载模板并导入 Excel（最多 20 MB、展开后最多 5000 件）。
2. 核对内尺寸与额定载重，选择算法和 1–120 秒预算。
3. 开始优化，可查看进度或取消；完成后切换方案、集装箱、3D 与俯视图，搜索逐件坐标。
4. 查看校验和未装货物，导出 JSON、Excel 清单或 HTML 报告。HTML 中的打印按钮可另存为 PDF。

计算及 Excel 解析均在本机完成。更换数据或配置会清除旧结果，避免误用其他清单的方案。

## 海运知识库与 3D CargoPlan 助手

主导航的「海运知识库」提供港口地球仪，可按港口查看公约、国家、港口及承运人费用；右下角「3D CargoPlan 助手」提供港口问题检索与来源线索。知识快照截至 **2026-10-31**，版本 **1.2.2**：包含 11,835 个 UN/LOCODE 水运地点、22 个港口知识包、9 个国别包与 12 个关注主题。多数港点只有基础坐标；有知识包不等于资料完整或已确认适用。

### 启动本地原文知识库

项目自身服务按上面的方式启动后，在另一个终端运行：

```sh
cd /Users/lege/Documents/ChatGPT/集装箱运筹
npm run knowledge:server
```

此命令需要 Python 3，默认使用 `~/Downloads/CargoPlan_KnowledgeBase`，将现有知识库服务绑定到 `127.0.0.1:18765`。如果知识库放在其他目录，可在启动前设置：

```sh
CARGOPLAN_KNOWLEDGE_ROOT="/知识库所在目录/CargoPlan_KnowledgeBase" npm run knowledge:server
```

保持两个服务运行，打开项目页面进入「海运知识库」，在右下角「3D CargoPlan 助手」输入问题；需要港口专属资料时请在问题中写明港口。助手提供本地主题问答、整理卡片与「本地原文检索」候选，并显示来源、页码和适用范围提示。原文检索通过项目后端转发至本机知识库；开发模式下也要先运行 `npm run server`。如果知识库或项目后端未启动，页面会提示原文检索不可用，已打包的本地主题和卡片仍可用于检索。独立静态地球仪没有项目后端，无法使用此原文检索接口。

当前助手是**检索式问答**，没有接入生成式模型；检索结果不是自动合规裁决。费用、罚款与港口规则须核对来源、有效日期和具体适用条件，商业费用与行政罚款分开判断。

数据和来源整理见 [港口知识文档](docs/port-knowledge/README.md)，地球仪数据结构见 [地球仪说明](globe/README.md)。

## 数据与结果

完整工作簿有门窗、玻璃架、辅材三个工作表，共 **1371 件、134777.37 kg、590.112711447 m³**。旧演示的 1196 件仅含门窗。详细来源、单位、哈希及约束解释见 [data/README.md](data/README.md)。

工作台通用默认 40HC 内尺寸仍为 12032 × 2352 × 2698 mm，最大载重 28000 kg；该旧口径曾由贪心 13 柜降为混合搜索 11 柜，不能用于与人工 PDF 比较。本轮 PDF 校准研究固定使用 11600 × 2250 × 2500 mm、W02 指定高度例外、确认空腔及三轴 5 mm，详见冻结合同 `data/reconstruction/model-v3-contract.json`。请使用上述已校准静态报告查看本轮结果；通用工作台的一次限时搜索不承诺重现这份专项构造结果。

所有算法共用真实碰撞、边界、方向、载重、支撑、累计顶部承重及叠放限制检查。目标按完整装载、少柜、评分的顺序比较。多算法共用一个时间预算与可行基线；未改善时会明确记录保留基线。分支搜索仅对不超过 12 件运行有界树搜索，大数据返回明确标记的基线。

## 开发与验证

```sh
npm run server        # API 3001
npm run dev           # 另一个终端，Vite 5173，代理 API
npm run check         # ESLint + 单元测试 + 类型检查 + 生产构建
npm run acceptance    # 先 build；验证完整生产接口/worker并输出交付文件
npm run parse         # 从内置三表 Excel 重新生成 demo-items.json
npm run optimize      # 命令行计算
```

`npm run acceptance` 将生成 `delivery-output/acceptance.json`、`solutions.json`、`packing-manifest.xlsx`、`packing-report.html`。回归包含六轴摆放、累计承重、方向条件、源清单记账、真实分支改进、错误输入、取消、状态过期和导入导出。

## 运行边界

- 本轮研究已建模确认的居中框孔和授权嵌套；静态报告绘制框梁与孔，通用工作台视图仍主要显示外包盒。实体体积指外包盒扣确认空腔，不是铝材/玻璃净材料体积。
- 竖直 5 mm 按 PDF 留缝投影传载模式计算，未虚构实物隔垫；现场承托接触仍需核对。仅取消额外 80% 底面承托比例，重心、正投影及源载荷限制均保留。
- “尽量靠柜门”为保留的软建议，目前未优化；用户确认的“上方货物宽面向下”已按上件最大面积面朝下强制执行。
- 重心和承重采用刚体、均匀密度和接触面积分摊的静态模型。报告会列出模型边界供现场核对。
- 本版本为本机单用户工作台：一次运行一个任务，最近 5 个结果最多保留 30 分钟，服务重启即清空；导出文件用于持久保存。
- 默认仅监听本机地址。Docker 配置也仅将端口映射到 127.0.0.1。云端、多用户鉴权及长期数据库不在当前本机交付中。

## 部署配置与文档

已提供多阶段 Dockerfile、Compose 和 GitHub Actions。运行 `docker compose up --build -d`，访问本机 3001。当前环境 Docker daemon 未运行，镜像构建与容器运行尚未验证；Node 生产服务已实际验证。

`PORT=3101 npm start` 可修改端口，`HOST` 控制监听地址。Excel 库固定保存于 `vendor/`，来源为 [SheetJS 官方分发说明](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/)。其余依赖由 `package-lock.json` 固定。

- [交付与验收报告](DELIVERY_REPORT.md)
- [当前项目交接说明](PROJECT_HANDOVER.md)
- [API 文档](docs/API.md)
- [历史交接材料](docs/archive/)（仅供追溯，状态和启动方式以当前文件为准）
