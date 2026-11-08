<!-- #created 11/08/2026 -->
# 3D CargoPlan Mac APP · Cursor 开发交接

更新日期：2026-10-31。当前安装版：**1.7.2 / build 9**。本文以本机源码和已安装 APP 核对，不把产品规划当作已实现功能。

**当前 1.7.2：**多站自动出题默认继承与 HTML 同源的伊拉克完整基线（11 柜 / 1371 件），可选择完整货柜；默认第 1 柜 93 件，第 10 柜 238 件。八件小样例仅为可选练习。共用加载入口 `src/demo/iraq-baseline.ts`；说明见 `docs/NATIVE_APP_172_IRAQ_DEMO.md`，当前验收见 `output/native-172-validation/acceptance.json`。

**1.7.1 补记：**已将「自动出题演示」放到多站点顶部。独立演示不受真实装配待装 / dirty 状态阻止；当前柜出题继续要求先校验装配。新入口、默认五站八件人员作业、真实求解与动画说明见 `docs/NATIVE_APP_171_DEMO_FIX.md`；补丁验收见 `output/native-171-validation/acceptance.json`。下文 1.7 的性能和历史验收数字保留原范围。

## 1. 从哪里接手

| 项目 | 位置 / 状态 |
| --- | --- |
| **Cursor 应打开的完整工程** | **`/Users/lege/Documents/ChatGPT/集装箱运筹`** |
| 默认用户应用 | `/Applications/CargoPlan.app` |
| 当前原生 APP 源码 | `mac/assembly/` |
| 原生构建输出 | `output/CargoPlanAssembly.app`，名字是兼容旧路径；安装时更新默认 `CargoPlan.app` |
| 当前版本声明 | `mac/assembly/Info.plist`：1.7.2 / 9；Bundle ID：`com.cargoplan.assembly` |
| 最新安装版验收 | `output/native-172-validation/acceptance.json`；早期验收保留在 `output/native-170-validation/` 与 `output/native-171-validation/` |
| 交接代码状态快照 | `docs/handoff/current-app-snapshot.json` |
| 原项目目录 | `/Users/lege/Projects/cargoplan`，保留的原项目，不是本轮维护入口 |

**交接风险：大量最新文件尚未提交 Git，`mac/`、共享工作台、多站引擎、知识与助手均有未跟踪文件。只克隆当前 Git 提交，不能得到这份 APP。** 请使用完整工作目录，先建立包含未跟踪文件的开发检查点。当前分支为 `codex/delivery`；交接时的 HEAD 与文件状态见快照。不要用 `git reset --hard`、`git clean` 或以旧 checkout 覆盖当前目录。

同一台 Mac 直接用 Cursor 打开完整工程即可。换机器交接时，应保留源码、`data/`、`vendor/`、`examples/` 和本次验收目录；`node_modules/`、`dist/` 与 APP 可以重建。`output/` 默认被 Git 忽略，必要验收记录需单独随交接保留；工程外原文知识库需另行迁移。

主 APP 不是 `desktop/` 的 Electron 窗口，也不是 `mac/knowledge-globe/` 的旧单功能壳。这三个入口曾并存，是之前误装、误开旧版的主要原因。

## 2. 产品方向和当前边界

愿景：**海陆运输作业智能体：用一份货物计划贯穿陆上多站集散、港口通关与海运装箱，统一处理异构货物装配、装卸顺序、政策费用与加固要求，并输出人和机器人都能执行的协议。**

当前可运行的是本机单用户原型：以三维装配、既定站序下的多站装卸、港口知识及本地问答为主。产品偏好是先保证整批清单和硬约束，再减少车辆 / 柜数，其次降低装卸与倒货；不是一定要把伊拉克样例压到 10 柜。

现有代码尚未覆盖愿景中的所有内容：没有道路导航或站序路线寻优，没有车队派单 / 顺路车交易，没有报关申报系统，没有实时全球费用计算，也没有机器人控制链路。

