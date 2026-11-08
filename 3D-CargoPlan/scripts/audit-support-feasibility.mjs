// #created 11/08/2026
/** Run with: node --import tsx scripts/audit-support-feasibility.mjs */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { orientationsFor } from '../src/core/packing-utils.ts'
import { geometryFor, unionArea } from '../src/core/solid-geometry.ts'

const manifestPath = 'data/demo-items.json'
const manifestBytes = readFileSync(manifestPath)
const items = JSON.parse(manifestBytes.toString('utf8'))
const dimensions = { length: 11600, width: 2250, height: 2500 }
const bySource = {}
const rows = []
let areaMm2 = 0
for (const item of items) {
  // Rack/rack pairs have zero clearance, so racks are omitted entirely from
  // this bound; allowing them to use no floor space only weakens the bound.
  if (item.rawData._sourceSheet === '玻璃架') continue
  const exception = item.rawData._sourceSheet === '门窗' && item.rawData._sourceRow === 16
    && item.name.includes('W02') && item.dimensions.length === 3030
    && item.dimensions.width === 2560 && item.dimensions.height === 160
  const height = exception ? 2560 : dimensions.height
  const variants = orientationsFor(item).filter(v => v.dimensions.length <= dimensions.length
    && v.dimensions.width <= dimensions.width && v.dimensions.height <= height)
  assert.ok(variants.length, `${item.id}: no legal container orientation`)
  const minimumArea = Math.min(...variants.map(v => unionArea(geometryFor({
    item, orientation: v.orientation, rotation: v.rotation,
    actualDimensions: v.dimensions, position: { x: 0, y: 0, z: 0 },
  }).bottom)))
  areaMm2 += minimumArea
  const source = String(item.rawData._sourceSheet)
  bySource[source] = (bySource[source] ?? 0) + minimumArea / 1e6
  rows.push({ id: item.id, minimumActualFloorContactAreaM2: minimumArea / 1e6 })
}
const floorAreaMm2 = dimensions.length * dimensions.width
const result = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  manifest: { path: manifestPath, sha256: createHash('sha256').update(manifestBytes).digest('hex') },
  status: 'conditional-lower-bound',
  conditions: {
    dimensions, clearanceMm: 5, clearanceAxes: ['x', 'y', 'z'],
    glassRackPairClearanceMm: 0, verticalSupportMechanism: 'none', supportGapMm: 0,
  },
  reasoning: [
    'Any non-rack cargo pair needs 5 mm separation, including a non-rack resting above a rack.',
    'Without a spacer or other declared bridge, load transfer requires actual contact. A 5 mm air gap cannot support cargo.',
    'Thus every non-rack must touch the container floor, including cargo nested within a frame; an internal frame rail still needs a supported gap.',
    'For each non-rack, minimize its true material bottom-contact area over all legal orientations, with the W02 height exception.',
    'Distinct cargo floor-contact material regions cannot overlap. Hollow openings are excluded, and all rack floor area and all clearance floor area are omitted.',
    'The sum of these minima divided by one container floor area is a necessary container-count lower bound under the stated no-spacer conditions.',
  ],
  nonRackCargoUnits: rows.length,
  minimumNonRackActualFloorAreaM2: areaMm2 / 1e6,
  bySourceM2: bySource,
  singleContainerFloorAreaM2: floorAreaMm2 / 1e6,
  elevenContainerFloorAreaM2: floorAreaMm2 * 11 / 1e6,
  requiredContainersAtLeast: Math.ceil((areaMm2 - 1e-6) / floorAreaMm2),
  conclusion: 'With all-axis 5 mm clearance and no spacer load transfer, 11 containers is infeasible; this is a model-calibration finding, not an optimized packing result.',
  rows,
}
assert.equal(result.nonRackCargoUnits, 1341)
assert.ok(Math.abs(result.minimumNonRackActualFloorAreaM2 - 469.96215) < 1e-6)
assert.equal(result.requiredContainersAtLeast, 19)
mkdirSync('data/calibration', { recursive: true })
writeFileSync('data/calibration/support-feasibility.json', JSON.stringify(result, null, 2) + '\n')
console.log(JSON.stringify({ ...result, rows: `${rows.length} per-unit floor-area entries written` }, null, 2))
