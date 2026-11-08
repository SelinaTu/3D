<!-- #created 11/08/2026 -->
# CargoPlan 原生 3D 与开源借鉴评审

核对日期：2026-10-31。范围：仓库现状、开源项目 README / Package.swift、Apple 官方框架路线，以及本机基础编译能力。未声称下列开源项目已在本项目编译、集成或通过性能测试。

## 结论

知识地球仪可以完全改成原生 3D。当前 `mac/knowledge-globe/Sources/main.swift` 明确使用 WKWebView 和本地 HTTP 服务；地球仍来自 Three.js。原生装配则使用 AppKit / SceneKit，是另一条渲染路径。

建议：新增地球仪以 SwiftUI / AppKit 原生界面 + RealityKit 为默认原型方向，借鉴已有开源地球的材质和交互；对需要港区、道路、地图下钻的后续版本，再验证 ImmersiveMap。现有 SceneKit 装配保留，先把交互与数据协议做一致，不为更换引擎重写装配计算。

“页面感”也来自整页卡片、导航和操作方式。原生化需要同时调整空间层次、镜头、选中反馈与侧栏布局，不能只替换球体渲染器。

## 开源候选

### 1. SwiftGlobe：快速原生地球参考

项目：[dmojdehi/SwiftGlobe](https://github.com/dmojdehi/SwiftGlobe)。README 提供 macOS 目标、SceneKit 球体材质、缩放/平移和发光标记。可参考其光照、球体、坐标与镜头组织。

限制：README 基于 Swift 5 / Xcode 11.4；不等于适配当前工具链。README 声明 MIT，但其 LICENSE.md 链接本次返回 404，正式复制代码前须补核许可文件；纹理来自另列来源，也需单独确认。不是港口知识或 GIS 平台。

### 2. DotGlobe：点阵地球视觉参考

项目：[inventhq/dot-globe](https://github.com/inventhq/dot-globe)。MIT；[Package.swift](https://github.com/inventhq/dot-globe/blob/main/Package.swift) 声明 macOS 12 / iOS 14。可借鉴发光点阵、星空与颜色。

限制：README 的交互/动画仍有 TODO，并明确指出点云参数修改存在性能问题。不能当作已解决 11,835 个业务港点拾取、筛选和选中状态的成熟组件。

### 3. ImmersiveMap：最值得进一步实测的地图底座

项目：[artembobkin/ImmersiveMap](https://github.com/artembobkin/ImmersiveMap)。MIT，Swift + Metal；[Package.swift](https://github.com/artembobkin/ImmersiveMap/blob/main/Package.swift) 声明 Swift 6、macOS 15。支持原生地球/平面地图与标记，适合未来节点下钻。

限制：单维护者项目。概览资源随包，详细地图默认读取远程 PMTiles；不能将整个地图直接宣称为离线。地图数据有独立署名要求。是否适合本项目，需实测自有港点、11k 点性能、断网、坐标对齐和打包。

### 4. Satin：需要定制渲染时再采用

项目：[Hi-Rez/Satin](https://github.com/Hi-Rez/Satin)。MIT；[Package.swift](https://github.com/Hi-Rez/Satin/blob/main/Package.swift) 声明 macOS 14。提供 Metal 场景、实例网格、材质、镜头及拾取等能力。

适合大量港点、货物渲染或专用着色器的后续性能工作。它是图形框架，不提供现成港口地球仪；当前直接采用仍需实现产品层，不能认为比高层框架更快交付。

### 5. WhirlyGlobe：不作为本轮底座

项目：[mousebird-consulting-inc/WhirlyGlobe](https://github.com/mousebird-consulting-inc/WhirlyGlobe)。项目面向 iOS / Android，README 已声明不再积极维护。可以参考 GIS 分层思想，不因其有完整地球 SDK 就认定可直接接入 AppKit macOS。

## Apple 框架路线与现有代码

[Apple WWDC25 官方说明](https://developer.apple.com/videos/play/wwdc2025/288/)明确 SceneKit 已软弃用、处于维护模式，已有应用继续运行；新项目和大改建议采用 RealityKit。现有装配没有必要立即重写，但不建议继续把所有新模块都绑定到 SceneKit。

本机为 macOS 26.4.1、Swift 6.3.1、Command Line Tools 环境。已实际执行 `swiftc -typecheck`：导入 SwiftUI / RealityKit，创建球体 MeshResource 与 ModelEntity 通过。此检查仅确认基础 API / SDK 可用，尚未验证完整窗口、渲染、打包或大规模标记性能。

## 产品体验应怎样变化

- 一个原生主窗口，3D 占据主视区；工具栏只放搜索、筛选、视角、播放控制，列表和资料作为可收起的侧栏。
- 地球：有体积的球体、克制的大气层光晕、灯光和地表层次；支持触控板旋转、缩放、点击港点与镜头平滑定位。
- 选中港口时暂停自转，清楚显示位置、名称和唯一代码；基本港点与已有知识包分级。自转、拖动与定位使用一致的坐标变换，避免港点漂移。
- 11,835 个基础点采用合批网格/实例等渲染方式验证，不创建 11,835 个独立原生视图。标签只展示选中及少量重点港点；密集区支持放大或列表辅助选择。
- 右侧原生检查器承接公约 / 国家 / 港口 / 费用、来源、日期、缺口，复用现有 JSON 与 Markdown；不把完整网页嵌入地球模块。
- 装配：统一选中轮廓、拖拽反馈、尺寸辅助线、待装池及检查器。原生真实空间操作仍须由同一个运筹引擎最终校验。

地球弧线可以表达用户输入的海陆运输关系，必须明确是示意，不作为航道、船期或卡车路线求解结果。

## 可复用的数据

`globe/data/ports.json`、`countries.json`、`reviews.json`、`land.json` 和已建港口包继续作为共享数据源。保持 locode、坐标、来源和资料完整度语义一致。原生化不会自动补全多数港点的知识。

## 建议的最小原型验收

1. 完全原生窗口和球体渲染，运行不启动 WKWebView / 本地网页服务器。
2. 本地加载全部基础港点与知识包标记；选中上海、新加坡、印尼港口与基础港点，档案和来源准确对应。
3. 验证自转、用户接管、背面遮挡、近距离点选、跨半球定位及缩放，不发生穿球或标记漂移。
4. 最大港点数量和缩放/旋转时记录帧时间、内存、CPU/GPU 占用；选中标记没有卡顿，不能仅以“原生”为性能结论。
5. 完整断网启动和读取现有知识；在线出处只在用户主动打开时访问。
6. 接回同一原生主窗口的装配工作区，统一侧栏与工具栏，而不是再增加一个孤立演示应用。

本轮完成调研与建议，未替换当前知识地球仪实现。
