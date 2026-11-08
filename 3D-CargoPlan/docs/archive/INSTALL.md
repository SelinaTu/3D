<!-- #created 11/08/2026 -->
# 🛠️ 安装和运行指南

## ⚠️ 前置要求

npm缓存可能有权限问题，请先运行：

```bash
sudo chown -R $(id -u):$(id -g) "$HOME/.npm"
```

然后清理缓存：

```bash
npm cache clean --force
```

## 📦 安装步骤

```bash
cd /Users/lege/Projects/cargoplan

# 1. 安装依赖
npm install

# 2. 测试数据解析
npm run parse

# 3. 运行优化算法
npm run optimize

# 4. 启动Web界面
npm run dev
```

## 🎯 快速演示（无需安装全部依赖）

如果只想测试核心算法，可以：

```bash
# 只安装必要的依赖
npm install --no-optional xlsx typescript tsx

# 运行数据解析
npm run parse

# 运行优化
npm run optimize
```

## 🚀 使用流程

### 1. 命令行模式

```bash
# 解析指定Excel文件
npm run parse /path/to/your/cargo-list.xlsx

# 运行优化并输出结果
npm run optimize /path/to/your/cargo-list.xlsx
```

### 2. Web界面模式

```bash
npm run dev
```

然后：
1. 打开浏览器访问 http://localhost:3000
2. 点击"选择Excel文件"上传货物清单
3. 点击"开始优化"运行算法
4. 在3D视图中查看装箱方案
5. 右侧对比不同算法的结果

## 📊 输出说明

### 命令行输出

```
🚀 3D装箱优化系统
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 步骤1: 加载货物数据...
✅ 已加载 288 个货物单元

🧮 步骤2: 运行多种算法优化...

📊 步骤3: 优化结果对比
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

方案 1: HYBRID
  🚢 容器数量: 9
  📦 体积利用率: 76.43%
  ⚖️  重量利用率: 68.21%
  ⏱️  计算耗时: 15234ms
  🏆 评分: 12450.23

方案 2: GENETIC
  🚢 容器数量: 9
  📦 体积利用率: 74.88%
  ⚖️  重量利用率: 67.55%
  ⏱️  计算耗时: 12456ms
  🏆 评分: 12123.45

...

🎯 推荐方案: HYBRID
   相比原方案可能节省: 2 个集装箱
```

### Web界面

- **左侧面板**：数据统计和控制
- **中间区域**：3D装箱视图（可旋转/缩放）
- **右侧面板**：多方案对比
- **底部**：容器切换按钮

## 🔧 常见问题

### Q1: npm install 失败

**A:** 尝试以下方法：

```bash
# 方法1: 修复权限
sudo chown -R $(id -u):$(id -g) "$HOME/.npm"
npm cache clean --force
npm install

# 方法2: 使用yarn
npm install -g yarn
yarn install

# 方法3: 跳过可选依赖
npm install --no-optional
```

### Q2: tsx命令找不到

**A:** 确保安装了tsx：

```bash
npm install -g tsx
# 或者使用 npx
npx tsx src/scripts/parse-data.ts
```

### Q3: Excel文件解析失败

**A:** 检查：
- 文件路径是否正确
- Excel格式是否符合要求（参考样例文件）
- 第4行是否为表头行

### Q4: 3D视图不显示

**A:** 检查：
- WebGL是否支持（访问 https://get.webgl.org/ 测试）
- 浏览器版本（建议Chrome/Edge最新版）
- 是否有数据加载错误

## 🎓 学习资源

### 算法原理

- **3D装箱问题**：NP-hard问题，无多项式时间最优解
- **贪心算法**：O(n²) 时间复杂度，快速但可能局部最优
- **遗传算法**：O(g×p×n) 时间，全局搜索能力强
- **约束处理**：稳定性、承重、方向限制

### 代码结构

```
核心算法流程：
1. 数据解析 (data-parser.ts)
   └─> Excel → CargoItem[]

2. 货物展开 (expandCargoItems)
   └─> 288类 → 288个独立单元

3. 优化算法 (optimizer.ts)
   ├─> 贪心FFD/BFD
   ├─> 遗传算法
   └─> 混合算法

4. 装箱执行 (packing-utils.ts)
   ├─> 碰撞检测
   ├─> 支撑验证
   └─> 约束检查

5. 方案评估
   └─> 评分排序
```

## 📈 性能优化建议

### 小规模数据 (<100件)
- 使用贪心算法，秒级响应
- `algorithm: 'greedy'`

### 中规模数据 (100-500件)
- 使用混合算法
- `generations: 50`, `populationSize: 30`
- 预计10-30秒

### 大规模数据 (>500件)
- 先用贪心获得基础解
- 再用遗传算法优化关键容器
- 分批处理

## 🎯 下一步

1. **测试核心功能**：运行 `npm run parse` 和 `npm run optimize`
2. **调整参数**：修改 `src/core/optimizer.ts` 中的配置
3. **添加约束**：在 `packing-utils.ts` 中增强约束逻辑
4. **优化算法**：实现模拟退火或其他启发式算法
5. **部署上线**：`npm run build` 生成生产版本

## 🐛 调试技巧

```bash
# 开启详细日志
DEBUG=* npm run optimize

# 单步调试
node --inspect-brk node_modules/.bin/tsx src/scripts/optimize.ts

# 性能分析
node --prof node_modules/.bin/tsx src/scripts/optimize.ts
```

## 💡 提示

- 首次运行建议使用样例数据测试
- 优化时间可通过 `timeLimit` 控制
- 3D渲染性能取决于货物数量（建议<1000件）
- 评分权重可根据实际需求调整

---

**有问题？** 查看 README.md 或提交 Issue
