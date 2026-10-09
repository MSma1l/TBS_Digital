# How a real mouth moves in speech, measured on video: MediaPipe Face Mesh (up to two faces) on
# every frame of the fetched talking-head clips; lip and jaw distances normalised by the
# inter-pupil distance (IPD, taken as 63 mm); only the stretches where that face is SPEAKING to
# the camera (frontal for it, the same shot, the lips moving), then the statistics an animation
# needs. Writes clips/summary.json and clips/pooled.json; measured.json next to this file is those
# two and the clip list, kept (tools/guide/README.md).
#   python -I analyze.py [max_seconds_per_clip]
import json, math, sys
import cv2
import mediapipe as mp
import numpy as np
from scipy.signal import find_peaks, welch

IPD_MM = 63.0
MAX_S = float(sys.argv[1]) if len(sys.argv) > 1 else 240.0
chosen = json.load(open("clips/chosen.json"))
KEYS = ["a_in", "a_out", "width", "jaw", "nose_ul", "nose_ll", "ll_chin"]


def dist(lm, a, b, w, h):
    return math.hypot((lm[a].x - lm[b].x) * w, (lm[a].y - lm[b].y) * h)


def track(path):
    """Per frame, per side of the picture (L/R, or C when alone): the face's metrics."""
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    fm = mp.solutions.face_mesh.FaceMesh(static_image_mode=False, max_num_faces=2, refine_landmarks=True,
                                         min_detection_confidence=0.5, min_tracking_confidence=0.5)
    frames, i = [], 0
    while True:
        ok, frame = cap.read()
        if not ok or i >= MAX_S * fps:
            break
        h, w = frame.shape[:2]
        res = fm.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        faces = {}
        found = res.multi_face_landmarks or []
        for f in found:
            lm = f.landmark
            cx = lm[1].x
            side = "C" if len(found) == 1 else ("L" if cx < 0.5 else "R")
            ipd = dist(lm, 468, 473, w, h)
            if ipd < 20:
                continue
            l, r = dist(lm, 1, 234, w, h), dist(lm, 1, 454, w, h)
            faces[side] = {
                "ipd": ipd, "cx": cx, "yaw": (l - r) / (l + r),
                "a_in": dist(lm, 13, 14, w, h) / ipd, "a_out": dist(lm, 0, 17, w, h) / ipd,
                "width": dist(lm, 61, 291, w, h) / ipd, "jaw": dist(lm, 1, 152, w, h) / ipd,
                "nose_ul": dist(lm, 1, 0, w, h) / ipd, "nose_ll": dist(lm, 1, 17, w, h) / ipd,
                "ll_chin": dist(lm, 17, 152, w, h) / ipd,
            }
        frames.append(faces)
        i += 1
    return fps, frames


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


