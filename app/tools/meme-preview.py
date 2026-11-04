#!/usr/bin/env python3
"""Generate 240px PNG previews for a folder of meme images.

Usage: python meme-preview.py <input-dir> <output-dir>
Requires Pillow (only for offline import/backfill tooling; the app itself is zero-dependency).

GIF previews pick the frame with the most visible content, not blindly frame 0:
many stickers start on a fully transparent / tiny setup frame.
"""
import json
import os
import sys

from PIL import Image, ImageStat

MAX_EDGE = 240
MAX_SAMPLES = 32


def score_frame(frame):
    """Higher is more informative: bbox area, visible pixels, luminance variance."""
    bbox = frame.getbbox()
    if not bbox:
        return (0, 0, 0.0)
    area = max(0, bbox[2] - bbox[0]) * max(0, bbox[3] - bbox[1])
    alpha = frame.getchannel('A')
    histogram = alpha.histogram()
    visible = sum(histogram[17:])  # ignore almost-transparent pixels
    variance = ImageStat.Stat(frame.convert('L')).var[0]
    return (area, visible, float(variance))


def choose_frame(image):
    try:
        frames = int(getattr(image, 'n_frames', 1))
    except Exception:  # noqa: BLE001
        frames = 1
    if frames <= 1:
        return 0
    step = max(1, frames // MAX_SAMPLES)
    best_index = 0
    best_score = (-1, -1, -1.0)
    for index in range(0, frames, step):
        image.seek(index)
        frame = image.convert('RGBA')
        candidate = score_frame(frame)
        if candidate > best_score:
            best_score = candidate
            best_index = index
    # 全透明 GIF 也保留第一帧，至少产出合法文件。
    return best_index if best_score > (0, 0, 0.0) else 0


def main() -> int:
    if len(sys.argv) != 3:
        print('usage: meme-preview.py <input-dir> <output-dir>', file=sys.stderr)
        return 2
    source, target = sys.argv[1], sys.argv[2]
    os.makedirs(target, exist_ok=True)
    result = {}
    for name in sorted(os.listdir(source)):
        path = os.path.join(source, name)
        if not os.path.isfile(path):
            continue
        try:
            image = Image.open(path)
            frame_index = choose_frame(image)
            image.seek(frame_index)
            frame = image.convert('RGBA')
            frame.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
            stem = os.path.splitext(name)[0]
            out = os.path.join(target, stem + '.png')
            frame.save(out, 'PNG', optimize=True)
            result[name] = {
                'file': stem + '.png',
                'frame': frame_index,
                'frames': int(getattr(image, 'n_frames', 1)),
                'w': frame.width,
                'h': frame.height,
                'bbox': frame.getbbox(),
            }
        except Exception as err:  # noqa: BLE001
            result[name] = {'error': str(err)}
    print(json.dumps(result, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
