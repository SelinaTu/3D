// #created 11/08/2026
import { mkdirSync, writeFileSync } from 'node:fs'
import { loadResearchCalibration, researchCalibrationProvenance, compareResearchWithPdf } from '../core/research-calibration'
import { assessResearchCandidate, canonicalResearchSolution } from '../core/research-metrics'
import { optimize } from '../core/optimizer'

const calibration = loadResearchCalibration('data/calibration/packing-contract.json')
const output = 'delivery-output/research/pdf-projection-hybrid'
mkdirSync(output, { recursive: true })
const start = Date.now()
console.log(JSON.stringify({ event: 'hybrid-start', input: calibration.items.length, config: calibration.config }))
const solution = optimize(calibration.items, { ...calibration.config, timeLimit: 60000, populationSize: 8, generations: 15 })
const assessed = assessResearchCandidate(solution, calibration.items, calibration.config)
const result = { provenance: researchCalibrationProvenance(calibration), elapsedMs: Date.now() - start, solution: canonicalResearchSolution(assessed), metrics: assessed.metrics, pdfComparison: compareResearchWithPdf(assessed.metrics, calibration), validation: assessed.validation }
writeFileSync(`${output}/result.json`, JSON.stringify(result, null, 2))
console.log(JSON.stringify({ ...result, solution: { containers: solution.totalContainers, unpacked: solution.unpackedItems.length, notes: solution.notes }, metrics: { ...assessed.metrics, containers: assessed.metrics.containers.map(c => ({ id: c.canonicalId, count: c.placedItems, volumeM3: c.solidVolumeM3, envelopeM3: c.outerEnvelopeSumM3 })) }, provenance: undefined }, null, 2))
