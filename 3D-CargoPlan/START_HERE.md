<!-- #created 11/08/2026 -->
# 3D CargoPlan · 3D舱策：HTML、Mac APP、代码包与方案进展

整理日期：2026-10-31。工程根目录：`/Users/lege/Documents/ChatGPT/集装箱运筹`。

## 1. 当前交付物与版本

| 交付物 | 地址 | 说明 |
| --- | --- | --- |
| 完整开发工程 | `/Users/lege/Documents/ChatGPT/集装箱运筹` | Cursor 应打开此目录；含大量未提交文件，只克隆 Git 的旧提交不完整。 |
| HTML / Web 源码 | `src/`、`index.html`、`vite.config.ts` | React + TypeScript + Three.js；Node / Express API 在 `src/server/`。 |
| 当前 Mac APP 源码 | `mac/assembly/` | AppKit 主窗口、SceneKit 装配、RealityKit 地球、共享 WKWebView 模块。 |
| 共用算法与数据契约 | `src/core/`、`src/types/packing.ts` | HTML 和 APP 共用，不能只改视图而不改算法输入。 |
| 已安装正式体验入口 | `/Applications/CargoPlan.app` | 当前本机验收版 **1.7.2 / build 9**。 |
| 原生构建输出 | `output/CargoPlanAssembly.app` | 构建路径兼容旧名称；不是另一个产品。 |
| 当前源码包 | `output/handover/CargoPlan-Source-20261031-180602.zip` | HTML + 原生 APP + 共用引擎、必要数据、说明和验收记录。 |
| 已安装 APP 体验包 | `output/handover/CargoPlan-Mac-1.7.2-arm64-20261031-180602.zip` | 对当前 `/Applications/CargoPlan.app` 做静态副本，保留签名和 Framework 符号链接；不含个人工作区。 |
| 深入开发交接 | `CURSOR_HANDOVER.md` | 代码导航、构建、约束、风险及后续优先级。 |

**源码快照与已安装二进制分开记录。** 1.7.2 安装验收后，网页源码又加入了客户价值页（`src/demo/CustomerValue.tsx`、`customer-value.ts`，`#value`）。本次源码包保留该新增内容；当前 APP 体验包仍是已验收的 1.7.2，不将源码中的所有新页面宣称为已同步到五个原生工作区。源码包自己的解压构建结果见 `package-validation/`。

`desktop/` 是保留的 Electron 产品分支，`mac/knowledge-globe/` 是旧独立地球仪壳；两者都不是当前原生主 APP 的维护入口。原项目 `/Users/lege/Projects/cargoplan` 保留原样，不是本轮开发目录。

## 2. 按功能定位代码

| 功能 | HTML / 共用代码 | 原生 APP 对应代码 |
| --- | --- | --- |
| 主界面 / 工作区 | `src/App.tsx`、`src/app.css` | `mac/assembly/Sources/main.swift` |
| 装配编辑工作台 | `src/demo/PackingStudio.tsx`、`FrameEditor.tsx`、`CargoConstraints.tsx` | `main.swift`、`NativeFiles.swift`，完整表单复用 `src/demo/NativeCargoEditor.tsx` |
| 3D 装配显示 | `src/components/ContainerViewer.tsx` | `main.swift` 内 SceneKit 场景与交互 |
| 编辑后主动重算 | `src/demo/planning-runner.ts`、`planning-worker.ts` | `mac/assembly/repack.mjs` → 同一 `planWithComparison` |
| 物理 / 业务约束 | `src/core/packing-utils.ts`、`solid-geometry.ts`、`validation.ts`、`loading-profile.ts` | 不另写 Swift 算法；原生提示最终交给共用引擎校验 |
| 旧方案修复 / 进度 | `src/core/repair-packing.ts`、`packing-progress.ts` | `main.swift` 进程、进度与取消处理 |
| Excel | `src/core/data-parser.ts`、`xlsx-adapter.ts`、`src/demo/excel-shipment.ts` | `NativeFiles.swift`、`mac/assembly/native-io.mjs` |
| 手工多站 / 自动出题 | `src/demo/MultiStopTest.tsx`、`RouteComposer.tsx`、`simulation-worker.ts` | `src/demo/NativeRouteWorkspace.tsx` + `WorkspaceWeb.swift` 传递装配上下文 |
| 多站求解 / 校验 / 动画 | `src/core/multistop/`、`src/demo/RoutePlayer.tsx` | 同窗 WKWebView 复用；目前不是原生多站动画 |
| 伊拉克完整基线 | `src/demo/iraq-baseline.ts`、`output/reports/iraq-villa-current-best.plan.json` | 同一文件已打入 APP；不要退回八件小样例作为默认 |
| 港口地球与详情 | `src/knowledge/globe/`、`globe/data/` | `NativeGlobe.swift` 为 RealityKit 地球，右栏共用 `PortDetails.tsx` |
| 悬浮问答 | `src/support/` | `FloatingSupport.swift`，仅海运知识库保留 3D CargoPlan 助手及港口上下文 |
| APP 打包 | 网页先执行 `npm run build` | `mac/assembly/bundle.mjs`、`build.sh`、`Info.plist` |

