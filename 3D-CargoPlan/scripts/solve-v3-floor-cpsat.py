#created 11/08/2026
import json,sys,time,hashlib,os
from ortools.sat.python import cp_model
problem_path,answer_path=sys.argv[1:3]
start=time.monotonic()
p=json.load(open(problem_path));model=cp_model.CpModel();scale=p['scale'];L=p['length'];W=p['width']
vars_by_bin=[[] for _ in p['bins']];oldvars=[];newvars=[];objective=[]
for bi,container in enumerate(p['bins']):
    for component in container['components']:
        index=len(oldvars);x0,y0=component['original'];width,height=component['size']
        if component['frozen']: x=model.new_int_var(x0,x0,f'old_{index}_x');y=model.new_int_var(y0,y0,f'old_{index}_y')
        else:x=model.new_int_var(0,L-width,f'old_{index}_x');y=model.new_int_var(0,W-height,f'old_{index}_y')
        model.add_hint(x,x0);model.add_hint(y,y0)
        entry={'x':x,'y':y,'selected':None,'boxes':component['boxes'],'frozen':component['frozen'],'source':component,'index':index,'bin':bi};oldvars.append(entry);vars_by_bin[bi].append(entry)
for gi,group in enumerate(p['groups']):
    row=[]
    for bi in range(len(p['bins'])):
        selected=model.new_bool_var(f'new_{gi}_{bi}_selected');x=model.new_int_var(0,L-group['size'][0],f'new_{gi}_{bi}_x');y=model.new_int_var(0,W-group['size'][1],f'new_{gi}_{bi}_y')
        chosen=group.get('required',False)and bi==group.get('originalBin');model.add_hint(selected,int(chosen));model.add_hint(x,group['original'][0]if chosen else 0);model.add_hint(y,group['original'][1]if chosen else 0)
        entry={'x':x,'y':y,'selected':selected,'boxes':group['boxes'],'frozen':False,'group':gi,'bin':bi};row.append(entry);vars_by_bin[bi].append(entry);objective.append(selected*group.get('score',group['quantity']))
    model.add(sum(e['selected'] for e in row)==1)if group.get('required')else model.add(sum(e['selected'] for e in row)<=1);newvars.append(row)
# Identical source W07 groups may exchange bins. Sorting their selected bin/XY
# breaks identity symmetry without removing any physical arrangement.
family_ranks={}
rank_stride=(L+1)*(W+1);absent_rank=len(p['bins'])*rank_stride
for gi,group in enumerate(p['groups']):
    if group.get('family'):
        rank=model.new_int_var(0,absent_rank,f'family_rank_{gi}')
        selected_any=sum(e['selected']for e in newvars[gi])
        for bi,e in enumerate(newvars[gi]):model.add(rank==bi*rank_stride+e['y']*(L+1)+e['x']).only_enforce_if(e['selected'])
        model.add(rank==absent_rank).only_enforce_if([e['selected'].Not()for e in newvars[gi]])
        family_ranks.setdefault(group['family'],[]).append(rank)
for ranks in family_ranks.values():
    for a,b in zip(ranks,ranks[1:]):model.add(a<=b)
# Alternative macros sharing source identities are mutually exclusive.
identity_groups={}
for gi,group in enumerate(p['groups']):
    for unit in group['units']:identity_groups.setdefault(unit['item']['id'],[]).append(gi)
for indices in identity_groups.values():
    if len(indices)>1:model.add(sum(newvars[gi][bi]['selected']for gi in indices for bi in range(len(p['bins'])))<=1)
