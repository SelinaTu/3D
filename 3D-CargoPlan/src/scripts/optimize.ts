#!/usr/bin/env tsx
// #created 11/08/2026

import { parseExcelData, expandCargoItems } from '../core/data-parser'
import { optimizeMultiple, DEFAULT_CONFIG } from '../core/optimizer'
import { fileURLToPath } from 'node:url'

const filePath = process.argv[2] || fileURLToPath(new URL('../../data/sample-cargo.xlsx', import.meta.url))

async function main() {
  console.log('🚀 3D装箱优化系统')
  console.log('━'.repeat(60))
  console.log('')

  try {
    // 1. 解析数据
    console.log('📄 步骤1: 加载货物数据...')
    const items = parseExcelData(filePath)
    const expanded = expandCargoItems(items)
    console.log(`✅ 已加载 ${expanded.length} 个货物单元`)
    console.log('')

    // 2. 运行优化
    console.log('🧮 步骤2: 运行多种算法优化...')
    console.log('')

    const solutions = await optimizeMultiple(expanded, DEFAULT_CONFIG)

    // 3. 显示结果
    console.log('📊 步骤3: 优化结果对比')
    console.log('━'.repeat(60))
    console.log('')

    solutions.forEach((solution, idx) => {
      console.log(`方案 ${idx + 1}: ${solution.algorithm.toUpperCase()}`)
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
      solution.containers.forEach((container, cidx) => {
        console.log(`    柜 ${cidx + 1}:`)
        console.log(`      货物数: ${container.items.length}`)
        console.log(`      总重量: ${(container.totalWeight / 1000).toFixed(2)} 吨`)
        console.log(`      体积利用率: ${(container.volumeUtilization * 100).toFixed(2)}%`)
      })

      console.log('')
    })

    // 4. 推荐方案
    const best = solutions[0]
    console.log('━'.repeat(60))
    console.log(`🎯 推荐方案: ${best.algorithm.toUpperCase()}`)
    console.log(`   未装入 ${best.unpackedItems.length} 件；不可与原11柜直接比较，需先确认相同货物范围和约束。`)
    console.log('')

  } catch (error) {
    console.error('❌ 错误:', error instanceof Error ? error.message : error)
    console.error(error)
    process.exit(1)
  }
}

main()