def speaking_segments(fps, series):
    """Valid, same-shot, frontal-for-this-face frames whose lips are moving, in runs of >= 1 s."""
    n = len(series)
    ipd = np.array([s["ipd"] if s else np.nan for s in series])
    yaw = np.array([s["yaw"] if s else np.nan for s in series])
    a = np.array([s["a_in"] * IPD_MM if s else np.nan for s in series])
    present = ~np.isnan(ipd)
    if present.sum() < fps * 2:
        return []
    med_ipd = np.nanmedian(ipd)
    med_yaw = np.nanmedian(yaw)
    ok = present & (np.abs(ipd / med_ipd - 1) < 0.25) & (np.abs(yaw - med_yaw) < 0.15)
    # speaking: the aperture's spread over a 1 s window (only where the face is valid)
    win = int(fps)
    sd = np.full(n, 0.0)
    for k in range(n):
        lo, hi = max(0, k - win // 2), min(n, k + win // 2 + 1)
        seg = a[lo:hi][ok[lo:hi]]
        sd[k] = seg.std() if len(seg) > win // 2 else 0.0
    speaking = ok & (sd > 1.2)
    return [s for s in runs(speaking) if (s[1] - s[0]) / fps >= 1.0]


def stats(fps, chunks):
    """Statistics over a list of per-segment dicts of arrays (mm, already speaking-only)."""
    seconds = sum(len(c["a"]) for c in chunks) / fps
    A = np.concatenate([c["a"] for c in chunks])
    W = np.concatenate([c["w"] for c in chunks])
    peaks, opening, closing, amp, vopen, vclose, closures, pauses, rel = 0, [], [], [], [], [], [], [], []
    for c in chunks:
        a = c["a"]
        v = np.gradient(a) * fps
        pk, _ = find_peaks(a, prominence=1.2, distance=max(1, int(0.07 * fps)))
        tr, _ = find_peaks(-a, prominence=0.8, distance=max(1, int(0.05 * fps)))
        peaks += len(pk)
        for p in pk:
            before, after = tr[tr < p], tr[tr > p]
            if len(before) and len(after):
                b, e = before[-1], after[0]
                opening.append((p - b) / fps)
                closing.append((e - p) / fps)
                amp.append(a[p] - min(a[b], a[e]))
                vopen.append(v[b:p + 1].max())
                vclose.append(-v[p:e + 1].min())
        # successive peak heights, relative to their neighbours: how much syllables vary
        if len(pk) >= 3:
            h = a[pk]
            rel += list(h[1:-1] / ((h[:-2] + h[2:]) / 2))
        for r0, r1 in runs(a < 2.0):
            (pauses if (r1 - r0) / fps >= 0.25 else closures).append((r1 - r0) / fps)
    pct = lambda x: {str(q): round(float(np.percentile(x, q)), 3) for q in (5, 25, 50, 75, 95)} if len(x) else None
    S = {"seconds": round(seconds, 1)}
    S["aperture_mm"] = pct(A)
    S["closed_fraction"] = {f"<{t}mm": round(float((A < t).mean()), 3) for t in (1, 2, 3, 4)}
    S["opening_peaks_per_s"] = round(peaks / seconds, 2)
    S["peak_amplitude_mm"] = pct(amp)
    S["peak_height_vs_neighbours"] = pct(rel)
    S["opening_s"] = pct(opening)
    S["closing_s"] = pct(closing)
    S["open_over_close_median"] = round(float(np.median(np.array(opening) / np.array(closing))), 2) if opening else None
    S["peak_velocity_open_mm_s"] = pct(vopen)
    S["peak_velocity_close_mm_s"] = pct(vclose)
    S["short_closures_per_s"] = round(len(closures) / seconds, 2)
    S["short_closure_s"] = pct(closures)
    S["pauses_per_s"] = round(len(pauses) / seconds, 3)
    S["pause_s"] = pct(pauses)
    S["width_mm"] = pct(W)
    S["width_range_p5_p95_mm"] = round(float(np.percentile(W, 95) - np.percentile(W, 5)), 2)
    S["corr_width_aperture"] = round(float(np.corrcoef(W, A)[0, 1]), 3)
    # how the lips and the chin move per mm of aperture, WITHIN each stretch of speech: each
    # stretch's own mean taken out first. Fitted across stretches raw, the slope would mix one
    # person's (or one shot's) resting face with another's, and the pooled number could fall
    # outside every face's own.
    dA = np.concatenate([c["a"] - c["a"].mean() for c in chunks])
    within = lambda key: np.concatenate([c[key] - c[key].mean() for c in chunks])
    slope = lambda key: round(float(np.dot(dA, within(key)) / np.dot(dA, dA)), 3)
    S["chin_drop_per_mm_aperture"] = slope("j")
    S["upper_lip_per_mm_aperture"] = slope("ul")
    S["lower_lip_per_mm_aperture"] = slope("ll")
    f, P = welch(A - A.mean(), fs=fps, nperseg=min(128, len(A)))
    band = (f >= 2) & (f <= 7)
    S["psd_peak_hz"] = round(float(f[np.argmax(P[1:]) + 1]), 2)
    S["psd_share_2_7hz"] = round(float(P[band].sum() / P[1:].sum()), 3)
    return S


WIDTH_BINS = [(1, 3), (3, 5), (5, 7), (7, 9), (9, 11)]


def width_by_aperture(chunks):
    """The mouth's width at each inner aperture against its own width with the lips together (under
    1 mm), within the stretches of speech: does a mouth widen as it opens, or only part?"""
    A = np.concatenate([c["a"] for c in chunks])
    W = np.concatenate([c["w"] for c in chunks])
    if (A < 1).sum() < 30:
        return None
    rest = float(np.median(W[A < 1]))
    return {f"{lo}-{hi}": round(float(np.median(W[(A >= lo) & (A < hi)])) / rest, 3)
            for lo, hi in WIDTH_BINS if ((A >= lo) & (A < hi)).sum() >= 30}


summaries, pooled = [], []
for c in chosen:
    fps, frames = track(c["file"])
    for side in ("C", "L", "R"):
        series = [f.get(side) for f in frames]
        segs = speaking_segments(fps, series)
        if not segs:
            continue
        chunks = []
        for s0, s1 in segs:
            seg = series[s0:s1]
            chunks.append({k: np.array([x[key] * IPD_MM for x in seg]) for k, key in
                           (("a", "a_in"), ("w", "width"), ("j", "jaw"), ("ul", "nose_ul"), ("ll", "nose_ll"))})
        S = {"clip": c["title"], "face": side, "segments": len(segs), **stats(fps, chunks),
             "width_by_aperture": width_by_aperture(chunks)}
        summaries.append(S)
        pooled += chunks
        print(json.dumps(S), flush=True)
json.dump(summaries, open("clips/summary.json", "w"), indent=1)
P = {"clips": len(chosen), "faces": len(summaries), **stats(29.97, pooled)}
# each face against its own lips-together width, then the median over the faces
widths = [s["width_by_aperture"] for s in summaries if s["width_by_aperture"]]
P["width_by_aperture"] = {f"{lo}-{hi}": round(float(np.median([w[f"{lo}-{hi}"] for w in widths if f"{lo}-{hi}" in w])), 3)
                          for lo, hi in WIDTH_BINS if any(f"{lo}-{hi}" in w for w in widths)}
json.dump(P, open("clips/pooled.json", "w"), indent=1)
print("POOLED", json.dumps(P, indent=1), flush=True)
