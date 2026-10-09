# How bright a speaker's teeth are, measured on the clips analyze.py measures the lips on (and
# fetch_teeth.py's): MediaPipe Face Mesh on every frame; only the stretches where a face is speaking
# to the camera (frontal for it, the same shot, the lips moving); and in those, every frame whose
# lips are apart. Per frame:
#   teeth - the pixels between the INNER lips, eroded by a pixel so no lip pixel is counted: their
#           brightest tenth (where the teeth show, that is the teeth) and their mean (what the
#           opening is as a whole - all a mouth a few pixels tall shows);
#   seen  - the same two over the whole opening after a blur of SEEN_MM: the opening as it shows at
#           the bust's size (on a desktop at 1.5x one device pixel spans 2.6 mm of her face), where a
#           narrow opening is mixed with the lips around it - in her sharp frames and in the video
#           alike, which a 480p camera has already softened by about a pixel;
#   eyes  - the brightest tenth of each eye's white (the eye's opening, its iris cut out, a pixel in),
#           with the eyes open; the brighter eye counts;
#   chin  - the median of the chin's front, 6.5-11 mm below the lower lip's border and 11 mm either
#           side (the patch tools/guide/mouth.mjs samples as her lit skin), for comparison only.
# Teeth against eye white: two white tissues in one face, so neither the skin's tone nor the
# video's exposure enters. Against the chin both do: with the lips 6-10 mm apart the Obamas' teeth
# come out brighter than their chin, and the light-skinned speakers' anywhere from darker
# (Clinton, Blinken) to brighter (Biden) - docs/04, "How bright her teeth are".
# Brightness is LIGHTNESS: a pixel's luminance (its channels decoded to linear light, Rec. 709
# weights) encoded back as the grey of that luminance, 0-255. A grey is its own value, and so is,
# nearly, a white tooth or an eye white; her portrait's saturated teal comes out as light as it
# looks, where luma (the weights on the encoded channels) reads it darker than a grey as light.
#   python -I teeth.py clips [max_seconds]      -> clips/teeth-rows-<n>.json, clips/teeth-sheet-*.png
#   python -I teeth.py eyes                     -> clips/teeth-eyes-<n>.png, the eye masks, to look at
#   python -I teeth.py her <portrait.png> <out.json>    her eye whites, the portrait at six scales
#   python -I teeth.py pool <her.json> <out.json> <dir> [<dir> ...]    -> measured-teeth.json
import glob, json, math, os, sys
import cv2
import mediapipe as mp
import numpy as np

IPD_MM = 63.0
MOUTH = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]
LIPS = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146]
EYES = [[33, 246, 161, 160, 159, 158, 157, 173, 133, 155, 154, 153, 145, 144, 163, 7],
        [263, 466, 388, 387, 386, 385, 384, 398, 362, 382, 381, 380, 374, 373, 390, 249]]
EAR = [(159, 145, 33, 133), (386, 374, 263, 362)]
IRISES = [(468, (469, 470, 471, 472)), (473, (474, 475, 476, 477))]
SHIFT = 4
K3 = np.ones((3, 3), np.uint8)
BINS = [(2, 4), (4, 6), (6, 8), (8, 10), (10, 12), (12, 16)]
SEEN_MM = 1.0
MIN_PX = 6
MIN_FACE_FRAMES = 300
MIN_BIN_FRAMES = 30


def lightness(bgr):
    """Each pixel's lightness, 0-255: its luminance in linear light, encoded back as a grey's."""
    c = bgr.astype(np.float32) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    y = 0.0722 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.2126 * lin[..., 2]
    return 255.0 * np.where(y <= 0.0031308, 12.92 * y, 1.055 * np.power(np.maximum(y, 0), 1 / 2.4) - 0.055)


