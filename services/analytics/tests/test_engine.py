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
 past=[[1+(i%8),2+(i%8),3+(i%8)] for i in range(10)];a=generate(past,10,3,3,8,"recent-frequency",[],[],None)
 future=past+[[8,9,10]];b=generate(future[:-1],10,3,3,8,"recent-frequency",[],[],None)
 assert a==b
def test_backtest_uses_only_prior_draws():
 draws=[[1,2],[2,3],[3,4],[4,5],[1,5]]
 r=backtest(list(range(1,6)),draws,5,2,2,2,[1],2,"uniform")
 assert r["target_leakage"] is False and r["runs"][0]["contests"]==3

def test_recent_frequency_uses_documented_smoothing():
 draws=[[1,2] for _ in range(10)]
 result=generate(draws,10,2,1,42,"recent-frequency",[1],[],None,10,10,1)
 explanation=result["games"][0]["explanation"]
 assert result["score_version"] is None
 assert explanation["p0"]==.2
 number_one=next(item for item in explanation["numbers"] if item["number"]==1)
 assert isclose(number_one["smoothed_frequency"],.6)
 assert isclose(number_one["relative_weight"],3)

def test_tau_zero_recovers_uniform_weights():
 draws=[[1,2] for _ in range(10)]
 result=generate(draws,10,2,1,42,"recent-frequency",[],[],None,10,10,0)
 assert all(item["relative_weight"]==1 for item in result["games"][0]["explanation"]["numbers"])

def test_historical_profile_score_uses_independent_reference():
 draws=[[((i+j)%20)+1 for j in range(3)] for i in range(25)]
 result=generate(draws,20,3,2,7,"historical-profile",[],[],None,25,10,1,200)
 assert result["score_version"]=="profile-reference-percentile-v1"
 assert all(0<=game["score"]<=100 for game in result["games"])
 assert all(game["explanation"]["reference_size"]==200 for game in result["games"])

def test_historical_strategy_blocks_insufficient_samples():
 try:generate([[1,2,3]],10,3,1,1,"recent-frequency",[],[],None)
 except ValueError as error:assert "available=1, required=10" in str(error)
 else:raise AssertionError("insufficient history was not blocked")
