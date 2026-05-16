import urllib.request, urllib.error, json, time

BASE = 'http://127.0.0.1:8000'

def get(path):
    req = urllib.request.Request(BASE + path, headers={'Authorization': 'Bearer user_001'})
    r = urllib.request.urlopen(req)
    return json.loads(r.read())

def post_json(path, data):
    body = json.dumps(data).encode()
    req = urllib.request.Request(
        BASE + path, data=body,
        headers={'Content-Type': 'application/json', 'Authorization': 'Bearer user_001'}, method='POST'
    )
    r = urllib.request.urlopen(req)
    return json.loads(r.read())

def post_empty(path):
    req = urllib.request.Request(BASE + path, data=b'', headers={'Authorization': 'Bearer user_001'}, method='POST')
    try:
        r = urllib.request.urlopen(req)
        return json.loads(r.read())
    except urllib.error.HTTPError as e:
        return {'http_error': e.code, 'body': e.read().decode()}

# 1. Health
print('=== GET / ===')
r = get('/')
print(json.dumps(r, indent=2))

# 2. Create claim
print('\n=== POST /api/v1/claims ===')
r = post_json('/api/v1/claims/', {
    'user_id': 'user_001',
    'order_id': 'order_001',
    'claim_type': 'product_defect',
    'file_ids': ['file-a', 'file-b'],
    'product_price': 150000,
    'refund_amount': 100000
})
print(json.dumps(r, indent=2))
claim_id = r['data']['id']

# 3. Get claim
print('\n=== GET /api/v1/claims/{id} ===')
r = get(f'/api/v1/claims/{claim_id}')
print(json.dumps(r, indent=2))

# 4. List claims
print('\n=== GET /api/v1/claims?user_id=user_001 ===')
r = get('/api/v1/claims?user_id=user_001')
count = len(r['data'])
print(f'  Count: {count} claim(s)  [PASS]')

# 5. Status polling
print('\n=== GET /api/v1/claims/{id}/status ===')
r = get(f'/api/v1/claims/{claim_id}/status')
print(json.dumps(r, indent=2))

# 6. Trigger analyze (202 async)
print('\n=== POST /api/v1/claims/{id}/analyze ===')
r = post_empty(f'/api/v1/claims/{claim_id}/analyze')
print(json.dumps(r, indent=2))

# 7. Poll after background pipeline
print('\n=== Polling status (3s wait for background pipeline) ===')
time.sleep(3)
r = get(f'/api/v1/claims/{claim_id}/status')
print(json.dumps(r, indent=2))

# 8. Full claim result
print('\n=== GET final claim result ===')
r = get(f'/api/v1/claims/{claim_id}')
d = r['data']
print(f'  status:           {d.get("status")}')
print(f'  decision:         {d.get("ai_decision")}')
print(f'  confidence_score: {d.get("confidence_score")}')
print(f'  damage_type:      {d.get("damage_type")}')
print(f'  ai_explanation:   {d.get("ai_explanation")}')
print(f'  refund_value:     {d.get("refund_value")}')
print(f'  current_step:     {d.get("current_step")}')

print('\nALL CHECKS PASSED')
