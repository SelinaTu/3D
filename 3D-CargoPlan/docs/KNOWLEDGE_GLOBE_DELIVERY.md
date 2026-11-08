<!-- #created 11/08/2026 -->
# 海运知识地球仪交付与验收 · 2026-10-31

## 交付结果

主站“港口知识库”已替换为可旋转 3D 地球仪：`http://127.0.0.1:3101/#ports`。
独立静态版：`globe/dist/index.html`，当前本地预览 `http://127.0.0.1:8766/`。
离线发布包：`output/knowledge-globe-offline.zip`。解压后在目录中运行 `python3 -m http.server 8766 --bind 127.0.0.1`，打开本机地址即可。需 WebGL 浏览器；不需要在线地图 API、CDN 或字体服务。

主站与独立版共用 `src/knowledge/globe/`，同一套港口数据、检索、侧栏和地球交互。原独立版外部 CDN 脚本与纹理依赖已从当前入口移除。

## 数据覆盖与解释

| 数据层 | 当前数量 | 含义与缺口 |
|---|---:|---|
| 港口地点 | 11,835 | UN/LOCODE 功能编码含水运港口功能且有坐标；不等于 11,835 个可办理集装箱的海港 |
| 已建港口包 | 22 | 含薄包、骨架和较多资料的包，不统称为完整已核验档案 |
| 国别包 | 9 | CN/ID 较厚，其余 7 个骨架；原整理日期 2026-10-30 |
| 公约/装箱参考 | 5 | SOLAS VGM、CTU Code、CSC、ISPM15、IMDG 高层参考 |
| 本次来源核对条目 | 5 | 独立记录核对日期和适用条件，不扩展为整国、整港已核验 |

港点保留原交接资料的开放镜像来源，未宣称已经同步最新 UNECE 版次。Natural Earth 陆地轮廓仅作位置参考，下载链接和 SHA256 在 `globe/data/land.json`。公开数据使用说明见 [Natural Earth 条款](https://www.naturalearthdata.com/about/terms-of-use/)。

## 实现路径

- `KnowledgeGlobe.tsx`：搜索、国家过滤、知识包过滤、分页索引、快捷港口和总览。
- `GlobeScene.tsx`：本地轮廓生成地球纹理，点云港点、知识港亮点、球面拾取和相机定位。
- `camera.ts`：球面镜头插值，避免跨半球直线运动穿过球体。
- `PortDetails.tsx`：公约 → 国家 → 港口 → 费用四层，默认国家；直接阅读原整理分册。
- `model.ts`：数据类型、查询、来源链接过滤、费用去重和资料完整度标签。
- `globe/data/reviews.json`：本次新增和核对的资料，含中文摘要、来源、条件和日期。
- `vite.globe.config.mjs`：生成完整静态版；通过相对路径加载全部本地资源。

以后补充港口知识应维护数据文件和来源，不需要为每个港口重写页面。新包应关联已有 locode，更新元信息，重新构建并运行数据检查。

## 来源核对记录

- [IMO VGM](https://www.imo.org/en/ourwork/safety/pages/verification-of-the-gross-mass.aspx)：核对托运人责任、装船条件与两种核重方法。
- [Maersk 印尼 WDF 公告](https://www.maersk.com/news/articles/2025/07/31/refresher-of-weight-discrepancy-fee-policy-indonesia)：保留公告收费、计费单位和三类触发条件，标为商业附加费。
- [新加坡 MPA 危货申报](https://www.mpa.gov.sg/port-marine-ops/operations/gas-free-hazardous-cargo-info/declaring-dangerous-goods)：保留不同地点、业务情形的申报要求，不把申报等同于取得全部许可。
- [欧委会 ICS2](https://taxation-customs.ec.europa.eu/customs/customs-security/import-control-system-2_en)：保留 ENS 安全申报参考，在现有 NL/DE 国别层展示，不编造统一罚款。
- [洛杉矶港清洁卡车计划](https://portoflosangeles.org/environment/air-quality/clean-truck-program)：费用区明确列为港口收费，保留收费主体、计费单位与豁免范围提示。

中国原始法规链接本次抓取遇到 403，不标成本次已核验。其他历史资料、媒体线索及未经本次核验的金额保持“待业务复核”。已检查资料不代表未来不发生政策变化。

## 验收

`npm run check`：30 个测试文件、217 项测试，ESLint、TypeScript、主站生产构建、独立静态版构建均通过。

新增数据/地理测试覆盖：计数、唯一 ID、坐标范围、包与港口/国别关联，中文/英文/代码/国名检索，按国别和知识包筛选，基础档案缺口，承运人费用去重，危险链接协议过滤，地理底图与点云共用球面坐标。镜头测试覆盖跨半球转向、对跖点定位不穿入地球及不修改输入。

浏览器实测包括：

1. 主站打开上海，默认国家层展示 VGM、轴型限重和来源；港口层显示作业清单和可读分册。
2. 印尼丹戎不碌费用层仅出现一份 Maersk WDF，保留条件和出处，不与行政罚款混列。
3. 独立本地版正确加载地球和全部港点，HTML 脚本与样式只引用本地相对路径。
4. 独立版定位新加坡后关闭侧栏，直接点击球面港点，可重新打开 SGSIN 对应档案。
5. 无结果查询显示明确空态。法国筛选显示 808 个基础地点；基础港点明确提示缺少专属作业包，不伪造资料。
6. 印尼 + 仅已有知识包筛选得到 5 港，包含待完善状态。

## 尚未覆盖

绝大多数点只有基础坐标；22 个包不是 22 份完整合规档案。尚未完成所有码头截关、承运人收费、各国完整罚表、实时通知订阅或自动法规适用判定。政策知识目前用于查阅和业务核查，没有自动作为装配引擎的硬约束；未提供实时航线、船期和清关服务。
