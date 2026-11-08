// #created 11/08/2026
/**
 * 3D位置坐标
 */
export interface Position3D {
  x: number
  y: number
  z: number
}

/**
 * 3D尺寸
 */
export interface Dimensions3D {
  length: number  // 长 (mm)
  width: number   // 宽 (mm)
  height: number  // 高 (mm)
}

/**
 * 允许的摆放方向
 */
export type Orientation = 'standing' | 'lying' | 'flat'

/**
 * 货物项
 */
export interface CargoItem {
  id: string
  name: string
  category: string
  dimensions: Dimensions3D
  weight: number  // kg
  quantity: number
  /** Customer-provided unloading sequence; all cargo is assumed aboard initially. */
  unloadStop?: number
  /** Non-box shapes are conservatively modelled using confirmed packaging dimensions. */
  shape?: 'box' | 'frame' | 'cylinder' | 'coil' | 'pipe'
  packaging?: { envelopeConfirmed?: boolean; antiRoll?: boolean }

  // 约束条件
  allowedOrientations: Orientation[]
  /** Source-specific meaning of labels; doors use L/W/H for standing/lying/flat. */
  orientationVerticalAxes?: Partial<Record<Orientation, keyof Dimensions3D>>
  cavity?: {
    /** Rectangular through-opening expressed in the unrotated original axes. */
    dimensions: Dimensions3D
    offset: Position3D
    /** Allowed cavity contents; any matching list grants permission. */
    allowedSourceSheets?: string[]
    allowedCategories?: string[]
    doorOrientation?: Orientation
  }
  forbiddenOrientations?: Orientation[]
  canStackOnTop: boolean
  maxStackWeight?: number  // 顶部最大承重 (kg)
  maxStackCount?: number   // 最大叠放件数
  stackableWith?: string[] // 可叠放对象类型
  hasGlass: boolean
  canOffsetStack: boolean  // 是否可错位叠放

  // 显示标记
  colorTag: string

  // 原始数据
  rawData: Record<string, unknown>
  constraints?: {
    /** Only these rotations about the vertical axis are allowed (degrees). */
    horizontalRotations?: Array<0 | 90 | 180 | 270>
    /** Optional compatibility group; enforced for the entire transport unit. */
    mixGroup?: string
    onlySameMixGroup?: boolean
    mustBeOnFloor?: boolean
    /** Every item directly supported by this unit must rest on its largest face. */
    supportedItemsLargestFaceDown?: boolean
    orientationRules?: Partial<Record<Orientation, {
      maxStackCount?: number
      maxStackWeight?: number
      maxSupportedItemWeight?: number
      strictMaxStackWeight?: boolean
    }>>
    requiresManualReview?: string[]
  }
}

/**
 * 已放置的货物（带位置和方向）
 */
export interface PlacedItem {
  item: CargoItem
  position: Position3D
  orientation: Orientation
  rotation: number  // 0, 90, 180, 270 degrees
  actualDimensions: Dimensions3D  // 根据方向计算后的实际尺寸
}

export type AccessFace = 'x-min' | 'x-max' | 'y-min' | 'y-max' | 'z-max'

/** Configurable planning envelope; not an ergonomic or equipment certification. */
export interface HandlingAccess {
  mode: 'worker-aisle' | 'door-only' | 'mechanical'
  aisleWidthMm: number
  aisleHeightMm: number
  reachMm: number
  maxReachHeightMm: number
}

/**
 * 容器（集装箱）
 */
export interface Container {
  id: string
  dimensions: Dimensions3D
  maxWeight: number  // 最大载重 (kg)
  unloadingDoor?: 'x-min' | 'x-max'
  routeDoors?: AccessFace[]
  handlingAccess?: HandlingAccess
  items: PlacedItem[]
  totalWeight: number
  volumeUtilization: number  // 体积利用率 (0-1)
  weightUtilization: number  // 重量利用率 (0-1)
  centerOfGravity?: Position3D // x=长, y=宽, z=高，单位 mm
  loadingRules?: {
    clearanceMm: number
    glassRacksTouch?: boolean
    preventCrossStopStacking?: boolean
    supportGapMm: number
    supportMechanism: 'none' | '5mm-spacer' | 'pdf-clearance-projection'
    /** Legacy checked both lower and upper; source-item scope permits verified bridging. */
    offsetStackScope?: 'bidirectional' | 'item-only'
    /** Omitted retains the frozen 80% rule. Explicit hull mode removes only its area fraction. */
    supportCriterion?: 'area-80-centroid' | 'centroid-hull'
    heightExceptions: Record<string, number>
  }
}

export interface ValidationReport {
  valid: boolean
  errors: string[]
  warnings: string[]
  scope?: 'geometry-and-load-assumptions'
}

/**
 * 装箱方案
 */
export interface PackingSolution {
  id: string
  containers: Container[]
  totalContainers: number
  totalItems: number
  avgVolumeUtilization: number
  avgWeightUtilization: number
  unpackedItems: CargoItem[]  // 未装入的货物
  score: number  // 方案评分
  algorithm: string
  computeTime: number  // 计算耗时 (ms)
  validation?: ValidationReport
  searchMode?: 'heuristic' | 'bounded-search'
  terminationReason?: 'completed' | 'time-limit' | 'iteration-limit' | 'size-limit'
  notes?: string[]
  unloadAnalysis?: UnloadAnalysis
  stats?: {
    totalVolume: number
    usedVolume: number
    totalWeight: number
    containerCount: number
    volumeUtilization: number  // 体积利用率百分比
    weightUtilization: number  // 重量利用率百分比
    placedItems: number        // 已放置的货物数量
    executionTime: number      // 执行时间 (ms)
  }
}

export interface UnloadAnalysis {
  model: 'straight-door-projection'
  door: 'x-min' | 'x-max'
  blockerPairCount: number
  blockers: Array<{ containerId: string; itemId: string; blockedById: string; stop: number; blockerStop: number; reasons: Array<'door-projection' | 'supports-blocker'> }>
}

/**
 * 优化配置
 */
export interface OptimizationConfig {
  containerDimensions: Dimensions3D
  containerMaxWeight: number
  loadingProfile?: 'villa-pdf' | 'custom'
  /** Minimum separation between cargo in all directions; direct stacking then requires zero clearance. */
  clearanceMm?: number
  /** Optional rear-door projection analysis, with x oriented along vehicle length. */
  unloadingDoor?: 'x-min' | 'x-max'
  /** Disallow direct top stacking between different unloading stops. */
  preventCrossStopStacking?: boolean
  /** Explicit vertical support contract; omitted means no spacer support. */
  verticalSupport?: 'none' | '5mm-spacer' | 'pdf-clearance-projection'
  offsetStackScope?: 'bidirectional' | 'item-only'
  supportCriterion?: 'area-80-centroid' | 'centroid-hull'

  // 优化目标权重
  weights: {
    containerCount: number      // 最小化容器数量
    volumeUtilization: number   // 最大化体积利用率
    weightBalance: number       // 重量平衡
    stabilityPenalty: number    // 稳定性惩罚
  }

  // 算法参数
  algorithm: 'greedy' | 'genetic' | 'tabu' | 'ant-colony' | 'branch-bound' | 'hybrid' | 'compare' | 'simulated-annealing'
  timeLimit?: number  // 时间限制 (ms)
  populationSize?: number  // 遗传算法种群大小
  generations?: number     // 遗传算法代数
  /** Internal absolute deadline, shared across all algorithms in a comparison. */
  deadline?: number
}

/**
 * 空间占用信息（用于碰撞检测）
 */
export interface SpaceBounds {
  min: Position3D
  max: Position3D
}