def fill(shape, pts):
    m = np.zeros(shape, np.uint8)
    cv2.fillPoly(m, [np.round(np.asarray(pts) * (1 << SHIFT)).astype(np.int32)], 1, lineType=cv2.LINE_8, shift=SHIFT)
    return m


def measure(lm, Y, w, h):
    """One face in one picture: its aperture (mm), its teeth and eye whites, and the two masks."""
    p = lambda i: np.array([lm[i].x * w, lm[i].y * h])
    ipd = float(np.linalg.norm(p(468) - p(473)))
    if ipd < 20:
        return None
    l, r = np.linalg.norm(p(1) - p(234)), np.linalg.norm(p(1) - p(454))
    out = {"ipd": ipd, "cx": lm[1].x, "yaw": float((l - r) / (l + r)),
           "a": float(np.linalg.norm(p(13) - p(14)) / ipd * IPD_MM)}
    whole = fill(Y.shape, [p(i) for i in MOUTH])
    mouth = cv2.erode(whole, K3)
    v = Y[mouth > 0]
    out["teeth_n"] = int(v.size)
    out["teeth_p90"] = float(np.percentile(v, 90)) if v.size >= MIN_PX else None
    out["teeth_mean"] = float(v.mean()) if v.size >= MIN_PX else None
    # the lips themselves: between the outer contour and the opening, a pixel in from both
    outer = fill(Y.shape, [p(i) for i in LIPS])
    lips = cv2.erode(outer, K3) & (1 - cv2.dilate(whole, K3))
    lv = Y[lips > 0]
    out["lips"] = float(np.median(lv)) if lv.size >= MIN_PX else None
    # as seen at the bust's size: blurred around the mouth, over the whole opening and the lips
    out["seen_p90"] = out["seen_mean"] = out["lips_seen"] = None
    ys, xs = np.nonzero(outer)
    if xs.size:
        s = SEEN_MM * ipd / IPD_MM
        m = int(math.ceil(4 * s)) + 1
        x0, x1, y0, y1 = max(0, xs.min() - m), min(w, xs.max() + m + 1), max(0, ys.min() - m), min(h, ys.max() + m + 1)
        blurred = cv2.GaussianBlur(Y[y0:y1, x0:x1], (0, 0), s)
        if v.size >= MIN_PX:
            seen = blurred[whole[y0:y1, x0:x1] > 0]
            out["seen_p90"], out["seen_mean"] = float(np.percentile(seen, 90)), float(seen.mean())
        if lv.size >= MIN_PX:
            out["lips_seen"] = float(np.median(blurred[lips[y0:y1, x0:x1] > 0]))
    # the chin's front, below the lower lip's border (17), along the face's own axes
    px = ipd / IPD_MM
    ex = (p(473) - p(468)) / ipd
    if ex[0] < 0:
        ex = -ex
    ey = np.array([-ex[1], ex[0]])
    o = p(17)
    c = Y[fill(Y.shape, [o + ex * u * px + ey * d * px for u, d in ((-11, 6.5), (11, 6.5), (11, 11), (-11, 11))]) > 0]
    out["chin"] = float(np.median(c)) if c.size >= MIN_PX else None
    whites, ears, sclera = np.zeros(Y.shape, np.uint8), [], []
    for k, eye in enumerate(EYES):
        pts = np.array([p(i) for i in eye])
        ic, ring = min(IRISES, key=lambda it: np.linalg.norm(p(it[0]) - pts.mean(axis=0)))
        rad = float(np.mean([np.linalg.norm(p(j) - p(ic)) for j in ring])) * 1.15
        top, bot, a0, a1 = EAR[k]
        ear = float(np.linalg.norm(p(top) - p(bot)) / max(1e-6, np.linalg.norm(p(a0) - p(a1))))
        m = fill(Y.shape, pts)
        cc = np.round(p(ic) * (1 << SHIFT)).astype(np.int32)
        cv2.circle(m, (int(cc[0]), int(cc[1])), int(round(rad * (1 << SHIFT))), 0, -1, lineType=cv2.LINE_8, shift=SHIFT)
        m = cv2.erode(m, K3)
        s = Y[m > 0]
        ears.append(ear)
        sclera.append(float(np.percentile(s, 90)) if (s.size >= 4 and ear > 0.2) else None)
        whites |= m
    out["ear"], out["sclera"] = ears, sclera
    return out, mouth, whites


