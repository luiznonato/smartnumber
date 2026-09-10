#!/bin/sh
set -eu
services/analytics/.venv/bin/python -c 'import json,resource,time,sys;sys.path.insert(0,"services/analytics");from app.engine import analyze;D=[list(range(1,16)) if i%2==0 else list(range(11,26)) for i in range(3000)];t=time.perf_counter();r=analyze(D,25,15,[10,25,50,100,250]);print(json.dumps({"synthetic":True,"draws":len(D),"elapsed_seconds":time.perf_counter()-t,"max_rss_kb":resource.getrusage(resource.RUSAGE_SELF).ru_maxrss}))'
