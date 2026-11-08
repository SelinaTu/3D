<!-- #created 11/08/2026 -->
# 3D CargoPlan Mac 统一应用 · 1.7.2

1.7.2 恢复与 HTML 同源的伊拉克完整多站演示：11 柜 / 1371 件，默认完整第 1 柜 93 件，可切换其他柜；八件示例仅作可选练习。基线副本不受个人待装状态阻止，不覆盖用户修改。见 `docs/NATIVE_APP_172_IRAQ_DEMO.md` 和 `output/native-172-validation/`。

1.7.1 修复多站自动出题在装配 dirty 时不可用：顶部「自动出题演示」支持不依赖当前装配的独立车辆与五站题目，再主动计算并播放。当前柜出题仍需先校验装配。详见 `docs/NATIVE_APP_171_DEMO_FIX.md`；本次验收位于 `output/native-171-validation/`。

更新：2026-10-31。本页覆盖此前“标签打开外部 Electron”“重算依赖项目目录”的说明。

## 启动

唯一默认入口为 `/Applications/CargoPlan.app`，窗口标题包含 1.7.2。升级前方案已导出核对，旧版应用归档到 `~/Library/Application Support/CargoPlan/Backups`，避免再打开另一个旧版本。

1.7 修复结束尺寸编辑不转待装的问题，保留待装件继续改参；增加默认快速修复、主动深度优化、实际件数与阶段进度。个人工作区自动保存恢复。原生知识右栏可调宽、可筛选，海运知识库内的 CargoPlan 助手保留。详细行为与测试见 `docs/NATIVE_APP_170_FIXES.md`。

1.6 在海运知识库保留窗口内 CargoPlan 助手，切换保留对话；原生地球的详情与网页共用组件，默认展示地区差异、国家继承的公路限制及处罚条件。详见 `docs/NATIVE_ASSISTANT_AND_REGIONAL_KNOWLEDGE.md`。

## 三个原生工作区，一个窗口

- **装配**：AppKit + SceneKit。Excel 导入/模板下载/方案导出、货舱尺寸/限重/留缝编辑、选择/拖动、待装池、货物完整参数编辑、退出编辑、显式重新计算。切换工作区保留内存状态。
- **多站点**：嵌入同一窗口的 WKWebView，复用网页通用求解引擎。直接接收原生装配当前选中柜的最近已校验方案；原生装配有未重算修改时禁用计算。默认手工编排站点名称、站序、卸货数量、取货规格/数量/交付站；支持当前柜或空车起步，点击「计算装卸方案」主动求解。随机示例收进高级工具。人员可达模型和靠门重排详见下节。
- **海运知识库**：RealityKit 原生球体与港点。支持搜索、旋转、缩放、自转开关、港点选择；详情侧栏共用最新网页组件。11,835 个基础港点、22 个已建包，多数点仍缺专属知识。点击顶部「完整知识目录」可在同一窗口打开完整 HTML 港口知识目录。

统一使用深色层次、蓝色强调色、macOS 系统字体与常规编辑快捷键、原生顶部工作区切换。只有主动点击官方来源等外部链接会打开系统浏览器；工作区切换不会打开外部应用或新窗口。多站点题目及结果在切换到海运知识库再返回时保留；装配输入发生变化会使旧题目失效。上下文首载订阅后主动同步，避免事件先到导致“正在读取”卡住。

## 1.5 更新

装配左侧常驻货舱内长 / 宽 / 高输入，支持回车应用与原生 3D 三轴手柄。缩小后只移出越界或超载件；支持撤销、不自动计算。货舱调整作用于当前方案全部同规格货舱。重新计算支持取消，不再弹成功确认框。

多站点支持 8 个车型模板与自定义净空/载货。后门、左右侧、顶部进入引擎与动画，每步记下实际方向。模板只是默认示例，不是厂型或法规保证。操作、来源和边界见 `docs/VEHICLES_AND_MANUAL_RESIZE.md`。

## 装配操作