def eye_white(row):
    s = [x for x in row["sclera"] if x is not None]
    return max(s) if s else None


def crop(frame, masks, centre, half_w, half_h, scale=4):
    """Around `centre`, enlarged with no smoothing: the picture, then the masks' outlines on it."""
    h, w = frame.shape[:2]
    x0, y0 = int(max(0, centre[0] - half_w)), int(max(0, centre[1] - half_h))
    x1, y1 = int(min(w, centre[0] + half_w)), int(min(h, centre[1] + half_h))
    raw = frame[y0:y1, x0:x1].copy()
    lab = raw.copy()
    for m, colour in masks:
        sub = m[y0:y1, x0:x1]
        lab[(sub - cv2.erode(sub, K3)) > 0] = colour
    big = lambda im: cv2.resize(im, (im.shape[1] * scale, im.shape[0] * scale), interpolation=cv2.INTER_NEAREST)
    return np.hstack([big(raw), np.full((raw.shape[0] * scale, 4, 3), 255, np.uint8), big(lab)])


def sheet(path, tiles):
    wmax = max(t.shape[1] for t in tiles)
    cv2.imwrite(path, np.vstack([cv2.copyMakeBorder(t, 0, 4, 0, wmax - t.shape[1], cv2.BORDER_CONSTANT, value=(255, 255, 255)) for t in tiles]))


def runs(mask):
    out, start = [], None
    for k, m in enumerate(mask):
        if m and start is None:
            start = k
        if not m and start is not None:
            out.append((start, k))
            start = None
    if start is not None:
        out.append((start, len(mask)))
    return out


