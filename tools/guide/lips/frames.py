# A contact sheet of each clip: one frame every 15 s, small, to see the framing and the cutaways
# (clips/sheetN.jpg). Run after fetch.py, in the same working directory.
import cv2, json, numpy as np
chosen = json.load(open("clips/chosen.json"))
for i, c in enumerate(chosen):
    cap = cv2.VideoCapture(c["file"])
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    tiles = []
    for s in range(5, 180, 15):
        cap.set(cv2.CAP_PROP_POS_FRAMES, int(s * fps))
        ok, f = cap.read()
        if not ok:
            break
        f = cv2.resize(f, (int(f.shape[1] * 160 / f.shape[0]), 160))
        cv2.putText(f, f"{s}s", (6, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
        tiles.append(f)
    rows = [np.hstack(tiles[k:k + 4]) for k in range(0, len(tiles) - len(tiles) % 4, 4)]
    cv2.imwrite(f"clips/sheet{i}.jpg", np.vstack(rows))
    print("sheet", i, len(tiles))
