#!/usr/bin/env python3
#created 11/08/2026
"""Inspect PDF scene evidence; never label raster-derived candidates as poses."""
import argparse
import collections
import datetime
import hashlib
import json
import pathlib
import shutil
import subprocess

import numpy as np
import pdfplumber
from pypdf import PdfReader

ROOT = pathlib.Path(__file__).resolve().parents[1]


def digest(data):
    return hashlib.sha256(data).hexdigest()


def multiply(a, b):
    return [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1],
            a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3],
            a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]]


def components(mask, minimum_area=200):
    """Four-connected components by row runs; no scipy dependency."""
    parent, nodes, previous = [], [], []

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for y, line in enumerate(mask):
        edges = np.diff(np.pad(line.astype(np.int8), (1, 1)))
        runs = zip(np.where(edges == 1)[0], np.where(edges == -1)[0])
        current, j = [], 0
        for left, right in runs:
            i = len(parent)
            parent.append(i)
            nodes.append([int(left), y, int(right), y+1, int(right-left)])
            current.append((int(left), int(right), i))
            while j < len(previous) and previous[j][1] <= left:
                j += 1
            k = j
            while k < len(previous) and previous[k][0] < right:
                p, q = find(previous[k][2]), find(i)
                if p != q:
                    parent[q] = p
                k += 1
        previous = current
    result = {}
    for i, node in enumerate(nodes):
        key = find(i)
        if key not in result:
            result[key] = node.copy()
        else:
            box = result[key]
            box[0], box[1] = min(box[0], node[0]), min(box[1], node[1])
            box[2], box[3] = max(box[2], node[2]), max(box[3], node[3])
            box[4] += node[4]
    return [{"pixelBoundsExclusive": row[:4], "pureColorPixels": row[4]}
            for row in sorted(result.values(), key=lambda row: -row[4]) if row[4] >= minimum_area]


parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--pdf', default='data/reference/manual-11-container-baseline.pdf')
parser.add_argument('--out', default='data/reconstruction')
parser.add_argument('--extract-pages', default='1,2,19,20')
parser.add_argument('--original-project', default='/Users/lege/Projects/cargoplan')
parser.add_argument('--original-sample', default='/Users/lege/笔记/乐志亮的笔记/研发课题/运筹空间/样例')
args = parser.parse_args()
pdf_path, out = ROOT / args.pdf, ROOT / args.out
out.mkdir(parents=True, exist_ok=True)
extract_pages = {int(page) for page in args.extract_pages.split(',')}
reader, plumber = PdfReader(pdf_path), pdfplumber.open(pdf_path)
baseline = json.loads((ROOT / 'data/calibration/source-baseline.json').read_text())
normalized = json.loads((ROOT / 'data/demo-items.json').read_text())
by_id = {item['id']: item for item in normalized}
allocated_ids = [item_id for row in baseline['rows'] for item_id in row['normalizedIds']]
assert len(baseline['rows']) == 191
assert len(allocated_ids) == len(set(allocated_ids)) == len(normalized) == 1371
assert set(allocated_ids) == set(by_id)
poppler_inspection = {}
for tool, flags in [('pdfinfo', []), ('pdffonts', []), ('pdfimages', ['-list']), ('pdfdetach', ['-list'])]:
    executable = shutil.which(tool)
    if not executable:
        poppler_inspection[tool] = {'available': False}
        continue
    result = subprocess.run([executable, *flags, str(pdf_path)], capture_output=True, text=True, check=True)
    relative = f'pdf-geometry-{tool}.txt'
    (out/relative).write_text(result.stdout)
    poppler_inspection[tool] = {'available': True, 'outputPath': str((out/relative).relative_to(ROOT)),
                                'outputSha256': digest(result.stdout.encode())}