def speaking(fps, series):
    """analyze.py's speaking_segments, as a per-frame mask."""
    n = len(series)
    ipd = np.array([s["ipd"] if s else np.nan for s in series])
    yaw = np.array([s["yaw"] if s else np.nan for s in series])
    a = np.array([s["a"] if s else np.nan for s in series])
    present = ~np.isnan(ipd)
    keep = np.zeros(n, bool)
    if present.sum() < fps * 2:
        return keep
    ok = present & (np.abs(ipd / np.nanmedian(ipd) - 1) < 0.25) & (np.abs(yaw - np.nanmedian(yaw)) < 0.15)
    win = int(fps)
    sd = np.zeros(n)
    for k in range(n):
        lo, hi = max(0, k - win // 2), min(n, k + win // 2 + 1)
        seg = a[lo:hi][ok[lo:hi]]
        sd[k] = seg.std() if len(seg) > win // 2 else 0.0
    for s0, s1 in runs(ok & (sd > 1.2)):
        if (s1 - s0) / fps >= 1.0:
            keep[s0:s1] = True
    return keep


def mesh(static):
    return mp.solutions.face_mesh.FaceMesh(static_image_mode=static, max_num_faces=2, refine_landmarks=True,
                                           min_detection_confidence=0.5 if not static else 0.3, min_tracking_confidence=0.5)


def clips(max_s):
    for n, c in enumerate(json.load(open("clips/chosen.json"))):
        cap = cv2.VideoCapture(c["file"])
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        fm = mesh(False)
        frames, crops, i = [], {}, 0
        while True:
            ok, frame = cap.read()
            if not ok or i >= max_s * fps:
                break
            h, w = frame.shape[:2]
            Y = lightness(frame)
            found = fm.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).multi_face_landmarks or []
            faces = {}
            for f in found:
                got = measure(f.landmark, Y, w, h)
                if got is None:
                    continue
                m, mouth, whites = got
                side = "C" if len(found) == 1 else ("L" if m["cx"] < 0.5 else "R")
                faces[side] = m
                if m["a"] >= 2 and m["teeth_p90"] is not None and i % 9 == 0:
                    px = m["ipd"] / IPD_MM
                    centre = np.array([f.landmark[14].x * w, f.landmark[14].y * h])
                    crops[(i, side)] = (m["a"], crop(frame, [(mouth, (0, 0, 255))], centre, 30 * px, 20 * px))
            frames.append(faces)
            i += 1
        rows = []
        for side in ("C", "L", "R"):
            series = [f.get(side) for f in frames]
            keep = speaking(fps, series)
            mine = [{**s, "face": side} for s, k in zip(series, keep) if k and s and s["a"] >= 2]
            rows += mine
            print(f"{c['title']} [{side}]: {keep.sum() / fps:.1f} s speaking, {len(mine)} frames with the lips apart", flush=True)
            picks = sorted([(a, im) for (fi, sd), (a, im) in crops.items() if sd == side and keep[fi]], key=lambda t: -t[0])
            if picks:
                sheet(f"clips/teeth-sheet-{n}{side}.png", [im for _, im in picks[::max(1, len(picks) // 12)][:12]])
        json.dump({"clip": c["title"], "fps": fps, "rows": rows}, open(f"clips/teeth-rows-{n}.json", "w"))


def eyes(count=10):
    fm = mesh(True)
    for n, c in enumerate(json.load(open("clips/chosen.json"))):
        cap = cv2.VideoCapture(c["file"])
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
        tiles = []
        for k in range(count):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(total * (k + 0.5) / count))
            ok, frame = cap.read()
            if not ok:
                continue
            h, w = frame.shape[:2]
            for f in fm.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)).multi_face_landmarks or []:
                got = measure(f.landmark, lightness(frame), w, h)
                if got is not None:
                    m, _, whites = got
                    lm = f.landmark
                    mid = np.array([(lm[468].x + lm[473].x) / 2 * w, (lm[468].y + lm[473].y) / 2 * h])
                    tiles.append(crop(frame, [(whites, (0, 255, 0))], mid, m["ipd"], m["ipd"] * 0.3, 5))
        if tiles:
            sheet(f"clips/teeth-eyes-{n}.png", tiles[:12])


def her(path, out):
    """Her eye whites: the portrait read at six scales (the mesh's fit moves a little with each)."""
    image = cv2.imread(path, cv2.IMREAD_COLOR)
    fm = mesh(True)
    got, lips, lips_seen, tiles = [], [], [], []
    for s in (1.0, 1.25, 1.5, 1.75, 2.0, 2.5):
        im = cv2.resize(image, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC) if s != 1 else image
        h, w = im.shape[:2]
        found = fm.process(cv2.cvtColor(im, cv2.COLOR_BGR2RGB)).multi_face_landmarks
        if not found:
            continue
        r = measure(found[0].landmark, lightness(im), w, h)
        if r is None or eye_white(r[0]) is None:
            continue
        got.append(eye_white(r[0]))
        if r[0]["lips"] is not None:
            lips.append(r[0]["lips"])
        if r[0]["lips_seen"] is not None:
            lips_seen.append(r[0]["lips_seen"])
        lm = found[0].landmark
        mid = np.array([(lm[468].x + lm[473].x) / 2 * w, (lm[468].y + lm[473].y) / 2 * h])
        tiles.append(crop(im, [(r[2], (0, 255, 0))], mid, r[0]["ipd"], r[0]["ipd"] * 0.3, 3))
    med = lambda xs: round(float(np.median(xs)), 1) if xs else None
    result = {"portrait": os.path.basename(path), "eye_white": med(got), "readings": [round(x, 1) for x in got],
              "lips": med(lips), "lips_seen": med(lips_seen)}
    json.dump(result, open(out, "w"), indent=1)
    if tiles:
        sheet(os.path.splitext(out)[0] + "-eyes.png", tiles)
    print(json.dumps(result), flush=True)


def pool(her_json, out, dirs):
    """Per face and aperture bin, the medians against the eye white; then the median over faces."""
    faces = []
    for d in dirs:
        for path in sorted(glob.glob(os.path.join(d, "teeth-rows-*.json"))):
            data = json.load(open(path))
            for side in sorted({r["face"] for r in data["rows"]}):
                rows = [r for r in data["rows"] if r["face"] == side and r["teeth_p90"] is not None and eye_white(r)]
                face = {"clip": data["clip"], "face": side, "frames": len(rows), "bins": []}
                for lo, hi in BINS:
                    b = [r for r in rows if lo <= r["a"] < hi]
                    med = lambda key: round(float(np.median([r[key] / eye_white(r) for r in b])), 3) if b else None
                    ratio = lambda num, den: (lambda xs: round(float(np.median(xs)), 3) if xs else None)(
                        [r[num] / r[den] for r in b if r.get(num) is not None and r.get(den)])
                    face["bins"].append({"mm": [lo, hi], "frames": len(b), "teeth": med("teeth_p90"), "opening": med("teeth_mean"),
                                         "teeth_seen": med("seen_p90"), "opening_seen": med("seen_mean"),
                                         "teeth_over_chin": ratio("teeth_p90", "chin"),
                                         "teeth_over_lips": ratio("teeth_p90", "lips"),
                                         "teeth_seen_over_lips": ratio("seen_p90", "lips_seen")})
                faces.append(face)
    kept = [f for f in faces if f["frames"] >= MIN_FACE_FRAMES]
    pooled = []
    for k, (lo, hi) in enumerate(BINS):
        b = [f["bins"][k] for f in kept if f["bins"][k]["frames"] >= MIN_BIN_FRAMES]
        if b:
            t = [x["teeth"] for x in b]
            med = lambda key: round(float(np.median([x[key] for x in b])), 3)
            lips = [x["teeth_seen_over_lips"] for x in b if x["teeth_seen_over_lips"] is not None]
            pooled.append({"mm": [lo, hi], "faces": len(b), "teeth": med("teeth"), "teeth_range": [min(t), max(t)],
                           "opening": med("opening"), "teeth_seen": med("teeth_seen"), "opening_seen": med("opening_seen"),
                           "teeth_seen_over_lips": round(float(np.median(lips)), 3) if lips else None,
                           "teeth_seen_over_lips_range": [min(lips), max(lips)] if lips else None})
    result = {"what": "lightness (0-255, the grey of equal luminance) of the teeth (brightest tenth of the opening, a pixel in "
                      "from the lips) and the opening (its mean), against the speaker's brighter eye white; *_seen: the same over "
                      "the whole opening blurred by seen_mm (the bust's size); teeth_over_chin: the teeth against the chin's front, "
                      "per face, for comparison; teeth_seen_over_lips: the blurred opening's brightest tenth against the blurred "
                      "lips' median - whether the teeth read as lighter than the lips around them",
              "seen_mm": SEEN_MM, "her": json.load(open(her_json)), "pooled": pooled, "faces": faces,
              "left_out": [f"{f['clip']} [{f['face']}]: {f['frames']} frames" for f in faces if f["frames"] < MIN_FACE_FRAMES]}
    json.dump(result, open(out, "w"), indent=1)
    for p in pooled:
        print(p, flush=True)


if __name__ == "__main__":
    mode = sys.argv[1]
    if mode == "clips":
        clips(float(sys.argv[2]) if len(sys.argv) > 2 else 300.0)
    elif mode == "eyes":
        eyes()
    elif mode == "her":
        her(sys.argv[2], sys.argv[3])
    else:
        pool(sys.argv[2], sys.argv[3], sys.argv[4:])
