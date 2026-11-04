# 生成 PWA 图标（开发用，需要 Pillow：pip install pillow）
# 用法：python app/tools/make-icons.py
from PIL import Image, ImageDraw
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'public')

BG = (11, 13, 16)        # #0b0d10
C1 = (91, 141, 250)      # #5b8dfa
C2 = (160, 107, 245)     # #a06bf5
SS = 4                   # 4 倍超采样再缩小，边缘才干净


def gradient_square(size):
    """先画小尺寸渐变再放大，避免逐像素慢循环。"""
    small = Image.new('RGB', (64, 64))
    px = small.load()
    for y in range(64):
        for x in range(64):
            t = (x + y) / 126
            px[x, y] = tuple(int(C1[i] + (C2[i] - C1[i]) * t) for i in range(3))
    return small.resize((size, size), Image.BILINEAR)


def make(size):
    S = size * SS
    img = Image.new('RGB', (S, S), BG)

    # 圆形渐变底
    circle = Image.new('L', (S, S), 0)
    d = ImageDraw.Draw(circle)
    pad = int(S * 0.10)
    d.ellipse([pad, pad, S - pad, S - pad], fill=255)
    img.paste(gradient_square(S), (0, 0), circle)

    # 六芒星（三条过圆心的粗线，端点补圆角）
    star = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(star)
    cx = cy = S / 2
    length = S * 0.235
    width = max(1, int(S * 0.055))
    import math
    for deg in (90, 30, 150):
        a = math.radians(deg)
        dx, dy = math.cos(a) * length, math.sin(a) * length
        sd.line([(cx - dx, cy - dy), (cx + dx, cy + dy)], fill=(255, 255, 255, 255), width=width)
    r = width / 2
    for deg in (90, 30, 150):
        a = math.radians(deg)
        for sign in (-1, 1):
            x = cx + sign * math.cos(a) * length
            y = cy + sign * math.sin(a) * length
            sd.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 255))
    img = Image.alpha_composite(img.convert('RGBA'), star).convert('RGB')

    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    big = make(512)
    big.save(os.path.join(OUT, 'icon-512.png'), 'PNG', optimize=True)
    big.resize((192, 192), Image.LANCZOS).save(os.path.join(OUT, 'icon-192.png'), 'PNG', optimize=True)
    big.resize((180, 180), Image.LANCZOS).save(os.path.join(OUT, 'apple-touch-icon.png'), 'PNG', optimize=True)
    print('ok ->', OUT)


if __name__ == '__main__':
    main()
