#!/usr/bin/env tsx
// #created 11/08/2026

import { parseExcelData, expandCargoItems } from '../core/data-parser'
import { greedyPackingFFD } from '../core/greedy-algorithm'
import { DEFAULT_CONFIG } from '../core/optimizer'
import { fileURLToPath } from 'node:url'

const filePath = process.argv[2] || fileURLToPath(new URL('../../data/sample-cargo.xlsx', import.meta.url))

console.log('🚀 3D装箱优化系统 (快速测试版)')
console.log('━'.repeat(60))
console.log('')

try {
  // 1. 解析数据
  console.log('📄 步骤1: 加载货物数据...')
  const items = parseExcelData(filePath)
  const expanded = expandCargoItems(items)
  console.log(`✅ 已加载 ${expanded.length} 个货物单元`)

  // 只取前50个货物进行快速测试
  const testItems = expanded.slice(0, 50)
  console.log(`📦 快速测试模式: 使用前 ${testItems.length} 个货物`)
  console.log('')

  // 2. 运行贪心算法（最快）
  console.log('🧮 步骤2: 运行贪心算法（FFD）...')
  const solution = greedyPackingFFD(testItems, DEFAULT_CONFIG)

  // 3. 显示结果
  console.log('✅ 优化完成！')
  console.log('━'.repeat(60))
  console.log('')

  console.log('📊 优化结果:')
  console.log(`  🚢 容器数量: ${solution.totalContainers}`)
  console.log(`  📦 体积利用率: ${(solution.avgVolumeUtilization * 100).toFixed(2)}%`)
  console.log(`  ⚖️  重量利用率: ${(solution.avgWeightUtilization * 100).toFixed(2)}%`)
  console.log(`  ⏱️  计算耗时: ${solution.computeTime}ms`)
  console.log(`  🏆 评分: ${solution.score.toFixed(2)}`)

  if (solution.unpackedItems.length > 0) {
    console.log(`  ⚠️  未装入货物: ${solution.unpackedItems.length} 件`)
  }

  console.log('')

  // 显示每个容器详情
  solution.containers.forEach((container, idx) => {
    console.log(`  柜 ${idx + 1}:`)
    console.log(`    货物数: ${container.items.length}`)
    console.log(`    总重量: ${(container.totalWeight / 1000).toFixed(2)} 吨`)
    console.log(`    体积利用率: ${(container.volumeUtilization * 100).toFixed(2)}%`)
    console.log('')
  })

  console.log('━'.repeat(60))
  console.log('💡 提示: 这是快速测试版本（50件货物）')
  console.log('   完整优化请运行: npm run optimize')

} catch (error) {
  console.error('❌ 错误:', error instanceof Error ? error.message : error)
  console.error(error)
  process.exit(1)
}
