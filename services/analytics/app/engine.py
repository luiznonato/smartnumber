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
def _validate_constraints(universe,pick,fixed,excluded):
 if set(fixed)&set(excluded):raise ValueError("fixed and excluded intersect")
 if len(set(fixed))!=len(fixed) or len(set(excluded))!=len(excluded):raise ValueError("duplicate constraints")
 if any(n<1 or n>universe for n in fixed+excluded):raise ValueError("invalid constraints")
 pool=np.array([n for n in range(1,universe+1) if n not in fixed and n not in excluded])
 need=pick-len(fixed)
 if need<0 or len(pool)<need:raise ValueError("infeasible constraints")
 return pool,need
def _weighted_games(rng,pool,need,fixed,count,probabilities=None,max_overlap=None):
 games=[];seen=set();attempts=0
 while len(games)<count and attempts<max(1000,count*500):
  attempts+=1
  chosen=rng.choice(pool,size=need,replace=False,p=probabilities)
  nums=tuple(sorted(fixed+chosen.tolist()))
  if nums in seen:continue
  if max_overlap is not None and any(len(set(nums)&set(game))>max_overlap for game in games):continue
  seen.add(nums);games.append(nums)
 if len(games)<count:raise ValueError("constraints or overlap limit are infeasible within budget")
 return games
def _number_weights(draws,universe,drawn,window,alpha,tau):
 sample=draws[-window:];actual_window=len(sample);p0=drawn/universe
 counts=Counter(number for draw in sample for number in draw)
 probabilities={number:(counts[number]+alpha*p0)/(actual_window+alpha) for number in range(1,universe+1)}
 weights={number:(probabilities[number]/p0)**tau for number in probabilities}
 return sample,counts,p0,probabilities,weights
def _structural_features(numbers,universe,previous):
 cuts=(int(np.ceil(universe/3)),int(np.ceil(2*universe/3)))
 ranges=(sum(number<=cuts[0] for number in numbers),sum(cuts[0]<number<=cuts[1] for number in numbers),sum(number>cuts[1] for number in numbers))
 return {"sum":sum(numbers),"odd":sum(number%2 for number in numbers),"ranges":ranges,"previous_overlap":len(set(numbers)&set(previous))}