1. 点击「导入 Excel」选择货物清单；可先「下载模板」。导入会替换当前货物清单，所有导入件先进入待装池，点击顶部「重新计算」。
2. 点击左侧货物或 3D 货物，编辑名称、长宽高、重量；更多约束点「完整参数 · 方向 / 承重 / 空腔」。完整面板复用网页表单，支持方向、水平旋转、承重、层数、落地、错位、混放组、各姿态限制与已有空腔参数。可选择仅修改当前件或同来源整组货物。
3. 应用参数后，受影响货物先进入待装池；修改货舱规格只将越界或超载件转入待装池，其他保留预览位置。按「重新计算」后，使用与网页同一 `planWithComparison` 引擎和约束重新求解。
4. 鼠标拖动货物改变水平位置，Option 拖动改变高度；与其他外包碰撞或越界时松手转入待装池。普通单击只选中，不修改方案。
5. 有未重算改动时先重算再「导出方案」。不在切换参数时自动计算。

拖拽选择使用视线与货物包围盒相交，避免 SceneKit 透明柜壳拦截命中。原始小数尺寸与重量保持精度。

## 多站点操作与可达性

左侧新增、切换、前移/后移或删除站点；右侧按真实计划在车清单填写本站卸货件数。新增取货可自定义尺寸/重量/数量，或复制现有模板，指定后续交付站。移走货物的来源站时会清理后续无来源卸货；其他站序矛盾在计算前明确拒绝。

「起点载货」可选当前柜或空车。修改仅更新输入，不自动运行求解；「计算装卸方案」在后台线程求解，完成后打开「执行方案」与 3D 作业播放。导出计划保留人员参数及任务，导出执行记录保留起点优化、临移与操作快照。

默认工人进舱：地面方形占位宽 600 mm、净高 1800 mm、水平取货距离 800 mm、取货起点高度不超过 2100 mm，均可编辑。这些是规划假设，不是人体工学标准。连通走道采用保守网格搜索，边也验证扫掠碰撞；不能把上方没有挡货但地面被封死的货物直接判为可卸。支持门外取货或显式设备抽取模式，后者不声明人员可达。

启用「出发前按站序优化摆放」时，在同一货舱中尝试晚卸在深处、早卸水平靠门的分区布局，并贴近门端压紧。只有全批保留且通过原约束校验、靠门与可达评分不变差时采用；否则保留原布局，明确记录原因。出发前重排不算途中倒货。

核心新增：`src/core/multistop/access.ts`（可达）、`planning.ts`（库存与初始布置），`src/demo/RouteComposer.tsx`（人工编排），`route-workspace.css`、`native-app.css`（工作台与原生统一视觉）。移除原 WK 中整段强制覆色注入，使用可维护的共享样式。

## 本地运行

应用包包含计算脚本、静态网页、数据、港口资料和运行时。无需本机 Node、tsx、项目 checkout 或手动启动本地服务器。用于运算的 Electron 二进制只按 Node 模式启动，不提供另一个桌面窗口。内嵌功能的本地服务仅监听 127.0.0.1 随机端口；网页原有端口及启动方式保留。

退出应用会结束重算进程和本地服务。当前是本机 ad-hoc 签名试用版，不是 Developer ID 公证/App Store 发布版。

## 开发

```bash
npm ci
npm run build
zsh mac/assembly/build.sh
output/CargoPlanAssembly.app/Contents/MacOS/CargoPlanAssembly --self-check
output/CargoPlanAssembly.app/Contents/MacOS/CargoPlanAssembly --repack-smoke
output/CargoPlanAssembly.app/Contents/MacOS/CargoPlanAssembly --ui-smoke
`--shell-smoke` 检查三个原生标签、港口知识目录及装配状态保留；`--support-smoke` 检查海运知识库内的 CargoPlan 助手、天津规则问答与离开港口页后隐藏。原生检查须在 macOS 上重新运行。
output/CargoPlanAssembly.app/Contents/MacOS/CargoPlanAssembly --full-editor-smoke
output/CargoPlanAssembly.app/Contents/MacOS/CargoPlanAssembly --drag-smoke
output/CargoPlanAssembly.app/Contents/MacOS/CargoPlanAssembly --manual-route-smoke
output/CargoPlanAssembly.app/Contents/MacOS/CargoPlanAssembly --vehicle-route-smoke
output/CargoPlanAssembly.app/Contents/MacOS/CargoPlanAssembly --resize-smoke
output/CargoPlanAssembly.app/Contents/MacOS/CargoPlanAssembly --cancel-smoke
```

