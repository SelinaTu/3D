#!/usr/bin/env tsx
// #created 11/08/2026

import { parseExcelData, expandCargoItems, calculateStatistics } from '../core/data-parser'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const filePath = process.argv[2] || fileURLToPath(new URL('../../data/sample-cargo.xlsx', import.meta.url))
const outputPath = process.argv[3] || fileURLToPath(new URL('../../data/demo-items.json', import.meta.url))

console.log('📄 解析Excel文件:', filePath)
console.log('')

try {
  const items = parseExcelData(filePath)
  console.log(`✅ 成功解析 ${items.length} 类货物`)
  console.log('')

  // 显示前5项
  console.log('📦 前5项货物:')
  items.slice(0, 5).forEach((item, idx) => {
    console.log(`${idx + 1}. ${item.name}`)
    console.log(`   尺寸: ${item.dimensions.length} × ${item.dimensions.width} × ${item.dimensions.height} mm`)
    console.log(`   重量: ${item.weight} kg`)
    console.log(`   数量: ${item.quantity}`)
    console.log(`   允许方向: ${item.allowedOrientations.join(', ')}`)
    console.log(`   可叠放: ${item.canStackOnTop ? '是' : '否'}`)
    console.log('')
  })

  // 展开货物
  const expanded = expandCargoItems(items)
  console.log(`📊 展开后共 ${expanded.length} 个独立货物单元`)
  writeFileSync(outputPath, JSON.stringify(expanded, null, 2) + '\n', 'utf8')
  console.log(`   全部工作表已导出: ${outputPath}`)
  const reviewCount = expanded.filter(item => item.constraints?.requiresManualReview?.length).length
  console.log(`   需人工确认条件: ${reviewCount} 件（自动算法将列为未装入）`)
  console.log('')

  // 统计信息
  const stats = calculateStatistics(items)
  console.log('📈 统计信息:')
  console.log(`   总件数: ${stats.totalItems}`)
  console.log(`   总重量: ${(stats.totalWeight / 1000).toFixed(2)} 吨`)
  console.log(`   总体积: ${(stats.totalVolume / 1e9).toFixed(2)} 立方米`)
  console.log(`   平均尺寸: ${Math.round(stats.averageDimensions.length)} × ${Math.round(stats.averageDimensions.width)} × ${Math.round(stats.averageDimensions.height)} mm`)
  console.log('')

  console.log('📋 货物分类:')
  for (const [category, count] of stats.categories.entries()) {
    console.log(`   ${category}: ${count} 件`)
  }

} catch (error) {
  console.error('❌ 错误:', error instanceof Error ? error.message : error)
  process.exit(1)
}