**用户已明确：多站点必须同时保留“手工编排”和“自动出题”两个入口。自动出题用于演示，不得因主推手工输入而删除。** 保留站点数、随机种子、生成题目、换一题以及现有整柜参考 / 随机挑战 / 六件练习场景。演示应能从题目清单进入主动求解，再查看逐站动作和 3D 动画；同一种子可复现，生成与手工题共用引擎。随机挑战不承诺必定可行，不得跳过校验来制造演示成功。

## 3. 实际架构

```text
CargoPlan.app（AppKit，单主窗口）
├─ 装配：SceneKit + 原生检查器 / 待装池
│  ├─ 完整约束表单：WKWebView → NativeCargoEditor.tsx
│  ├─ Excel：native-io.mjs → 共用 TypeScript 解析和导出
│  └─ 主动重算：repack.mjs → planWithComparison → 修复 / 贪心 / 独立校验
├─ 多站点：WKWebView → NativeRouteWorkspace → 多站引擎 + Three.js 播放
├─ 海运知识：RealityKit 地球 + WKWebView 共用 PortDetails 右栏
└─ 智能助手：共用 React 问答；前四区另有窗口内悬浮面板
   └─ 本地主题 / 978 张卡片；可选原文服务异步提供证据

应用内 Runtime.app（Electron 二进制，按 Node 模式运行）
└─ 包内脚本与本地 HTTP 服务：127.0.0.1 随机端口
```

装配和地球是原生 3D；多站动画、完整参数表单、知识右栏和问答仍复用网页。**不能把当前产品描述成全 Swift 原生。** 用户运行已构建 APP 不需要本机 Node、项目目录或手动起主服务；开发构建需要这些工具。

## 4. 代码导航：按需求找到入口

以下路径均相对工程根目录。

### 原生应用

| 路径 | 职责与修改入口 |
| --- | --- |
| `mac/assembly/Sources/main.swift` | 主入口 `Entry`、`AppDelegate`、五区宿主、货物 / 货舱模型、SceneKit、编辑、待装、重算、取消、进度、自动保存及原生自检。当前文件较大，新增功能宜先拆职责。 |
| `mac/assembly/Sources/NativeGlobe.swift` | RealityKit 球体、港点合批、旋转 / 缩放 / 自转、选港、原生列表和可调整宽度的右栏。 |
| `mac/assembly/Sources/WorkspaceWeb.swift` | WKWebView 宿主、包内服务生命周期、原生上下文事件、消息桥、下载及外链。保持内部切页，不另开工作区窗口。 |
| `mac/assembly/Sources/FloatingSupport.swift` | 主窗口内悬浮助手；海运知识库内保留面板、港口上下文和历史。 |
| `mac/assembly/Sources/NativeFiles.swift` | 原生文件选择、Excel 子进程调用、货物模型转换、按来源批量编辑。 |
| `mac/assembly/repack.mjs` | 从 JSON 读取全部货物、配置和旧方案，调用同一求解入口；stdout 逐行 JSON 进度，输出新场景，检查 ID 守恒。 |
| `mac/assembly/native-io.mjs` | 共用 Excel 导入、模板生成和方案导出。 |
| `mac/assembly/extract-scene.mjs` | 从冻结伊拉克解生成首次启动的 `scene.json`；不是优化算法。 |
| `mac/assembly/bundle.mjs` | esbuild 打包后端、Worker、Excel 和重算脚本，复制 `dist/` 及必要数据。 |
| `mac/assembly/build.sh` | 生成场景、打包资源 / Runtime、编译 Swift、ad-hoc 签名，输出 APP。 |

### 共用装配引擎与编辑表单

