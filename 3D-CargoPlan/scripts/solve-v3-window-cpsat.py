#created 11/08/2026
"""Exact repair inside a conservative floor-window model, not global 3-D optimality."""
import hashlib
import json
import os
import sys
import time
from ortools.sat.python import cp_model

problem_path, answer_path = sys.argv[1:3]
started = time.monotonic()
p = json.load(open(problem_path))
optional_count = sum(not item['required'] for item in p['items'])
seed = int(sys.argv[4]) if len(sys.argv) > 4 else 20261018
model = cp_model.CpModel()
L, W, gap = p['length'], p['width'], p['gap']
all_by_bin = [[] for _ in p['bins']]
by_height = [dict() for _ in p['bins']]
options, optional_terms = [], []
rank_stride = (L + 1) * (W + 1)
absent_rank = len(p['bins']) * rank_stride
family_ranks = {}


def union_rectangles(rectangles):
    """Disjoint exact sweep of fixed XY projections; touching edges are harmless."""
    if not rectangles:
        return []
    xs = sorted({a for r in rectangles for a in (r[0], r[2])})
    result, active = [], {}
    for x0, x1 in zip(xs, xs[1:]):
        ys = sorted((y0, y1) for a, y0, b, y1 in rectangles if a < x1 and b > x0)
        merged = []
        for y0, y1 in ys:
            if merged and y0 <= merged[-1][1]:
                merged[-1][1] = max(y1, merged[-1][1])
            else:
                merged.append([y0, y1])
        next_active = {}
        for y0, y1 in merged:
            key = (y0, y1)
            if key in active and active[key][2] == x0:
                rectangle = active[key]
                rectangle[2] = x1
            else:
                rectangle = [x0, y0, x1, y1]
                result.append(rectangle)
            next_active[key] = rectangle
        active = next_active
    return result


for ii, item in enumerate(p['items']):
    row = []
    for vi, variant in enumerate(item['variants']):
        width, depth, height = variant['size']
        for bi in range(len(p['bins'])):
            selected = model.new_bool_var(f'p_{ii}_{vi}_{bi}')
            x = model.new_int_var(0, L - width, f'x_{ii}_{vi}_{bi}')
            y = model.new_int_var(0, W - depth, f'y_{ii}_{vi}_{bi}')
            xi = model.new_optional_fixed_size_interval_var(x, width + gap, selected, f'xi_{ii}_{vi}_{bi}')
            yi = model.new_optional_fixed_size_interval_var(y, depth + gap, selected, f'yi_{ii}_{vi}_{bi}')
            initial = item.get('initial')
            chosen = initial is not None and initial['bin'] == bi and initial['variant'] == vi
            model.add_hint(selected, int(chosen))
            model.add_hint(x, initial['x'] if chosen else 0)
            model.add_hint(y, initial['y'] if chosen else 0)
            entry = {'item': ii, 'variant': vi, 'bin': bi, 'x': x, 'y': y, 'selected': selected, 'xi': xi, 'yi': yi}
            row.append(entry)
            all_by_bin[bi].append(entry)
            by_height[bi].setdefault(height, []).append(entry)
    model.add(sum(e['selected'] for e in row) == 1) if item['required'] else model.add(sum(e['selected'] for e in row) <= 1)
    if not item['required']:
        optional_terms.extend(e['selected'] for e in row)
    rank = model.new_int_var(0, absent_rank, f'rank_{ii}')
    for e in row:
        model.add(rank == e['bin'] * rank_stride + e['y'] * (L + 1) + e['x']).only_enforce_if(e['selected'])
    model.add(rank == absent_rank).only_enforce_if([e['selected'].Not() for e in row])
    initial = item.get('initial')
    model.add_hint(rank, initial['bin'] * rank_stride + initial['y'] * (L + 1) + initial['x'] if initial else absent_rank)
    family_ranks.setdefault(item['family'], []).append(rank)
    options.append(row)

for ranks in family_ranks.values():
    for a, b in zip(ranks, ranks[1:]):
        model.add(a <= b)

