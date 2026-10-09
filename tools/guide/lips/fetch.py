# Finds public-domain talking-head videos on Wikimedia Commons (White House weekly addresses: one
# or two speakers, to camera) and downloads a 360-480p transcode of each, for the lip analysis.
# Writes clips/clip-<hash of the URL>.webm and clips/chosen.json under the working directory
# (tools/guide/README.md).
import hashlib, json, os, sys, time, urllib.error, urllib.parse, urllib.request

UA = {"User-Agent": "tbs-lip-study/1.0 (research script; contact via the TBS Digital site)"}
API = "https://commons.wikimedia.org/w/api.php"


def get(params):
    url = API + "?" + urllib.parse.urlencode({**params, "format": "json", "formatversion": "2"})
    for attempt in range(6):
        time.sleep(1.5)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(15 * (attempt + 1))
    raise RuntimeError("rate limited")


QUERIES = [
    'intitle:"Weekly Address" filemime:video/webm',
    'intitle:"Weekly Address" Michelle Obama filemime:video/webm',
    'intitle:"Weekly Address" First Lady filemime:video/webm',
]

seen, picks = set(), []
for q in QUERIES:
    res = get({"action": "query", "list": "search", "srsearch": q, "srnamespace": 6, "srlimit": 12})
    for hit in res.get("query", {}).get("search", []):
        t = hit["title"]
        if t in seen:
            continue
        seen.add(t)
        info = get({"action": "query", "titles": t, "prop": "videoinfo", "viprop": "url|size|mime|derivatives|extmetadata"})
        page = info["query"]["pages"][0]
        vi = (page.get("videoinfo") or [{}])[0]
        dur = vi.get("duration") or 0
        lic = ((vi.get("extmetadata") or {}).get("LicenseShortName") or {}).get("value", "")
        ders = [d for d in vi.get("derivatives", []) if d.get("type", "").startswith("video/webm") and 300 <= (d.get("height") or 0) <= 480]
        if not ders:
            continue
        ders.sort(key=lambda d: -d.get("height", 0))
        picks.append({"title": t, "duration": dur, "license": lic, "src": ders[0]["src"], "h": ders[0].get("height")})
        print(f"{t} | {dur:.0f}s | {lic} | {ders[0].get('height')}p")
    if len(picks) >= 40:
        break

# prefer 90-360 s, public domain; one man and, if found, one woman (titles naming her)
pd = [p for p in picks if "public domain" in p["license"].lower() and 90 <= p["duration"] <= 360]
women = [p for p in pd if "Michelle" in p["title"] or "First Lady" in p["title"]]
men = [p for p in pd if p not in women]
chosen = (women[:2] + men[:2])[:4]
os.makedirs("clips", exist_ok=True)
for p in chosen:
    # named by its URL, so a different search on another day never reuses another clip's file;
    # written whole or not at all, so an interrupted download is not mistaken for a clip
    out = f"clips/clip-{hashlib.sha1(p['src'].encode()).hexdigest()[:12]}.webm"
    if not os.path.exists(out):
        print("downloading", p["title"], "->", out)
        with urllib.request.urlopen(urllib.request.Request(p["src"], headers=UA), timeout=300) as r:
            body = r.read()
            size = r.headers.get("Content-Length")
        if size is not None and len(body) != int(size):
            raise RuntimeError(f"short download: {len(body)} of {size} bytes for {p['title']}")
        with open(out + ".part", "wb") as f:
            f.write(body)
        os.replace(out + ".part", out)
    p["file"] = out
json.dump(chosen, open("clips/chosen.json", "w"), indent=1)
print("chosen:", json.dumps(chosen, indent=1))
