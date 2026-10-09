# The lip study's own image: MediaPipe Face Mesh, OpenCV and SciPy (tools/guide/README.md, "lips").
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir "mediapipe==0.10.14" "numpy<2" scipy
WORKDIR /work