| 路径 | 职责 |
| --- | --- |
| `src/types/packing.ts` | `CargoItem`、`PlacedItem`、`Container`、`PackingSolution`、配置和装卸面契约。 |
| `src/demo/planning-runner.ts` | `planWithComparison`：修复旧方案、快速提前返回、限时搜索、比较有效候选、汇总及真实进度。 |
| `src/core/repair-packing.ts` | 保留有效旧摆放，修复受影响货物；分配待装件和候选柜的剩余时间预算。 |
| `src/core/greedy-algorithm.ts`、`packing-utils.ts` | 贪心装配、方向筛选、候选位置、边界 / 碰撞 / 承托 / 载荷等规则。 |
| `src/core/optimizer.ts`、`evaluator.ts` | 多算法调度和方案比较。当前比较优先未装件数、柜数，再比较已有卸货阻挡指标和评分。 |
| `src/core/validation.ts`、`solid-geometry.ts` | 独立方案校验、框体 / 矩形贯通孔等几何；不能只依赖显示层的碰撞提示。 |
| `src/core/loading-profile.ts` | 伊拉克 PDF 特殊口径、间隙和指定 W02 高度例外。 |
| `src/core/data-parser.ts`、`xlsx-adapter.ts` | 原始 Excel 解析、表头 / 源行 / 备注和约束归一。 |
| `src/demo/NativeCargoEditor.tsx`、`CargoConstraints.tsx`、`FrameEditor.tsx` | 原生共用的完整参数表单：方向、承重、层数、落地、混放及空腔等。 |
| `src/demo/excel-shipment.ts`、`studio-cargo.ts` | 工作台导入和货物编辑归一。 |
| `src/demo/PackingStudio.tsx`、`planning-worker.ts` | 网页装配工作台与后台计算；用于与原生对照。 |
| `src/core/packing-progress.ts` | 处理件数、总件数、柜数、已分配 / 未装进度事件契约。 |

坐标和单位：业务引擎 `x=长、y=宽、z=高`，尺寸 mm、重量 kg。`CargoItem.dimensions` 是源轴尺寸，`PlacedItem.actualDimensions` 是姿态后的占位；不能只改画面盒子的尺寸而不更新 cargo。SceneKit / Three.js 的上轴转换留在显示层。

### 多站点：输入、求解与执行动画

| 路径 | 职责 |
| --- | --- |
| `src/demo/NativeRouteWorkspace.tsx` | 接收原生选中柜及其已校验方案；存在未重算改动时不使用旧方案计算。 |
| `src/demo/MultiStopTest.tsx`、`RouteComposer.tsx` | 多站工作台、手工输入需求、主动计算、导入 / 导出；保留独立可见的随机出题与换题入口，服务演示。 |
| `src/demo/RouteVehicleEditor.tsx`、`src/data/vehicle-presets.json` | 8 个车型模板和自定义规格 / 装卸面。 |
| `src/core/multistop/index.ts`、`model.ts` | 无 UI 依赖的引擎入口及 `RouteProblem` / 任务 / 结果类型。 |
| `src/core/multistop/problem.ts` | 题目结构、货物身份、取送站序和库存来源检查。 |
| `src/core/multistop/engine.ts` | 逐站卸货、临移、装货、放回及失败回滚。 |
| `src/core/multistop/planning.ts` | 起点按站序靠门布局、新货位置偏好；不以丢货换取“可行”。 |
| `src/core/multistop/access.ts`、`doors.ts`、`vehicles.ts` | 人员走道与触及筛查、五个开放面、抽取路径及车型约束。 |
| `src/core/multistop/replay.ts` | `auditSimulation` / `replayStation`：独立复核库存、动作、路径和结果。 |
| `src/core/multistop/playback.ts`、`src/demo/RoutePlayer.tsx` | 将真实操作序列转为拆卸、临移、填装、放回动画；不是另写一份演示答案。 |
| `src/demo/simulation-worker.ts` | 多站求解后台线程。 |

### 海运知识与助手