page_inventory, extracted = [], []
top_image = None
for pi, page in enumerate(reader.pages):
    pp = plumber.pages[pi]
    xobjects = page['/Resources'].get('/XObject', {})
    image_refs = {}
    for name, ref in xobjects.items():
        obj = ref.get_object()
        image_refs[str(name)] = {'name': str(name), 'objectId': ref.idnum,
            'subtype': str(obj.get('/Subtype')), 'width': obj.get('/Width'), 'height': obj.get('/Height'),
            'bitsPerComponent': obj.get('/BitsPerComponent'), 'colorSpace': str(obj.get('/ColorSpace')),
            'hasSoftMask': '/SMask' in obj, 'filter': str(obj.get('/Filter'))}
    stack, matrix, placements = [], [1, 0, 0, 1, 0, 0], []
    operations = page.get_contents().operations
    for operands, operator in operations:
        if operator == b'q':
            stack.append(matrix.copy())
        elif operator == b'Q':
            matrix = stack.pop()
        elif operator == b'cm':
            matrix = multiply(matrix, [float(n) for n in operands])
        elif operator == b'Do':
            placements.append({'xobject': str(operands[0]), 'pdfImageMatrix': matrix.copy()})
    # This region is the plots, not the right-hand legend/table. Odd pages have
    # no cargo vector rectangles/curves here; even pages include a callout line.
    plot_right = 825 if pi % 2 == 0 else 898
    in_plot = lambda shape: shape['x0'] < plot_right and shape['x1'] > 34 and shape['top'] > 110 and shape['bottom'] < 735
    rects = [r for r in pp.rects if in_plot(r)]
    lines = [line for line in pp.lines if in_plot(line)]
    curves = [curve for curve in pp.curves if in_plot(curve)]
    inventory = {'page': pi+1, 'containerNumber': pi//2+1,
        'view': 'load-and-top' if pi % 2 == 0 else 'exploded-sides',
        'pageSizePoints': [float(page.mediabox.width), float(page.mediabox.height)],
        'operators': dict(collections.Counter(op.decode() for _, op in operations)),
        'xobjects': list(image_refs.values()), 'imagePlacements': placements,
        'annotations': [str(a.get_object().get('/Subtype')) for a in page.get('/Annots', [])],
        'vectorShapes': {'allRectangles': len(pp.rects), 'allLines': len(pp.lines), 'allCurves': len(pp.curves),
            'plotRectangles': len(rects), 'plotCurves': len(curves),
            'plotLines': [{key: float(line[key]) for key in ['x0', 'top', 'x1', 'bottom']} for line in lines]},
        'cargoCoordinatesEmbedded': False}
    page_inventory.append(inventory)
    if pi+1 in extract_pages:
        for image in page.images:
            ref = image.indirect_reference.idnum
            filename = f'pdf-geometry-page-{pi+1:02}-object-{ref}.png'
            image.image.save(out / filename)
            record = {'page': pi+1, 'objectId': ref, 'path': str((out/filename).relative_to(ROOT)),
                'sizePixels': list(image.image.size), 'mode': image.image.mode,
                'alphaSupportBoundsPixels': list(image.image.getbbox()),
                'decodedPixelSha256': digest(image.image.tobytes()), 'pngSha256': digest((out/filename).read_bytes())}
            extracted.append(record)
            if pi == 0 and image.image.size == (5400, 1400):
                top_image = np.array(image.image.convert('RGBA'))

assert top_image is not None
black = np.all(top_image[:, :, :3] == 0, axis=2) & (top_image[:, :, 3] == 255)
alpha_y, alpha_x = np.where(top_image[:, :, 3] > 0)
left_alpha, right_alpha = int(alpha_x.min()), int(alpha_x.max())
top_alpha, bottom_alpha = int(alpha_y.min()), int(alpha_y.max())
row_counts, col_counts = black.sum(axis=1), black.sum(axis=0)
top_edge = int(np.argmax(row_counts[top_alpha:top_alpha+8]) + top_alpha)
bottom_edge = int(np.argmax(row_counts[bottom_alpha-7:bottom_alpha+1]) + bottom_alpha-7)
left_edge = int(np.argmax(col_counts[left_alpha:left_alpha+8]) + left_alpha)
right_edge = int(np.argmax(col_counts[right_alpha-7:right_alpha+1]) + right_alpha-7)
scale_x, scale_y = 11600/(right_edge-left_edge), 2250/(bottom_edge-top_edge)


def map_bounds(bounds):
    x0, y0, x1, y1 = bounds
    return {'x': [round((x0-left_edge)*scale_x, 3), round((x1-left_edge)*scale_x, 3)],
            'imageYFromTop': [round((y0-top_edge)*scale_y, 3), round((y1-top_edge)*scale_y, 3)],
            'yIfImageBottomIsOrigin': [round((bottom_edge-y1)*scale_y, 3), round((bottom_edge-y0)*scale_y, 3)]}


