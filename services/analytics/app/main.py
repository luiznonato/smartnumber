import os
from fastapi import FastAPI,HTTPException
from .models import AnalyzeRequest,GenerateRequest,BacktestRequest
from .engine import analyze,generate,backtest,dataset_digest
app=FastAPI(title="Atlas Loto Analytics",version="0.1.0",docs_url="/docs" if os.getenv("ENVIRONMENT")!="production" else None)
def verify(d):
 actual=dataset_digest(d.contest_numbers,d.draws)
 if actual!=d.dataset_hash:raise HTTPException(422,"dataset_hash mismatch")
 if len(d.draws)>int(os.getenv("ANALYTICS_MAX_BATCH","5000")):raise HTTPException(413,"batch too large")
@app.get("/health")
def health():return{"status":"ok"}
@app.post("/v1/analyze")
def do_analyze(r:AnalyzeRequest):verify(r.dataset);return analyze(r.dataset.draws,r.dataset.universe,r.dataset.drawn_count,r.windows)
@app.post("/v1/generate")
def do_generate(r:GenerateRequest):
 verify(r.dataset)
 try:return generate(r.dataset.draws,r.dataset.universe,r.pick_count,r.count,r.seed,r.strategy,r.fixed,r.excluded,r.max_overlap,r.window,r.alpha,r.tau,r.reference_size,r.base_strategy)
 except ValueError as e:raise HTTPException(422,str(e)) from e
@app.post("/v1/backtest")
def do_backtest(r:BacktestRequest):verify(r.dataset);return backtest(r.dataset.contest_numbers,r.dataset.draws,r.dataset.universe,r.dataset.drawn_count,r.pick_count,r.tickets_per_contest,r.seeds,r.min_training,r.strategy)