| 路径 | 职责 |
| --- | --- |
| `src/knowledge/globe/PortDetails.tsx`、`NativePortDossier.tsx` | HTML 与原生共用的港口档案 / 右栏入口。 |
| `src/knowledge/globe/RegionalSummary.tsx`、`regional.ts` | 地区专属与国家继承、公路限重 / 通行 / 处罚分类和适用条件。 |
| `src/knowledge/globe/KnowledgeGlobe.tsx`、`GlobeScene.tsx` | 网页地球仪；不同于原生 RealityKit 地球。 |
| `globe/data/` | 港点、国别、公约、港包、地区政策、来源审阅与主题快照；原生构建复制到 Resources/knowledge。 |
| `src/support/SupportAssistant.tsx`、`support.css` | 共用问答 UI、网页悬浮助手和原生小面板。 |
| `src/support/knowledge.ts`、`shipping.ts`、`shipping-cards.json` | 本地操作问答、地区匹配及 978 张航运卡片；未接生成式模型。 |
| `src/support/evidence.ts`、`src/server/index.ts` | 原文候选检索；主服务只向指定本机证据服务转发，并校验服务身份。 |
| `scripts/start-knowledge-server.py` | 可选原文服务启动器；默认读取工程外 `~/Downloads/CargoPlan_KnowledgeBase`，端口 18765。 |

原生桥集中在 `WorkspaceWeb.swift` 与 `src/App.tsx`：`native=1` 为完整内嵌区，`native=cargo-editor / port-dossier / assistant-widget` 为专用页。`window.webkit.messageHandlers.cargoPlan` 承接原生消息；`cargoplan-native-context`、`cargoplan-support-context` 用于上下文同步。桥与数据契约变动必须联调两端。

## 5. 当前进展：已验证什么

| 模块 | 目前状态 | 验收 / 尚需注意 |
| --- | --- | --- |
| 单窗口三工作区 | 已实现并验收 | 内部切换；主动打开官方外链才进系统浏览器。 |
| 原生装配与编辑 | 已实现并验收 | 选货、拖动、Option 调高、Excel、基础 / 完整参数、按来源批量编辑、待装与主动重算。修改尺寸先待装，不只更新模型外观。 |
| 货舱规格 | 已实现并验收 | 输入尺寸、3D 手柄、限重 / 留缝、缩小后移出越界或超载件、撤销；目前一批同规格货舱。 |
| 快速 / 深度计算 | 已实现并验收 | 快速完整修复后提前返回；深度模式预算 20 秒。真实阶段、件数、百分比与取消。未改动 1371 件基线全调用约 1.3–3.1 秒，不保证任意输入时延。 |
| 装配保存恢复 | 1.7 已实现并验收 | 货物、货舱、待装、旧方案及 dirty 状态本机保存；不是跨设备 / 多项目数据库。 |
| 手工 / 自动多站任务 | 已实现并验收，两个入口均需保留 | 自定义站点、卸货与取货、交付站、主动计算、动作清单、3D 播放；自动出题支持种子复现与换题。四站人工样例和五站小样例已有记录。 |
| 可达与靠门规划 | 已实现模型筛查 | 走道、净高、触及距离、开放面和承托；不等于真实工人 / 机械运动安全验证。随机挑战可能无解，不能把失败隐藏。 |
| 海运知识 | 已集成并验收 | 11,835 个基础港点、22 个已建港包、9 个国别包；大部分点仍只有坐标。资料包不等于覆盖完整、实时有效。 |
| 右栏及悬浮助手 | 1.7 默认 APP 已验收 | 右栏共用 HTML 组件，可调宽 / 分类筛选；四区浮窗保留历史和港口上下文。本地答复不等待原文请求。 |
| 机器人协议 | 展示和规划草案 | 现有 Schema / 示例；协议页已同期更新至 0.4.0-draft.2。不是已从每份实际计划自动生成并通过真机验证的执行协议。 |
| 发布能力 | 本机 arm64 ad-hoc 包 | 未完成 Developer ID、公证、自动更新、跨机器兼容和安装器产品化。 |

