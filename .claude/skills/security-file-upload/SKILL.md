---
name: security-file-upload
description: Harden any endpoint that accepts uploaded files/images — sniff magic bytes (not Content-Type), refuse SVG, cap declared pixels before decode (decompression bomb), decode in a bounded thread pool, enforce a total-storage budget, always re-encode to strip polyglots/EXIF, serve nosniff. Use when adding or reviewing a file/image upload, avatar, or logo endpoint, or when the user asks about "upload / încărcare fișier / imagine / poză / logo / file upload / image processing".
---

# File & image upload hardening

An upload endpoint turns an attacker's bytes into a file on **your** origin. Treat every byte
as hostile. The rule: **decode what you receive, then rebuild the file from decoded pixels** —
the stored bytes must be yours, never the client's.

## Trust magic bytes, never the client's metadata
- Decide the format from the file's **magic-byte prefix**, not `Content-Type` and not the
  filename — the client controls both. PNG `\x89PNG\r\n\x1a\n`, JPEG `\xff\xd8\xff`, WebP is
  `RIFF….WEBP` (check bytes 0-3 **and** 8-11). Unknown prefix → **400**.
- **Generate the stored filename yourself** (a uuid + an extension from your own allow-list).
  A hostile `filename` must never pick its own extension or traverse (`../../etc/passwd`).

## Refuse SVG (and any XML/HTML-ish "image")
- An SVG is XML: it can carry `<script>` / `onload=` / `<foreignObject>`. Stored on your origin
  and served inline, it is a stored-XSS primitive. **Raster only.** Reject SVG even when the
  client declares it `image/png`.

## Stop the decompression bomb *before* decoding
- A few-KB file can declare `50000x50000` and balloon to gigabytes of RGBA once decoded. Open
  the header only (`Image.open` parses the header, not the pixels), read `width, height`, and
  refuse when `width*height > MAX_IMAGE_PIXELS` (e.g. **24 MP** covers a 6000x4000 phone shot)
  **before** any `.load()`/allocation. Belt-and-braces: pin `Image.MAX_IMAGE_PIXELS` too, and
  set `ImageFile.LOAD_TRUNCATED_IMAGES = False` so a truncated file fails loudly.

## Bound CPU/RAM: decode in a thread, behind a semaphore
- Decoding expands to raw RGBA in memory and is CPU-heavy. Run it in a worker thread
  (`asyncio.to_thread`) so it never blocks the event loop, and serialise it behind a small
  `asyncio.Semaphore(N)` so a burst of uploads (even with a stolen admin token) can't stack
  hundreds of MB of concurrent bitmaps and OOM the worker.

## Total-storage budget → 507
- Before the expensive decode, sum the upload directory's bytes; if it's at/over a ceiling
  (`MAX_UPLOADS_DIR_BYTES`), refuse with **507 Insufficient Storage**. Stops disk exhaustion via
  an abused/stolen token even when every individual file is tiny.

## Always re-encode — this is the anti-polyglot / anti-EXIF step
- Rebuild the image from decoded pixels (`Image.frombytes(mode, size, image.tobytes())`) and
  re-encode (e.g. WebP q82), **even when the re-encode isn't smaller**. Keeping the original
  bytes would let a polyglot (valid image header + appended payload) survive verbatim. The
  rebuilt `Image` has an empty `info`, so **EXIF/GPS/ICC/XMP is stripped** — pass `exif=b""`,
  `icc_profile=b""` to be explicit. Preserve alpha (`RGBA`) so transparent logos survive.

## Size cap, twice
- Stream the read with a hard ceiling and **413** the moment it's exceeded (never fully buffer a
  huge upload), and put a per-route body-size cap upstream too. See [[security-rate-limit-keys]].

## Serving
- The route is admin-only + rate-limited. Serve stored files with `X-Content-Type-Options:
  nosniff` so a browser can't be tricked into re-interpreting them. A decode failure on valid
  magic bytes is the **client's** error → **400**, never a 500/traceback.

## Anti-patterns
- Branching on `file.content_type` or the extension in `filename`. Storing the client's original
  bytes. `Image.open(...).save(...)` without re-encoding from raw pixels. Unbounded concurrent
  decodes. No pixel ceiling. Accepting SVG "because it's just an image".

## Verify (regression-test shapes)
- Declared-image SVG → 400. Wrong `Content-Type` but PNG magic → accepted as PNG.
- Valid magic bytes + garbage body → **400** (not 500). Oversized → **413**. Bomb (huge declared
  dimensions) → 400. Traversing `filename` → stored under a generated name.
- Re-encode: append bytes after a valid image → assert the stored file no longer contains them.
  EXIF/GPS present in source → absent in stored file. Over-budget dir → **507**.

Related: [[security-rate-limit-keys]], [[security-xss-prevention]], [[security-input-validation]],
[[security-pentest]].
