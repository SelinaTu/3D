// #created 11/08/2026
import type { CargoItem } from '../types/packing'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * 沙盘自进化系统
 * 记录装箱决策，学习最优策略
 */

export interface PackingDecision {
  // 决策时的状态
  situation: {
    remainingSpace: number
    currentItems: number
    containerState: {
      volumeUsed: number
      weightUsed: number
      itemCount: number
    }
  }

  // 做出的决策
  decision: {
    selectedItemId: string
    itemVolume: number
    itemWeight: number
    position: { x: number; y: number; z: number }
    rotation: number // 0, 90, 180, 270
    containerIndex: number
  }

  // 决策结果
  outcome: {
    spaceUtilization: number
    feasibility: boolean
    wastedSpace: number
    stabilityScore: number
  }

  // 元数据
  timestamp: number
  projectId: string
}

export interface LearningWeights {
  // 启发式规则权重
  volumeFirst: number // 优先放大件
  cornerPlacement: number // 靠角放置
  layerBuilding: number // 分层构建
  weightBalance: number // 重量平衡
  rotationPreference: number // 旋转偏好

  // 自适应参数
  lastUpdated: number
  successCount: number
  totalDecisions: number
}

export class SandboxLearningSystem {
  private decisionLog: PackingDecision[] = []
  private weights: LearningWeights
  private dataPath: string

  constructor(dataPath = './data/sandbox') {
    this.dataPath = dataPath
    this.weights = this.loadWeights()
  }

  /**
   * 记录一个装箱决策
   */
  recordDecision(decision: PackingDecision): void {
    this.decisionLog.push(decision)

    // 定期保存到磁盘
    if (this.decisionLog.length % 100 === 0) {
      this.saveDecisions()
    }
  }

  /**
   * 从历史决策中学习
   */
  learn(): void {
    if (this.decisionLog.length < 50) {
      console.log('Not enough data to learn (need at least 50 decisions)')
      return
    }

    // 分析成功和失败的决策
    const successfulDecisions = this.decisionLog.filter(
      (d) => d.outcome.spaceUtilization > 70 && d.outcome.stabilityScore > 0.8
    )

    const failedDecisions = this.decisionLog.filter(
      (d) => d.outcome.spaceUtilization < 50 || d.outcome.stabilityScore < 0.5
    )

    console.log(`Analyzing ${successfulDecisions.length} successful decisions...`)
    console.log(`Analyzing ${failedDecisions.length} failed decisions...`)

    // 提取成功决策的特征
    const successPatterns = this.extractPatterns(successfulDecisions)
    const failurePatterns = this.extractPatterns(failedDecisions)

    // 更新权重
    this.updateWeights(successPatterns, failurePatterns)

    // 保存更新后的权重
    this.saveWeights()

    console.log('Learning complete. Updated weights:', this.weights)
  }

  /**
   * 提取决策模式
   */
  private extractPatterns(decisions: PackingDecision[]): {
    avgVolumeRatio: number
    cornerUsageRate: number
    layeringRate: number
    avgRotation: number
  } {
    if (decisions.length === 0) {
      return {
        avgVolumeRatio: 0,
        cornerUsageRate: 0,
        layeringRate: 0,
        avgRotation: 0
      }
    }

    const totalVolume = decisions.reduce(
      (sum, d) => sum + d.decision.itemVolume,
      0
    )
    const avgVolumeRatio = totalVolume / decisions.length

    // 检测靠角放置
    const cornerPlacements = decisions.filter(
      (d) =>
        (d.decision.position.x < 100 || d.decision.position.x > 11500) &&
        (d.decision.position.y < 100 || d.decision.position.y > 2100)
    )
    const cornerUsageRate = cornerPlacements.length / decisions.length

    // 检测分层放置
    const zLevels = new Set(decisions.map((d) => Math.floor(d.decision.position.z / 500)))
    const layeringRate = zLevels.size / Math.max(1, decisions.length / 10)

    // 平均旋转
    const avgRotation =
      decisions.reduce((sum, d) => sum + d.decision.rotation, 0) / decisions.length

    return {
      avgVolumeRatio,
      cornerUsageRate,
      layeringRate,
      avgRotation
    }
  }

