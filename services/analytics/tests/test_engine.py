from math import isclose
from app.engine import theoretical_hit_probability,pair_null_probability,dataset_digest,generate,backtest

def test_hypergeometric_sums_to_one():
 assert isclose(sum(theoretical_hit_probability(10,3,4,h) for h in range(4)),1.0)
def test_small_universe_matches_enumeration():
 from itertools import combinations
 tickets=list(combinations(range(1,8),3));draw=(1,2)
 empirical=sum(len(set(t)&set(draw))==2 for t in tickets)/len(tickets)
 assert isclose(empirical,theoretical_hit_probability(7,2,3,2))
def test_pair_probability_without_replacement():assert isclose(pair_null_probability(60,6),1/118)
def test_generation_reproducible_and_valid():
 args=([[1,2,3]],10,3,5,42,"uniform",[],[],None)
 a=generate(*args);b=generate(*args);assert a==b
 assert all(len(set(g["numbers"]))==3 for g in a["games"])
def test_future_changes_do_not_change_past_generation():
 past=[[1,2,3],[2,4,6]];a=generate(past,10,3,3,8,"recent-frequency",[],[],None)
 future=past+[[8,9,10]];b=generate(future[:-1],10,3,3,8,"recent-frequency",[],[],None)
 assert a==b
def test_backtest_uses_only_prior_draws():
 draws=[[1,2],[2,3],[3,4],[4,5],[1,5]]
 r=backtest(list(range(1,6)),draws,5,2,2,2,[1],2,"uniform")
 assert r["target_leakage"] is False and r["runs"][0]["contests"]==3
