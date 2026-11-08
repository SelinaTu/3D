<!-- #created 11/08/2026 -->
# CargoPlan Mac 桌面版 · 2026-10-31

网页版继续使用原有 Vite / Node 启动方式。桌面版用 Electron 复用同一 React / Three.js 界面与 TypeScript 计算引擎，无需为两端分别实现算法。

## 安装与使用

当前提供 Apple Silicon（arm64）团队试用版：

- `output/desktop/release/CargoPlan-1.1.0-mac-arm64.dmg`：打开后将 CargoPlan 拖入 Applications。
- 同目录 `.zip`：解压得到 `.app`，也可直接使用。
- 同目录 `mac-arm64/CargoPlan.app`：本机已构建应用。


这是 Electron 桌面应用，界面由网页技术渲染。当前尚未配置 Developer ID 签名、公证或自动更新；不是 Mac App Store 发行包，分发到其他 Mac 可能被系统安全检查阻止。Intel 版本尚未构建验证。

## 运行结构

- `desktop/main.mjs`：应用生命周期、菜单、隔离窗口、外部链接、PDF 导出、自定义协议。
- `desktop/server.mjs`：独立 utility process 启动现有 Express 服务，仅监听 `127.0.0.1` 随机端口。
- `cargoplan://app/`：稳定应用地址，转发本地资源与 API；不会占用网页版 3101/3001。
- `desktop/preload.cjs`：只开放工作区导航回调，不向页面开放 Node 或通用 IPC。
- `desktop/smoke.mjs`：真实 Electron 运行测试；开发版、打包后应用均可运行。
- `electron-builder.config.cjs`：筛选桌面入口、构建前端、后端、示例数据及生产依赖；排除源码映射。
- `scripts/package-mac.mjs`：使用 macOS 自带 ditto / hdiutil 生成 ZIP、DMG、SHA256。

窗口启用 sandbox 和 contextIsolation，禁用 nodeIntegration；页面只允许本地资源执行脚本，外部 HTTPS/HTTP 来源在系统浏览器打开。运筹任务仍运行在原有计算 Worker 中，浏览器侧规划/多站模块继续使用 Web Worker。关闭最后一个窗口遵循 Mac 应用习惯，应用仍在菜单栏运行；Command + Q 退出并结束计算服务。

## 开发与构建

```bash
npm ci
npm run desktop:dev    # 生产资源构建后启动本地桌面开发窗口
npm run desktop:smoke  # 使用已经构建的资源，自动启动/测试/退出
npm run desktop:pack  # 构建 arm64 .app
npm run desktop:dist  # .app + ZIP + DMG + SHA256
```

如依赖安装环境跳过 Electron 安装脚本，需执行 `node node_modules/electron/install.js` 下载运行时。首次依赖安装需要联网；最终应用的装配和已有知识数据可离线运行，点击在线资料来源需要联网。下载网络受限时可显式设置 Electron 下载镜像，安装器仍使用 npm 包携带的校验和验证归档。

打包后验收：

```bash
env -u ELECTRON_RUN_AS_NODE output/desktop/release/mac-arm64/CargoPlan.app/Contents/MacOS/CargoPlan --desktop-smoke
```

该测试使用独立临时用户目录，不覆盖日常应用配置。记录和截图位于 `output/desktop/`。测试覆盖稳定协议地址、渲染器隔离、WebGL2、1371 件示例、后端真实计算及约束校验、五站六件练习题生成/求解/重放、原生菜单导航、地球仪本地资源。

## 当前边界

这一版完成独立桌面运行和分发，不改变原有装配规则或提高算法最优性保证。尚未新增通用项目文件保存/恢复、项目自动保存、云端同步、自动更新及机器人设备连接。编辑状态沿用现有网页的内存状态，关闭或刷新前须使用已有导出功能保存所需结果；多站题目可导出 JSON 并重新导入。港口知识仍为原有静态快照和已标注完整度，不是实时全球合规库。

完整项目持久化应作为下一项单独实现：统一项目数据结构、版本迁移、原子写入和恢复校验，不能只保存页面截图或 localStorage。
