import argparse
import psycopg
from app.settings import settings
from app.training import train
parser=argparse.ArgumentParser(); parser.add_argument('--workspace',required=True);parser.add_argument('--service',required=True);parser.add_argument('--metric',required=True);parser.add_argument('--limit',type=int,default=5000);parser.add_argument('--epochs',type=int,default=25)
a=parser.parse_args()
with psycopg.connect(settings.database_url) as conn:
    rows=conn.execute("SELECT m.value FROM metric_samples m JOIN services s ON s.id=m.service_id WHERE m.workspace_id=%s AND s.name=%s AND m.metric_name=%s ORDER BY m.observed_at DESC LIMIT %s",(a.workspace,a.service,a.metric,a.limit)).fetchall()
values=[float(r[0]) for r in reversed(rows)]
if len(values)<64: raise SystemExit(f'Need at least 64 samples; found {len(values)}')
result=train(values,f'{a.service}__{a.metric}',a.epochs); print(result)