# Members in each support/nesting component keep their relative pose. Across
# components, inclusive vertical 5mm activity prevents introducing new support.
separations=0
for bi,entries in enumerate(vars_by_bin):
    for ai,a in enumerate(entries):
        for b in entries[ai+1:]:
            if a['frozen'] and b['frozen']:continue
            if 'group'in a and 'group'in b and a['group']==b['group']:continue
            if a['selected'] is None and b['selected'] is None and a['source']['id']==b['source']['id']:continue
            keys=set()
            for aa in a['boxes']:
                for bb in b['boxes']:
                    # coordinates are doubled integer millimetres
                    gap=0 if aa['rack'] and bb['rack'] else 10
                    if aa['z1']+gap<bb['z0'] or bb['z1']+gap<aa['z0']:continue
                    key=(aa['x'],aa['y'],aa['w'],aa['h'],bb['x'],bb['y'],bb['w'],bb['h'],gap)
                    if key in keys:continue
                    keys.add(key);choices=[model.new_bool_var(f'sep_{separations}_{k}')for k in range(4)];separations+=1
                    model.add(a['x']+aa['x']+aa['w']+gap<=b['x']+bb['x']).only_enforce_if(choices[0])
                    model.add(b['x']+bb['x']+bb['w']+gap<=a['x']+aa['x']).only_enforce_if(choices[1])
                    model.add(a['y']+aa['y']+aa['h']+gap<=b['y']+bb['y']).only_enforce_if(choices[2])
                    model.add(b['y']+bb['y']+bb['h']+gap<=a['y']+aa['y']).only_enforce_if(choices[3])
                    if a['selected'] is not None:choices.append(a['selected'].Not())
                    if b['selected'] is not None:choices.append(b['selected'].Not())
                    model.add_bool_or(choices)
# All existing bin assignments remain fixed; new optional groups add their true
# source weights, independently of the geometric objective.
for bi,c in enumerate(p['bins']):model.add(sum(newvars[gi][bi]['selected']*g['weightGrams']for gi,g in enumerate(p['groups']))+c['weightGrams']<=p['maxWeightGrams'])
model.maximize(sum(objective))
model_path=answer_path+'.model.txt';open(model_path,'w').write(str(model.proto))
class Capture(cp_model.CpSolverSolutionCallback):
    def __init__(self):super().__init__();self.count=0;self.best=-1
    def on_solution_callback(self):
        self.count+=1
        score=int(round(self.objective_value))
        if score<=self.best:return
        self.best=score
        answer={'status':'FEASIBLE_CHECKPOINT','objective':score,'bestBound':self.best_objective_bound,'wallTime':self.wall_time,'elapsedSeconds':time.monotonic()-start,'solutionCount':self.count,'old':[{'id':e['source']['id'],'bin':e['bin'],'x':self.value(e['x']),'y':self.value(e['y'])}for e in oldvars],'added':[{'group':e['group'],'bin':e['bin'],'x':self.value(e['x']),'y':self.value(e['y'])}for row in newvars for e in row if self.value(e['selected'])]}
        with open(answer_path+'.checkpoint.tmp','w')as f:json.dump(answer,f)
        os.replace(answer_path+'.checkpoint.tmp',answer_path+'.checkpoint.json')
        print(json.dumps({'event':'cpsat-checkpoint','added':score,'bound':self.best_objective_bound,'elapsedSeconds':time.monotonic()-start}),flush=True)
solver=cp_model.CpSolver();solver.parameters.max_time_in_seconds=float(sys.argv[3])if len(sys.argv)>3 else 30;solver.parameters.num_search_workers=8;solver.parameters.random_seed=20261018;solver.parameters.log_search_progress=False
callback=Capture();status=solver.solve(model,callback);name=solver.status_name(status)
answer={'status':name,'objective':None,'bestBound':solver.best_objective_bound,'wallTime':solver.wall_time,'elapsedSeconds':time.monotonic()-start,'solutionCount':callback.count,'branches':solver.num_branches,'conflicts':solver.num_conflicts,'separationClauses':separations,'problemSha256':hashlib.sha256(open(problem_path,'rb').read()).hexdigest(),'solverVersion':__import__('ortools').__version__,'scope':'Local fixed-bin component translations with optional prescribed floor macros; status is not a global packing optimality proof.'}
if status in(cp_model.OPTIMAL,cp_model.FEASIBLE):
    answer.update({'objective':int(round(solver.objective_value)),'old':[{'id':e['source']['id'],'bin':e['bin'],'x':solver.value(e['x']),'y':solver.value(e['y'])}for e in oldvars],'added':[{'group':e['group'],'bin':e['bin'],'x':solver.value(e['x']),'y':solver.value(e['y'])}for row in newvars for e in row if solver.value(e['selected'])]})
with open(answer_path,'w')as f:json.dump(answer,f,indent=2)
print(json.dumps({k:v for k,v in answer.items()if k not in('old','added')}),flush=True)