**最新验收是上一轮 1.7 发布验收，不是本次交接重新跑出的结果：**35 文件 / 258 项测试、lint、类型检查、生产构建及 11 项安装版原生检查通过。本次再次核对默认安装二进制哈希与验收记录一致；具体时间、范围、日志、截图以 `output/native-170-validation/acceptance.json` 为准。

## 6. 真实数据、冻结基线和用户文件

| 路径 | 用途 |
| --- | --- |
| `data/sample-cargo.xlsx` | 伊拉克原始三表：门窗、玻璃架、辅材，共 1371 件。 |
| `data/reference/manual-11-container-baseline.pdf` | 原人工 11 柜方案。 |
| `data/demo-items.json`、`src/demo/iraq-sample.json` | 通用解析数据 / 工作台样例；不要与冻结结果混为一谈。 |
| `data/reconstruction/model-v3-contract.json` | PDF 校准模型合同和已确认口径。 |
| `data/optimization/v3-r2-delivery/current-best.json` | 原生首次启动场景来源；11 柜、1371 件、0 未装、冻结模型独立校验通过。 |
| `data/optimization/v3-r2-delivery/final-audit.json` | 冻结解审计；构造过程另见 `summary.json`。 |
| `output/reports/iraq-villa-current-best.html` | 专项静态 3D 报告及逐件清单。 |
| `examples/multistop/manual-worker-four-stops.problem.json` | 可导入的人工四站样例。 |
| `data/reviews/eight-container/source.zip` | 曾审查的 8 柜外部方案，不是当前已接受基线。 |

当前冻结解是“找到的可行改善解”，**没有全局最优证明，也没有同约束完整 10 柜或 8 柜交付结论**。专项前十柜最低模型实体利用率约 66.218462%，尾柜实体体积约 35.581997 m³；不要用外包盒体积和扣空腔实体指标混算。

必须保留的建模决定：PDF 净空 11600×2250×2500 mm、玻璃架接触例外与其他三轴 5 mm 间隙、已确认的框内孔及类别 / 方向限制。W02 第 16 行 92 件的 3030×2560×160 mm 依赖**指定源行和尺寸下的 2560 高度例外**；改变尺寸不自动继承。若 2500 是物理硬净高，此单件不能凭算法装入。详见 `docs/W02_ROW16_REVIEW.md`、`docs/DELIVERY_V3.md`。5 mm 竖向投影传载是模型假设，不是虚构现场隔垫。

圆柱、卷材、管材当前按已确认防滚包装的外包尺寸保守计算；不是任意曲面精确嵌套。自定义包装和备注中未识别的硬要求应进入待确认，不能静默视为无限制。

用户个人文件在工程外：

- `~/Library/Application Support/CargoPlan/workspace-v1.json`：原生装配自动保存。约 0.7 秒合并写入，退出同步保存；自检参数不写用户工作区。
- `~/Library/Application Support/CargoPlan/Backups/`：旧 APP / 安装回滚备份。
- `~/Documents/CargoPlan-before-1.7.xlsx`：升级前实际应用导出；副本 `output/native-170-validation/before-upgrade.xlsx`。1371 件尺寸 / 位置 / 重量与基线逐件一致。

**多站题目 / 结果和助手历史的跨重启保存尚未统一实现。** 切换标签保留不等于退出后仍保留，需用计划和执行记录导出；不要将原生装配的自动保存泛化到整个平台。

## 7. 开发、构建与验收

已验证环境：Apple Silicon arm64、Node 22.23.2 / npm 10.9.8、macOS 26.4.1、Swift / macOS SDK 26.4。Node 最低要求见 package.json：22.12。

```bash
cd "/Users/lege/Documents/ChatGPT/集装箱运筹"
npm ci
npm run check
zsh mac/assembly/build.sh
```

**先构建网页，再构建原生。** `build.sh` 会复制现有 `dist/`，不会替你运行 Vite；只改 HTML / TSX 而不重建并更新 APP，用户仍会看到旧版。原生构建输出目录会被脚本重新生成，用户工作文件不要放进去。