业务坐标为 x 长、y 宽、z 高，单位 mm / kg。源轴尺寸与摆放后的实际尺寸不同；货物 ID、原始约束和数量必须贯穿编辑、计算、各站库存及动画。

## 3. 已落地的进展

| 模块 | 当前进展 | 范围 |
| --- | --- | --- |
| HTML 工作台 | 已可操作 | Excel、货物 / 货舱参数、方向承重空腔等约束、待装、主动计算、3D 和导出。 |
| Mac 装配 | 1.7.2 已安装 | 原生选择 / 拖动 / 调高、输入尺寸、完整参数、待装、货舱手柄、撤销、显式重算与取消。 |
| 计算体验 | 已验证 | 快速修复 / 深度搜索、实际阶段及件数进度；快速完整修复提前返回，不再固定跑满 20 秒。时延取决于输入，不保证全局最优。 |
| 多站业务输入 | 已实现 | 手工站点、各站装卸与交付站、车型 / 自定义尺寸、开放面、主动求解、动作清单与 3D 播放。 |
| 多站自动出题 | 必须保留，默认整柜 | 与 HTML 同源的 1371 件 / 11 柜；默认第 1 柜 93 件，可选择第 10 柜 238 件等。八件练习为可选项。出题与求解使用所选可达规则。 |
| 原生主壳 | 单主窗口三工作区 | 装配、多站、海运知识在内部切换；3D CargoPlan 助手仅在海运知识库中打开；装配 / 地球原生，部分模块复用网页。 |
| 保存恢复 | 部分完成 | 原生装配自动保存到个人目录；多站计划和结果用导出保留，尚无全产品统一项目持久化。 |
| 港口知识 | 本地快照已集成 | 11,835 基础港点、22 港包、9 国别包；多数点仍只有坐标。地区规则、国家继承、处罚和商业费分层展示。 |
| 3D CargoPlan 助手（海运知识库内） | 本地检索问答 | 978 张航运卡片及主题，支持原文候选补充；未连接生成式模型。 |
| 商业化 / 客户价值 | 方案与展示阶段 | 产品定位、竞品、用户痛点已有文档；新网页价值页不代表收入或试点转化已经验证。 |

## 4. 算法与伊拉克结论

冻结专项解：1371 件、11 柜、0 遗漏；前十柜最低模型实体利用率约 66.218462%，尾柜实体体积约 35.581997 m³。相对原 PDF 同口径有改善，**未证明全局最优，未交付同约束完整 10 柜或 8 柜解**。

核心来源：`data/sample-cargo.xlsx`、`data/reference/manual-11-container-baseline.pdf`、`data/reconstruction/model-v3-contract.json`、`data/optimization/v3-r2-delivery/current-best.json`。

PDF 模型净空 11600×2250×2500 mm、指定 W02 2560 mm 高度例外、框孔、三轴间隙及传载假设继续生效。物理硬净高若只有 2500 mm，不能凭例外当作实物可入；不能为减柜取消源约束。圆柱 / 卷材 / 管材目前按已确认防滚包装外包计算，不是任意异形精确嵌套。

HTML 报告与原生首次启动场景的柜号顺序不同。当前多站基线与 HTML 顺序相同，逐件身份、坐标、姿态已核对；不能只对数组下标判断数据不同。

## 5. 验证证据与源码差异

已安装 1.7.2：37 个测试文件 / 269 项测试、lint、类型检查、构建及 13 项安装版原生检查通过。93 件与 238 件完整柜五站人员模式求解及重放通过；实际图像见 `output/native-172-validation/iraq-full-cabinet-playback.png`。