  /**
   * 更新启发式权重
   */
  private updateWeights(
    successPatterns: ReturnType<typeof this.extractPatterns>,
    failurePatterns: ReturnType<typeof this.extractPatterns>
  ): void {
    const learningRate = 0.1

    // 体积优先权重
    if (successPatterns.avgVolumeRatio > failurePatterns.avgVolumeRatio) {
      this.weights.volumeFirst += learningRate
    } else {
      this.weights.volumeFirst -= learningRate
    }

    // 靠角放置权重
    if (successPatterns.cornerUsageRate > failurePatterns.cornerUsageRate) {
      this.weights.cornerPlacement += learningRate
    } else {
      this.weights.cornerPlacement -= learningRate
    }

    // 分层构建权重
    if (successPatterns.layeringRate > failurePatterns.layeringRate) {
      this.weights.layerBuilding += learningRate
    } else {
      this.weights.layerBuilding -= learningRate
    }

    // 归一化权重（保持在0-1之间）
    this.weights.volumeFirst = Math.max(0, Math.min(1, this.weights.volumeFirst))
    this.weights.cornerPlacement = Math.max(0, Math.min(1, this.weights.cornerPlacement))
    this.weights.layerBuilding = Math.max(0, Math.min(1, this.weights.layerBuilding))

    this.weights.lastUpdated = Date.now()
    this.weights.totalDecisions += this.decisionLog.length
  }

  /**
   * 获取当前学习到的权重
   */
  getWeights(): LearningWeights {
    return { ...this.weights }
  }

  /**
   * 根据学习到的权重评估物品优先级
   */
  evaluateItemPriority(
    item: CargoItem,
    _containerState: {
      volumeUsed: number
      weightUsed: number
      itemCount: number
    }
  ): number {
    const volume = item.dimensions.length * item.dimensions.width * item.dimensions.height
    const weight = item.weight

    // 综合评分
    let score = 0

    // 体积因素
    score += this.weights.volumeFirst * volume

    // 重量因素（重的在下）
    score += this.weights.weightBalance * (1 / (weight + 1))

    // 形状因素（长方形优先靠边）
    const aspectRatio = Math.max(item.dimensions.length, item.dimensions.width) / Math.min(item.dimensions.length, item.dimensions.width)
    if (aspectRatio > 2) {
      score += this.weights.cornerPlacement * 100
    }

    return score
  }

  /**
   * 保存决策日志
   */
  private saveDecisions(): void {
    try {
      const filePath = join(this.dataPath, 'decisions.json')
      writeFileSync(filePath, JSON.stringify(this.decisionLog, null, 2))
    } catch (error) {
      console.error('Failed to save decisions:', error)
    }
  }

  /**
   * 加载决策日志
   */
  loadDecisions(): void {
    try {
      const filePath = join(this.dataPath, 'decisions.json')
      if (existsSync(filePath)) {
        const data = readFileSync(filePath, 'utf-8')
        this.decisionLog = JSON.parse(data)
      }
    } catch (error) {
      console.error('Failed to load decisions:', error)
    }
  }

  /**
   * 保存权重
   */
  private saveWeights(): void {
    try {
      const filePath = join(this.dataPath, 'weights.json')
      writeFileSync(filePath, JSON.stringify(this.weights, null, 2))
    } catch (error) {
      console.error('Failed to save weights:', error)
    }
  }

  /**
   * 加载权重
   */
  private loadWeights(): LearningWeights {
    try {
      const filePath = join(this.dataPath, 'weights.json')
      if (existsSync(filePath)) {
        const data = readFileSync(filePath, 'utf-8')
        return JSON.parse(data)
      }
    } catch (error) {
      console.error('Failed to load weights:', error)
    }

    // 默认权重
    return {
      volumeFirst: 0.5,
      cornerPlacement: 0.3,
      layerBuilding: 0.4,
      weightBalance: 0.6,
      rotationPreference: 0.2,
      lastUpdated: Date.now(),
      successCount: 0,
      totalDecisions: 0
    }
  }

  /**
   * 生成学习报告
   */
  generateReport(): string {
    const total = this.decisionLog.length
    const successful = this.decisionLog.filter(
      (d) => d.outcome.spaceUtilization > 70
    ).length
    const successRate = total > 0 ? (successful / total) * 100 : 0

    return `
=== 沙盘学习系统报告 ===

决策总数: ${total}
成功决策: ${successful}
成功率: ${successRate.toFixed(2)}%

当前权重:
- 体积优先: ${this.weights.volumeFirst.toFixed(3)}
- 靠角放置: ${this.weights.cornerPlacement.toFixed(3)}
- 分层构建: ${this.weights.layerBuilding.toFixed(3)}
- 重量平衡: ${this.weights.weightBalance.toFixed(3)}
- 旋转偏好: ${this.weights.rotationPreference.toFixed(3)}

最后更新: ${new Date(this.weights.lastUpdated).toLocaleString()}
    `.trim()
  }

  /**
   * 清空学习数据（重新开始）
   */
  reset(): void {
    this.decisionLog = []
    this.weights = {
      volumeFirst: 0.5,
      cornerPlacement: 0.3,
      layerBuilding: 0.4,
      weightBalance: 0.6,
      rotationPreference: 0.2,
      lastUpdated: Date.now(),
      successCount: 0,
      totalDecisions: 0
    }
    this.saveDecisions()
    this.saveWeights()
  }
}