网页单独开发：一个终端 `npm run server`（3001），另一个 `npm run dev`（5173，代理 API）。生产 `npm run build` 后 `npm start` 默认 3001。用户曾使用的 3101 是启动实例端口，不是原生运行端口；原生自带随机本地端口。

安装前在源码构建产物上检查，GUI 项需解锁本机桌面：

```bash
appBin="$PWD/output/CargoPlanAssembly.app/Contents/MacOS/CargoPlanAssembly"
"$appBin" --self-check
"$appBin" --progress-smoke
"$appBin" --edit-preview-smoke
"$appBin" --full-editor-smoke
"$appBin" --drag-smoke
"$appBin" --resize-smoke
"$appBin" --cancel-smoke
"$appBin" --vehicle-route-smoke
"$appBin" --support-smoke
"$appBin" --shell-smoke
"$appBin" --ui-smoke
```

额外入口：`--manual-route-smoke` 检查手工表单计划，`--repack-smoke` 检查小批量复算。修改多站引擎后运行 `src/core/multistop/` 的测试并审计重放；修改 API / Worker / 导入导出时可追加 `npm run acceptance`。测试计数会随开发变化，以上 258 是已记录基线。

可选原文服务：`npm run knowledge:server`。默认依赖工程外的 `~/Downloads/CargoPlan_KnowledgeBase/app/server.py`；搬机器需同时迁移该资料库或设置 `CARGOPLAN_KNOWLEDGE_ROOT`。它不在主 APP 内；缺少它时仍可使用已打包的问答主题和卡片，但原文候选服务不可用。

### 更新用户安装版

1. 确认当前装配已保存，必要时导出；备份工作区，正常退出运行中的默认 APP。
2. 备份当前 `/Applications/CargoPlan.app` 内容，保留可回滚副本。
3. 将已验收构建更新到**默认同一入口**，保留 `com.cargoplan.assembly`。前次用更换 `Contents` 保留顶层目录，避免原 Dock 入口指向旧应用。
4. 执行 `codesign --verify --deep --strict "/Applications/CargoPlan.app"`；从非工程目录运行安装版检查，确认不依赖 checkout。
5. 实际打开默认 APP 核对版本、原工作区、尺寸转待装、知识右栏与悬浮问答，保存新验收日志和截图。

当前未提供统一安装 / 回滚脚本。不应通过继续创建 `CargoPlan 1.x.app` 来交付日常更新；此前并行应用已归档。`package.json` 的 1.1.0 是旧网页包版本，不是 Mac 版本；发布时需整理多处版本来源。

## 8. 待解决事项与建议顺序

| 优先级 | 问题 | 建议落地方式 |
| --- | --- | --- |
| P0 | 最新实现大量未进入 Git | 先将完整目录、未跟踪源码和必要数据建立可复现检查点；检查原文知识库等工程外依赖。不要把 node_modules / 构建包误当源码提交。 |
| P0 | 构建 / 安装会出现网页更新而 APP 未更新 | 增加统一打包、默认入口升级与回滚流程；记录网页资产及数据哈希，自动检查资源新鲜度。 |
| P0 | 最低系统声明不实 | Info.plist 写 13.0，但本次 `vtool` 核对已安装 Mach-O 的 **minos=26.0、SDK=26.4**。需明确支持矩阵并统一编译目标 / 可用性检查，不能宣称当前包支持 macOS 13。 |
| P1 | 只有装配工作区跨重启保存 | 增加统一项目文件：版本化货单、货舱、站点、题目、结果和 dirty 状态；增加迁移、恢复与事务测试。 |
| P1 | Swift 主文件集中且部分模块仍嵌入网页 | 按模型、视图、计算服务、文件服务拆分；先保持同一算法与数据契约，不复制一套 Swift 求解器。 |
| P1 | 多站随机题与实际任务可行性需要持续覆盖 | 扩充可复现真实业务题集；分别记录输入非法、几何受阻、人员不可达、放回失败和超时，不能统一“未找到位置”或改状态伪装成功。 |
| P1 | 计算性能和改进质量 | 分开统计修复、候选搜索、独立校验、IPC 与场景刷新耗时；以未装数 / 柜数 / 操作成本比较，保留有效旧方案。无 seed 的初装与大改尺寸仍可能变慢。 |
| P1 | 数据门槛与导入备注风险 | 加强包装确认、备注人工复核、源行追溯和不支持条件提示。当前“空腔”备注专门规则不能覆盖未来任意附加禁令。 |
| P2 | 真实设备 / 门洞 / 加固 | 补充门框、尾板、侧柱、搬运负荷、轨迹、绑扎和动力载荷；当前整面开放与静态承托模型不足以认证现场执行。 |
| P2 | 知识维护与协议真正落地 | 做规则包更新 / 来源审阅；从实际装卸动作导出并验证协议草案，再做 ROS / OEM 适配。政策资料尚未自动进入装配硬约束。 |