`build.sh` 依赖先构建的 dist、已安装的 Electron 运行时、Swift / macOS SDK。输出兼容旧路径 `output/CargoPlanAssembly.app`；正式体验入口为 Applications 中的 CargoPlan。

源码：

- `Sources/main.swift`：装配编辑、单窗工作区宿主、生命周期、自检。
- `Sources/NativeGlobe.swift`：RealityKit 地球、合批港点、球面选择和原生资料面板。
- `Sources/WorkspaceWeb.swift`：同窗内嵌模块、局部深色主题、原生上下文、包内服务、导入导出。
- `Sources/NativeFiles.swift` 与 `native-io.mjs`：原生文件操作与网页同一 Excel 解析、模板及导出。
- `src/demo/NativeCargoEditor.tsx`：共享网页完整参数表单，通过本地 WK 消息回传原生货物模型。
- `bundle.mjs`：打包后端、Worker、重算入口和前端静态资源。
- `repack.mjs`：网页同一 planWithComparison 路径、旧方案 seed 和货物守恒校验。
- `src/demo/NativeRouteWorkspace.tsx`：接收原生货柜上下文的多站点入口，不影响常规网页版。

## 验收（以下为 1.5 历史记录）

1.7 最新验收以 `docs/NATIVE_APP_170_FIXES.md` 和 `output/native-170-validation/acceptance.json` 为准：35 文件 / 258 项单元测试、11 项默认安装版原生检查通过。开发交接及新增 `--progress-smoke`、`--edit-preview-smoke` 入口见根目录 `CURSOR_HANDOVER.md`。

`--shell-smoke` 检查三个原生标签、港口知识目录及装配状态保留；`--support-smoke` 检查海运知识库内的 CargoPlan 助手、天津规则问答与离开港口页后隐藏。原生检查须在 macOS 上重新运行。

`--full-editor-smoke` 实际打开共享参数页，修改高度、重量、顶部承重后保存，确认回传原生模型并转入待装池。`--drag-smoke` 验证选中、单击不改动与拖动坐标变化；另通过真实界面鼠标拖动验收，坐标从 0/1984/915 变为 587/2024/915 mm。

`--ui-smoke` 检查待装件编辑、非法参数拒绝、尺寸超限留待装、异步重算和七件守恒。包内 Excel 管道验收：生成模板 → 导入 10 件 → 求解 1 柜、0 待装且校验通过 → 导出 Excel。网页 32 文件 / 242 测试、lint、类型检查与构建通过。

日志为 `output/native-150-*.log`；模板、求解结果及截图为 `output/native-150-validation/`。安装产物通过 ad-hoc 签名完整性校验。`--manual-route-smoke` 通过真实表单建立空车、两件取货、后站交付与四站行程，再显式计算，默认人员模式全部完成。

## 边界

1.7 原生装配工作区已自动保存和恢复（包括待装及 dirty 状态）。多站题目 / 结果与助手历史尚无统一跨重启保存，应导出所需计划和执行记录；切换标签保留不等于关闭后恢复。界面上“退出编辑”不会删除待装货物，但未点“应用参数”的完整表单输入仍属于编辑草稿。

原生装配仍按外包包围盒显示和保守提示交叠，空腔嵌套由最终求解引擎校验。完整约束编辑复用 HTML 表单，修改后交给同一引擎校验；不代表所有候选参数组合都可装载。多站点动画仍为内嵌 Three.js，尚非 RealityKit；没有把随机挑战承诺为必定可行。人员模型按地面通道及触及范围做保守筛查，未求解人体姿态、抓握、搬运能力、门洞或设备轨迹；多站规划仍为单车、既定站序。知识数据是本地快照，不是实时全球合规判定。

人工业务样例：`examples/multistop/manual-worker-four-stops.problem.json`，可在多站点「导入计划」打开；苏州取两件，无锡卸一件并取一件，常州与南京分别交付。结果记录为 `output/native-150-validation/manual-four-stops.result.json`，逐站库存 2 / 2 / 1 / 0、零临移，已在原生实际界面导入、求解并播放。验收汇总：`output/native-150-validation/acceptance.json`。