def _adherence_components(features,history_features,pick):
 sums=[item["sum"] for item in history_features];bandwidth=max(1,(max(sums)-min(sums))//10) if sums else 1;n=len(history_features)
 sum_density=(sum(abs(value-features["sum"])<=bandwidth for value in sums)+1)/(n+2)
 odd_frequency=(sum(item["odd"]==features["odd"] for item in history_features)+1)/(n+pick+2)
 range_frequency=(sum(item["ranges"]==features["ranges"] for item in history_features)+1)/(n+len(set(item["ranges"] for item in history_features))+1)
 overlap_frequency=(sum(item["previous_overlap"]==features["previous_overlap"] for item in history_features)+1)/(n+pick+2)
 return {"sum":sum_density,"parity":odd_frequency,"ranges":range_frequency,"previous_overlap":overlap_frequency}
def _profile_scores(candidates,draws,universe,pick,reference_rng,reference_size,pool,need,fixed):
 history_features=[_structural_features(draw,universe,draws[index-1] if index else []) for index,draw in enumerate(draws)]
 reference=_weighted_games(reference_rng,pool,need,fixed,reference_size)
 raw_reference=[]
 for game in reference:
  features=_structural_features(game,universe,draws[-1])
  components=_adherence_components(features,history_features,pick)
  combined=.30*components["sum"]+.25*components["parity"]+.25*components["ranges"]+.20*components["previous_overlap"]
  raw_reference.append((components,combined))
 output=[]
 for game in candidates:
  features=_structural_features(game,universe,draws[-1]);components=_adherence_components(features,history_features,pick)
  combined=.30*components["sum"]+.25*components["parity"]+.25*components["ranges"]+.20*components["previous_overlap"]
  component_percentiles={key:round(100*sum(ref[0][key]<=value for ref in raw_reference)/len(raw_reference),2) for key,value in components.items()}
  score=round(100*sum(ref[1]<=combined for ref in raw_reference)/len(raw_reference),2)
  output.append({"numbers":game,"score":score,"explanation":{"observed":{"sum":features["sum"],"odd":features["odd"],"ranges":list(features["ranges"]),"previous_overlap":features["previous_overlap"]},"component_percentiles":component_percentiles,"component_weights":{"sum":.30,"parity":.25,"ranges":.25,"previous_overlap":.20},"reference_size":reference_size,"notice":"Percentil de aderência em referência uniforme; não é chance de ganhar."}})
 return output
def generate(draws:list[list[int]],universe:int,pick:int,count:int,seed:int,strategy:str,fixed:list[int],excluded:list[int],max_overlap:int|None,window:int=50,alpha:float=10,tau:float=1,reference_size:int=2000,base_strategy:str="recent-frequency"):
 allowed={"uniform","random-baseline","recent-frequency","historical-profile","diversified"}
 if strategy not in allowed:raise ValueError("unknown strategy")
 pool,need=_validate_constraints(universe,pick,fixed,excluded);rng=_rng(seed)
 if strategy in {"uniform","random-baseline"}:
  games=_weighted_games(rng,pool,need,fixed,count,None,max_overlap)
  return {"strategy":"uniform","strategy_version":"uniform-v2","seed":seed,"prng":"numpy-pcg64","score_version":None,"sample":{"n":0,"window":None},"games":[{"numbers":game,"score":None,"explanation":{"method":"Amostragem uniforme sem reposição.","notice":"Sem análise histórica; referência de comparação."}} for game in games]}
 if strategy=="diversified":
  if base_strategy not in {"recent-frequency","historical-profile","uniform"}:raise ValueError("invalid diversified base strategy")
  candidate_count=min(max(count*20,100),1000)
  base=generate(draws,universe,pick,candidate_count,seed,base_strategy,fixed,excluded,None,window,alpha,tau,reference_size,"recent-frequency")
  remaining=list(base["games"]);selected=[]
  while remaining and len(selected)<count:
   def rank(game):
    overlap=max((len(set(game["numbers"])&set(chosen["numbers"]))/len(set(game["numbers"])|set(chosen["numbers"])) for chosen in selected),default=0)
    return (overlap,-(game["score"] if game["score"] is not None else 0),tuple(game["numbers"]))
   chosen=min(remaining,key=rank);remaining.remove(chosen)
   max_jaccard=max((len(set(chosen["numbers"])&set(previous["numbers"]))/len(set(chosen["numbers"])|set(previous["numbers"])) for previous in selected),default=0)
   chosen={**chosen,"explanation":{**chosen["explanation"],"diversity":{"metric":"jaccard","max_with_selected":round(max_jaccard,4),"candidate_pool":candidate_count,"base_strategy":base_strategy},"notice":"Diversidade da carteira; não aumenta a chance de cada bilhete."}}
   selected.append(chosen)
  return {"strategy":"diversified","strategy_version":"diversified-v1","seed":seed,"prng":"numpy-pcg64","score_version":base["score_version"],"sample":base["sample"],"games":selected}
 minimum=10 if strategy=="recent-frequency" else 25
 if len(draws)<minimum:raise ValueError(f"insufficient history: available={len(draws)}, required={minimum}")
 actual_window=min(window,len(draws));sample=draws[-actual_window:];drawn=len(sample[-1])
 if strategy=="recent-frequency":
  sample,counts,p0,probabilities,weights=_number_weights(draws,universe,drawn,actual_window,alpha,tau)
  probability_array=np.array([weights[int(number)] for number in pool],dtype=float);probability_array/=probability_array.sum()
  games=_weighted_games(rng,pool,need,fixed,count,probability_array,max_overlap)
  return {"strategy":strategy,"strategy_version":"recent-frequency-v2","seed":seed,"prng":"numpy-pcg64","score_version":None,"sample":{"n":actual_window,"window":window},"parameters":{"alpha":alpha,"tau":tau,"p0":p0},"games":[{"numbers":game,"score":None,"explanation":{"window":actual_window,"alpha":alpha,"tau":tau,"p0":round(p0,8),"numbers":[{"number":number,"count":counts[number],"smoothed_frequency":round(probabilities[number],8),"relative_weight":round(weights[number],8)} for number in game],"method":"Amostragem ponderada sem reposição.","notice":"Pesos heurísticos de frequência observada; não são probabilidades futuras."}} for game in games]}
 candidate_count=min(max(count*40,200),2000);candidates=_weighted_games(rng,pool,need,fixed,candidate_count)
 reference_rng=_rng(seed^0x9E3779B97F4A7C15);scored=_profile_scores(candidates,sample,universe,pick,reference_rng,reference_size,pool,need,fixed)
 scored.sort(key=lambda game:(-game["score"],tuple(game["numbers"])))
 selected=[]
 for game in scored:
  if max_overlap is None or all(len(set(game["numbers"])&set(previous["numbers"]))<=max_overlap for previous in selected):selected.append(game)
  if len(selected)==count:break
 if len(selected)<count:raise ValueError("constraints or overlap limit are infeasible within budget")
 return {"strategy":strategy,"strategy_version":"historical-profile-v1","seed":seed,"prng":"numpy-pcg64","score_version":"profile-reference-percentile-v1","sample":{"n":actual_window,"window":window},"parameters":{"reference_size":reference_size},"games":selected}
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
