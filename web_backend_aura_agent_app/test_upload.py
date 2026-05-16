import urllib.request, json
data = b'--boundary\r\nContent-Disposition: form-data; name="file"; filename="test.jpg"\r\nContent-Type: image/jpeg\r\n\r\nFakeImageContentHere\r\n--boundary--\r\n'
req = urllib.request.Request('http://127.0.0.1:8000/api/v1/upload/', data=data, headers={'Content-Type': 'multipart/form-data; boundary=boundary'}, method='POST')
try:
    r = urllib.request.urlopen(req)
    print("SUCCESS")
    print(json.dumps(json.loads(r.read()), indent=2))
except Exception as e:
    print("ERROR", e)
