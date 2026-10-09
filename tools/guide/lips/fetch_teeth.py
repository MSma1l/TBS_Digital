# The clips teeth.py measures besides fetch.py's: public-domain talking heads on Wikimedia Commons
# whose speakers have LIGHT skin, as hers is (fetch.py's are President and Mrs Obama). Taken by
# exact title, so the set does not drift with the search index: the three whose faces are close
# enough for teeth.py to read the eye whites. (Tried and dropped, faces too small: "A Pride Month
# Message From The Bidens", "The Clinton's New Millennium Live Address (2000)" and President
# Biden's remarks of 14 July 2024.) Writes clips/clip-<hash of the URL>.webm and clips/chosen.json
# under the working directory (tools/guide/README.md).
import hashlib, http.client, json, os, sys, time, urllib.error, urllib.parse, urllib.request

UA = {"User-Agent": "tbs-lip-study/1.0 (research script; contact via the TBS Digital site)"}
API = "https://commons.wikimedia.org/w/api.php"
TITLES = [
    "File:20160709 VPOTUS Weekly Address HD.webm",
    "File:230522-O-NU539-603 - Secretary Blinken's video message to the Sudanese people.webm",
    "File:Hillary Rodham Clinton 2016 concession speech.webm",
]


def fetch(url, timeout):
    for attempt in range(8):
        time.sleep(1.5)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read(), r.headers.get("Content-Length")
        except urllib.error.HTTPError as e:
            # rate-limited, or a server error Commons answers transiently: back off and try again
            if not (e.code == 429 or e.code >= 500) or attempt == 7:
                raise
            time.sleep(30 * (attempt + 1))
        except (urllib.error.URLError, OSError, http.client.HTTPException) as e:
            # HTTPException: a body cut short (IncompleteRead) is not an OSError
            print("retrying after", repr(e), file=sys.stderr, flush=True)
            time.sleep(5 * (attempt + 1))
    raise RuntimeError("gave up on " + url)


chosen = []
os.makedirs("clips", exist_ok=True)
for t in TITLES:
    body, _ = fetch(API + "?" + urllib.parse.urlencode({"action": "query", "titles": t, "prop": "videoinfo",
                    "viprop": "url|size|derivatives|extmetadata", "format": "json", "formatversion": "2"}), 60)
    vi = (json.loads(body)["query"]["pages"][0].get("videoinfo") or [{}])[0]
    lic = ((vi.get("extmetadata") or {}).get("LicenseShortName") or {}).get("value", "")
    if "public domain" not in lic.lower():
        raise RuntimeError(f"not public domain: {t} ({lic})")
    ders = [d for d in vi.get("derivatives", []) if d.get("type", "").startswith("video/webm") and 300 <= (d.get("height") or 0) <= 480]
    ders.sort(key=lambda d: -d.get("height", 0))
    src = ders[0]["src"] if ders else vi["url"]
    out = f"clips/clip-{hashlib.sha1(src.encode()).hexdigest()[:12]}.webm"
    if not os.path.exists(out):
        print("downloading", t, "->", out, flush=True)
        body, size = fetch(src, 300)
        if size is not None and len(body) != int(size):
            raise RuntimeError(f"short download: {len(body)} of {size} bytes for {t}")
        with open(out + ".part", "wb") as f:
            f.write(body)
        os.replace(out + ".part", out)
    chosen.append({"title": t, "duration": vi.get("duration"), "license": lic, "src": src, "file": out})
json.dump(chosen, open("clips/chosen.json", "w"), indent=1)
print("chosen:", json.dumps(chosen, indent=1))