rows1 = [row for row in baseline['rows'] if row['containerNumber'] == 1]
legend = sorted(plumber.pages[0].rects, key=lambda rect: rect['top'])
assert len(legend) == len(rows1) == 17
patches, w01_patches = [], None
opaque = top_image[:, :, 3] == 255
# The 3D renderer lights top faces: these pixels are brighter than the PDF
# legend swatches. Match only a close dominant palette entry; an occluded group
# must not inherit an unrelated nearest colour.
palette = [(tuple(int(v) for v in color), count)
           for color, count in collections.Counter(map(tuple, top_image[opaque, :3])).items()
           if count >= 200]
for rect, row in zip(legend, rows1):
    rgb = [int(round(float(n)*255)) for n in rect['non_stroking_color']]
    target_rgb = np.clip(np.array(rect['non_stroking_color'], dtype=float)*255*1.2, 0, 255)
    distance, top_rgb = min((float(np.linalg.norm(np.array(color)-target_rgb)), color)
                            for color, _ in palette)
    top_rgb = list(top_rgb) if distance <= 2 else None
    found = components(np.all(top_image[:, :, :3] == top_rgb, axis=2) & opaque) if top_rgb else []
    for component in found:
        component['projectedBoundsMm'] = map_bounds(component['pixelBoundsExclusive'])
    item = by_id[row['normalizedIds'][0]]
    record = {'manifestRowIndex': row['index'], 'name': row['name'], 'sourceRefs': row['sourceRefs'],
        'quantityInContainer': row['quantity'], 'legendRGB': rgb,
        'candidateTopFaceRGB': top_rgb,
        'colorMapping': 'dominant opaque RGB within 2 units of 1.2× legend RGB; lighting hypothesis, not a unit identity',
        'allowedOrientationsFromSourceNotObserved': item['allowedOrientations'],
        'visiblePureColorPatches': found, 'status': 'visible-color-evidence-not-individual-poses'}
    patches.append(record)
    if row['sourceRefs'] == ['门窗:23']:
        w01_patches = found

# Four large visible legs separate into two horizontal frame bands. This is a
# visible footprint candidate, not a claim about the hidden twenty frame poses.
large_legs = [p for p in w01_patches if p['pixelBoundsExclusive'][2]-p['pixelBoundsExclusive'][0] > 200
              and p['pixelBoundsExclusive'][3]-p['pixelBoundsExclusive'][1] > 200]
bands = sorted({(p['pixelBoundsExclusive'][1], p['pixelBoundsExclusive'][3]) for p in large_legs})
frame_candidates = []
for low, high in bands:
    members = [p for p in w01_patches if low <= (p['pixelBoundsExclusive'][1]+p['pixelBoundsExclusive'][3])/2 <= high]
    bounds = [min(p['pixelBoundsExclusive'][0] for p in members), low,
              max(p['pixelBoundsExclusive'][2] for p in members), high]
    mapped = map_bounds(bounds)
    x = sum(mapped['x'])/2 - 6600/2
    y = sum(mapped['yIfImageBottomIsOrigin'])/2 - 990/2
    frame_candidates.append({'sourceRef': '门窗:23', 'pixelBoundsOfVisibleColoredMaterial': bounds,
        'visibleBoundsMm': mapped, 'candidateOrientation': 'flat', 'candidateHorizontalRotation': 0,
        'candidateFootprintMm': {'length': 6600, 'width': 990},
        'centerFittedCandidateXYMm': {'x': round(x, 3), 'yIfImageBottomIsOrigin': round(y, 3)},
        'workingXYIntervalMmNotCertified': {'x': [round(x-8, 3), round(x+8, 3)], 'yIfImageBottomIsOrigin': [round(y-8, 3), round(y+8, 3)]},
        'z': None, 'layerCount': None, 'normalizedIdsAssigned': [], 'verifiedPose': False,
        'assumptions': ['exact 6600×990 footprint chosen from source; source allows other orientations',
                        'image bottom used as Y origin for this candidate only',
                        '±8mm is a conservative working interval for raster/stroke uncertainty, not a measured tolerance']})

search_roots = [pathlib.Path(args.original_project), pathlib.Path(args.original_sample)]
existing_search_roots = [str(p) for p in search_roots if p.exists()]
search_matches = []
if existing_search_roots:
    search = subprocess.run(['rg', '-n', 'Poly3DCollection|matplotlib|pypdf|伊拉克Villa23|孔位为居中示意|装柜及左右',
        *existing_search_roots, '-g', '*.py', '-g', '*.js', '-g', '*.ts', '-g', '*.md',
        '-g', '!**/node_modules/**', '-g', '!**/.git/**', '-g', '!**/dist/**', '-g', '!**/.env*'],
        capture_output=True, text=True, check=False)
    assert search.returncode in (0, 1), search.stderr
    search_matches = search.stdout.strip().splitlines()