本次源码包另外在独立目录执行依赖安装、检查和构建，结果随包置于 `package-validation/`。它与历史 APP 验收是两份记录；不将网页新增源码自动算作已安装 APP 的能力。

## 6. 解压后运行与构建

开发环境：Node >=22.12；本机使用 22.23.2。原生编译需要 macOS Swift / SDK 和 Electron 运行时。

```bash
# 在解压后的源码目录执行
npm ci
npm run check

# 生产网页：构建后启动，默认 http://127.0.0.1:3001
npm start

# 开发网页：两个终端分别运行
npm run server
npm run dev

# 原生：必须先构建网页，避免把旧 dist 打入 APP
npm run build
zsh mac/assembly/build.sh
```

用户之前使用的 3101 是本机实例端口；原生内嵌服务使用 127.0.0.1 随机端口。网页依赖 Worker、fetch 与 API，应经本地 HTTP 打开，不把项目网页宣称为双击 file:// 即完整运行的单文件。

Mac 体验包只对应已验证的 arm64 机器。本机 APP 的 Mach-O 最低系统为 macOS 26.0（SDK 26.4）；Info.plist 的 13.0 声明与二进制不一致，是已记录待修项。当前为 ad-hoc 本地签名包，未做 Developer ID 公证、Intel 或其他系统版本验收。

## 7. 代码包包含与排除

包含当前已跟踪和未跟踪源码、Mac 两种历史壳与当前主壳、vendor Excel 依赖、原 Excel / PDF、校准合同与测试数据、最终冻结方案、同源报告 JSON / HTML、知识 / 协议、产品文档及精简验收证据。

不包含 `.git`、`node_modules`、编译缓存、个人工作区自动保存和升级备份、约 1 GB 历史搜索中间结果、无关 AI Agent 研究目录。历史研究脚本仍在，但被省略的旧中间产物不会凭空补齐；继续专项完整复盘需回原工程取对应归档。

可选原文服务依赖工程外 `~/Downloads/CargoPlan_KnowledgeBase`，本包不含该原文库。主 APP 和静态卡片可独立使用；原文候选查询需单独迁移该库并启动 `npm run knowledge:server`。

## 8. 后续开发建议

1. 先建立包含当前未提交文件的代码检查点，统一构建、版本与默认 APP 升级流程。
2. 补全跨工作区项目保存、版本与变更恢复；继续验证真实客户的多站题集和参数到引擎的完整传递。
3. 进一步优化计算耗时、同柜尾量、装卸动作和人员可达；保留库存守恒及独立重放。
4. 修复 Mac 最低系统声明，明确支持矩阵并做跨机器发布验收。
5. 将协议从说明 / 工具接到实际装卸动作导出与模拟消费者，再评估设备适配。
6. 用户与商业试点、ERP / WMS 集成、权限和数据库继续推进；道路路线寻优、公开撮合、实时全球规则及机器人控制尚未交付。

当前是可体验、持续打磨的本机平台原型，不是已完成所有愿景功能的商用生产系统。

## 9. 本批源码包的独立验证

已在单独复制目录完成依赖安装、38 个文件 / 271 项测试、lint、类型检查、生产网页构建及 Mac 源码编译。已安装 1.7.2 的 269 项 / 13 项记录仍单独保留，不与新网页快照混用。

本机 npm 默认共享缓存权限异常，验证使用独立缓存；本机 npm 策略未执行 Electron 的安装脚本，因此 Mac 编译验证复用了原工程中与锁文件相同的 Electron 45.2.1 运行时，没有修改 npm 安全策略。若你的环境也没有 `node_modules/electron/dist/Electron.app`，需按本地依赖策略准备相同版本的运行时，或从同批 Mac 体验包复用：

```bash
mkdir -p node_modules/electron/dist
ditto "/Mac体验包解压目录/CargoPlan.app/Contents/Resources/Runtime.app" \
  node_modules/electron/dist/Electron.app
zsh mac/assembly/build.sh
```

上述是原生主 APP 的编译方式；旧 Electron 产品分支另有运行要求。源码包中的 `package-validation/` 保留本次日志及运行时说明，`PACKAGE_MANIFEST.json` 提供文件校验清单。