obstacle_union_count = 0
for bi, entries in enumerate(all_by_bin):
    model.add_no_overlap_2d([e['xi'] for e in entries], [e['yi'] for e in entries])
    for height, same_height in by_height[bi].items():
        # Include exact nominal support-height contacts too. These ground-only
        # items are isolated; new contacts to frozen roofs are not introduced.
        obstacles = [(r['x0'], r['y0'], r['x1'] + gap, r['y1'] + gap) for r in p['bins'][bi]['obstacles'] if height + gap >= r['z0']]
        rectangles = union_rectangles(obstacles)
        obstacle_union_count += len(rectangles)
        xis, yis = [e['xi'] for e in same_height], [e['yi'] for e in same_height]
        for j, (x0, y0, x1, y1) in enumerate(rectangles):
            xis.append(model.new_fixed_size_interval_var(x0, x1 - x0, f'fx_{bi}_{height}_{j}'))
            yis.append(model.new_fixed_size_interval_var(y0, y1 - y0, f'fy_{bi}_{height}_{j}'))
        model.add_no_overlap_2d(xis, yis)
    model.add(sum(e['selected'] * p['items'][e['item']]['weightGrams'] for e in entries) + p['bins'][bi]['fixedWeightGrams'] <= p['maxWeightGrams'])
model.maximize(sum(optional_terms))
proto = model.proto.SerializeToString()
model_sha = hashlib.sha256(proto).hexdigest()
print(json.dumps({'event': 'window-model-ready', 'items': len(options), 'optionalItems': sum(not i['required'] for i in p['items']), 'choices': sum(map(len, options)), 'obstacleUnionRectangles': obstacle_union_count, 'modelSha256': model_sha, 'buildSeconds': time.monotonic() - started, 'validation': model.validate()}), flush=True)


def placements(reader):
    return [{'item': e['item'], 'variant': e['variant'], 'bin': e['bin'], 'x': reader.value(e['x']), 'y': reader.value(e['y'])} for row in options for e in row if reader.value(e['selected'])]


class Capture(cp_model.CpSolverSolutionCallback):
    def __init__(self):
        super().__init__()
        self.count, self.best = 0, -1

    def on_solution_callback(self):
        self.count += 1
        score = int(round(self.objective_value))
        if score <= self.best:
            return
        self.best = score
        answer = {'status': 'FEASIBLE_CHECKPOINT', 'objective': score, 'bestBound': self.best_objective_bound, 'wallTime': self.wall_time, 'elapsedSeconds': time.monotonic() - started, 'solutionCount': self.count, 'placements': placements(self), 'modelSha256': model_sha, 'allOptionalPlaced': score == optional_count}
        with open(answer_path + '.checkpoint.tmp', 'w') as file:
            json.dump(answer, file)
        os.replace(answer_path + '.checkpoint.tmp', answer_path + '.checkpoint.json')
        print(json.dumps({'event': 'window-checkpoint', 'added': score, 'bound': self.best_objective_bound, 'elapsedSeconds': time.monotonic() - started}), flush=True)
        if score == optional_count:
            self.stop_search()


solver = cp_model.CpSolver()
solver.parameters.max_time_in_seconds = float(sys.argv[3]) if len(sys.argv) > 3 else 65
solver.parameters.num_search_workers = 8
solver.parameters.random_seed = seed
solver.parameters.log_search_progress = False
callback = Capture()
status = solver.solve(model, callback)
answer = {'status': solver.status_name(status), 'objective': None, 'bestBound': solver.best_objective_bound, 'wallTime': solver.wall_time, 'elapsedSeconds': time.monotonic() - started, 'solutionCount': callback.count, 'branches': solver.num_branches, 'conflicts': solver.num_conflicts, 'modelSha256': model_sha, 'problemSha256': hashlib.sha256(open(problem_path, 'rb').read()).hexdigest(), 'solverVersion': __import__('ortools').__version__, 'scope': p['scope'], 'globalOptimalityProven': False, 'seed': seed, 'allOptionalPlaced': callback.best == optional_count}
if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
    answer.update({'objective': int(round(solver.objective_value)), 'placements': placements(solver)})
with open(answer_path, 'w') as file:
    json.dump(answer, file, indent=2)
print(json.dumps({key: value for key, value in answer.items() if key != 'placements'}), flush=True)