data = {'schemaVersion': 1, 'phase': 'pdf-reconstruction-evidence-only',
    'generatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'pdf': {'path': str(pdf_path.relative_to(ROOT)), 'sha256': digest(pdf_path.read_bytes()),
            'metadata': {str(key): str(value) for key, value in (reader.metadata or {}).items()},
            'catalogKeys': list(reader.trailer['/Root'].keys()), 'pages': len(reader.pages),
            'embeddedAttachments': list(reader.attachments.keys()),
            'hasXmpMetadata': reader.trailer['/Root'].get('/Metadata') is not None},
    'calibratedAllocation': {'path': 'data/calibration/source-baseline.json',
        'sha256': digest((ROOT/'data/calibration/source-baseline.json').read_bytes()),
        'rows': 191, 'uniqueAllocatedUnitIds': 1371, 'differenceFromNormalizedIds': 0},
    'normalizedManifest': {'path': 'data/demo-items.json',
        'sha256': digest((ROOT/'data/demo-items.json').read_bytes()), 'units': len(normalized)},
    'popplerInspection': poppler_inspection,
    'inventory': page_inventory, 'extractedRasterImages': extracted,
    'page1TopCalibration': {'objectId': 12, 'pixelSize': [5400, 1400],
        'detectedContainerStrokeCentersPixels': [left_edge, top_edge, right_edge, bottom_edge],
        'netDimensionsMmUsed': [11600, 2250], 'mmPerPixelX': scale_x, 'mmPerPixelY': scale_y,
        'fiveMmInPixelsX': 5/scale_x, 'fiveMmInPixelsY': 5/scale_y,
        'mappingScope': 'approximate orthographic XY of visible color patches; no Z; not certified cargo coordinates',
        'yPhysicalSideUnverified': True},
    'page1TopLegendPatches': patches, 'page1W01FootprintCandidates': frame_candidates,
    'allContainerGroupCandidates': [{'containerNumber': c['containerNumber'], 'manifestPage': c['manifestPage'],
        'groupRows': [{'manifestRowIndex': row['index'], 'sourceRefs': row['sourceRefs'], 'name': row['name'],
            'quantity': row['quantity'], 'sourceDimensions': row['dimensions'],
            'normalizedIds': row['normalizedIds'],
            'sourceAllowedOrientationsNotObserved': by_id[row['normalizedIds'][0]]['allowedOrientations'],
            'observedOrientation': None, 'position': None, 'verifiedPose': False}
            for row in baseline['rows'] if row['containerNumber'] == c['containerNumber']]} for c in baseline['containers']],
    'generationSourceSearch': {'authorizedRootsOnly': [str(p) for p in search_roots],
        'existingRootsSearched': existing_search_roots,
        'extensions': ['py', 'js', 'ts', 'md'], 'matches': search_matches,
        'foundGeneratorOrLayoutCoordinates': False},
    'conclusions': {'embeddedExactSceneAvailable': False, 'page1CargoVectorPathsAvailable': False,
        'approximateVisibleXYRecoverable': True, 'complete1371XYZRecoverableDirectly': False,
        'independentReconstructionStillRequired': True,
        'limits': ['The PDF scene panels are raster images, not vector cargo meshes or coordinate objects.',
                   'Text and color swatches identify aggregate groups, not per-unit poses.',
                   'The top view discards Z and occludes lower layers; colors repeat across identical units.',
                   'The 3D/exploded images do not embed camera matrices, depth buffers or explosion offsets.',
                   'Known dimensions can constrain an inverse fit, but exact XYZ is not read directly from these files.',
                   'Do not label inferred stacks or source-table exceptions as verified PDF geometry.']}}
target = out / 'pdf-geometry-evidence.json'
target.write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
print(json.dumps({'evidence': str(target.relative_to(ROOT)), 'pages': len(reader.pages),
    'rgbRasterPanels': sum(1 for p in page_inventory for x in p['xobjects'] if x['subtype']=='/Image'),
    'attachments': len(reader.attachments), 'extractedImages': len(extracted),
    'page1W01FootprintCandidates': frame_candidates}, ensure_ascii=False, indent=2))