## 9. 建议阅读顺序

1. 本文 → `docs/NATIVE_APP_170_FIXES.md` → `output/native-170-validation/acceptance.json`。
2. `mac/assembly/README.md` 与 `Sources/main.swift`、`WorkspaceWeb.swift`，走通原生编辑 / 重算 / 桥回路。
3. `src/demo/planning-runner.ts`、`src/core/repair-packing.ts`、`validation.ts`。
4. `docs/MULTISTOP_ENGINE.md`、`docs/VEHICLES_AND_MANUAL_RESIZE.md` 与多站核心 / 回放。
5. `docs/NATIVE_ASSISTANT_AND_REGIONAL_KNOWLEDGE.md`、`globe/README.md` 与共享详情 / 问答。
6. 算法专项再读 `docs/DELIVERY_V3.md`、`docs/W02_ROW16_REVIEW.md`；产品规划读 `docs/CARGOPLAN_PRODUCT_PLAN.md`，不将规划视作完成清单。

历史文档中出现旧版本号、旧测试数、“没有自动保存”或并行安装路径时，以本文和 1.7 验收为当前口径；历史结果本身保留。

## 10. 可直接交给 Cursor 的提示

> 工程在 `/Users/lege/Documents/ChatGPT/集装箱运筹`。请先读根目录 `CURSOR_HANDOVER.md`、`docs/NATIVE_APP_170_FIXES.md` 和 `output/native-170-validation/acceptance.json`。接手的是默认 `/Applications/CargoPlan.app` 1.7.2 的混合原生应用，主源码 `mac/assembly/`，共用装配引擎在 `src/core/` 与 `src/demo/planning-runner.ts`；不要误改成 `desktop/` 的 Electron 产品或旧独立地球仪。大量代码未提交，先保全完整工作区。保留手动重算、待装货物与 ID 守恒、独立校验、既定站序人员可达及单窗口切页。更改网页模块后先构建网页再构建原生，最终测试默认安装入口；不要只修改页面或另装一个同名旧版旁支。后续根据我给出的需求继续开发。

> 补充必保留项：多站点的手工编排和自动随机出题都要保留。自动出题用于演示，保留站点数、种子、生成 / 换题和真实求解后的 3D 播放，不得用预制答案替代共用引擎。

1.7.1 补丁验收：36 文件 / 265 项单元测试、13 项安装版原生检查通过，包含 dirty 装配下独立出题 / 求解 / 动画。实际六件待装及原工作区在更新和演示后全量逐字段比较一致。

1.7.2 构建注意：共用基线文件 `output/reports/iraq-villa-current-best.plan.json` 是必要输入（output 被 Git 忽略）。交接时保留此文件；如需重建，请显式运行 `node scripts/build-static-report.mjs data/optimization/v3-r2-delivery/current-best.json output/reports/iraq-villa-current-best.html`，不要使用指向旧交付数据的默认输入。当前验收为 37 文件 / 269 项测试及 13 项安装版检查。
