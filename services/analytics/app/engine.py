from __future__ import annotations
from collections import Counter
from hashlib import sha256
from math import comb, exp
import numpy as np
from scipy.stats import hypergeom

def theoretical_hit_probability(N:int,k:int,b:int,h:int)->float:
 if h<max(0,k-(N-b)) or h>min(b,k): return 0.0
 return comb(b,h)*comb(N-b,k-h)/comb(N,k)
def pair_null_probability(N:int,k:int)->float:return k*(k-1)/(N*(N-1))
def dataset_digest(contests:list[int],draws:list[list[int]])->str:
 raw="|".join(f"{c}:{','.join(map(str,sorted(d)))}" for c,d in zip(contests,draws))
 return sha256(raw.encode()).hexdigest()
def analyze(draws:list[list[int]],universe:int,drawn:int,windows:list[int]):
 output={"formula_version":"descriptive-v1","pair_null_probability":pair_null_probability(universe,drawn),"windows":{}}
 for window in sorted(set(windows+[len(draws)])):
  sample=draws[-window:] if window<len(draws) else draws
  n=len(sample); counts=Counter(x for d in sample for x in d); expected=drawn/universe
  alpha=2/(min(window,50)+1); ema={x:expected for x in range(1,universe+1)}
  for d in sample:
   present=set(d)
   for x in ema:ema[x]=alpha*(1 if x in present else 0)+(1-alpha)*ema[x]
  numbers=[]
  for x in range(1,universe+1):
   c=counts[x];p=(c+1)/(n+2) if n else expected;gap=next((i for i,d in enumerate(reversed(sample)) if x in d),None)
   numbers.append({"number":x,"count":c,"frequency":c/n if n else 0,"smoothed":p,"expected":expected,"deviation":p-expected,"ema":ema[x],"gap":gap})
  sums=[sum(d) for d in sample];odd=[sum(v%2 for v in d) for d in sample]
  output["windows"][str(window)]={"n":n,"contest_coverage":n,"numbers":numbers,"sum":{"mean":float(np.mean(sums)) if sums else None,"p05":float(np.percentile(sums,5)) if sums else None,"p95":float(np.percentile(sums,95)) if sums else None},"odd":{"mean":float(np.mean(odd)) if odd else None}}
 return output
def _rng(seed:int):return np.random.Generator(np.random.PCG64(seed))
def generate(draws:list[list[int]],universe:int,pick:int,count:int,seed:int,strategy:str,fixed:list[int],excluded:list[int],max_overlap:int|None):
 if set(fixed)&set(excluded):raise ValueError("fixed and excluded intersect")
 if len(set(fixed))!=len(fixed) or any(n<1 or n>universe for n in fixed+excluded):raise ValueError("invalid constraints")
 pool=np.array([n for n in range(1,universe+1) if n not in fixed and n not in excluded]);need=pick-len(fixed)
 if need<0 or len(pool)<need:raise ValueError("infeasible constraints")
 recent=draws[-100:];counts=Counter(x for d in recent for x in d);weights=np.array([counts[int(n)]+1 for n in pool],dtype=float);weights/=weights.sum();rng=_rng(seed);games=[];seen=set();attempts=0
 while len(games)<count and attempts<count*500:
  attempts+=1;p=weights if strategy=="recent-frequency" else None;chosen=rng.choice(pool,size=need,replace=False,p=p);nums=tuple(sorted(fixed+chosen.tolist()))
  if nums in seen:continue
  if max_overlap is not None and any(len(set(nums)&set(g))>max_overlap for g in games):continue
  seen.add(nums);sums=[sum(d) for d in draws[-100:]];percentile=(sum(s<=sum(nums) for s in sums)/len(sums)*100) if sums else None
  games.append(nums)
 if len(games)<count:raise ValueError("constraints or overlap limit are infeasible within budget")
 return {"strategy":strategy,"seed":seed,"prng":"numpy-pcg64","score_version":"adherence-v1","games":[{"numbers":g,"score":None if not draws else round(100-abs(50-(sum(s<=sum(g) for s in [sum(d) for d in draws[-100:]])/min(100,len(draws))*100)),2),"explanation":{"sum_percentile":None if not draws else round(sum(s<=sum(g) for s in [sum(d) for d in draws[-100:]])/min(100,len(draws))*100,2),"window":min(100,len(draws)),"notice":"Score de aderência histórica; não é chance de ganhar."}} for g in games]}
def backtest(contests,draws,universe,drawn,pick,tickets,seeds,min_training,strategy):
 runs=[]
 for seed in seeds:
  hits=[]
  for i in range(min_training,len(draws)):
   batch=generate(draws[:i],universe,pick,tickets,seed*1_000_003+i,strategy,[],[],None)
   hits.append([len(set(g["numbers"])&set(draws[i])) for g in batch["games"]])
  flat=[h for contest in hits for h in contest];runs.append({"seed":seed,"contests":len(hits),"mean_hits":float(np.mean(flat)) if flat else None,"contest_means":[float(np.mean(x)) for x in hits]})
 baseline=pick*drawn/universe
 return {"protocol":"walk-forward-v1","target_leakage":False,"contest_is_unit":True,"theoretical_mean_hits":baseline,"runs":runs,"conclusion":"Sem evidência de vantagem sobre o acaso; resultados descritivos exigem protocolo temporal e incerteza."}
