#!/usr/bin/env python3
"""
智能提词器 Pro — 简洁现代 App 图标
清新蓝白配色 + 极简提词符符号
"""
import os, sys, math
sys.path.insert(0, r'C:\Users\chenb\AppData\Local\Programs\Python\Python312\Lib\site-packages')
from PIL import Image, ImageDraw, ImageFont

SIZE = 1024
CX, CY = SIZE // 2, SIZE // 2

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# ── 1. 清新蓝白渐变背景 ──
for y in range(SIZE):
    t = y / SIZE
    c = lerp((28, 130, 252), (14, 80, 200), t)
    for x in range(SIZE):
        img.putpixel((x, y), (*c, 255))

# ── 2. 柔和光晕 ──
for r in range(8):
    alpha = 30 - r * 3
    rr = 320 + r * 30
    draw.ellipse([CX - rr, CY - rr, CX + rr, CY + rr],
                 fill=(255, 255, 255, max(0, alpha)))

# ── 3. 白色圆角矩形（类似播放卡片） ──
card_w, card_h = 440, 520
card_x, card_y = CX - card_w // 2, CY - card_h // 2 + 20
draw.rounded_rectangle(
    [card_x, card_y, card_x + card_w, card_y + card_h],
    radius=48, fill=(255, 255, 255, 255)
)

# ── 4. 卡片阴影 ──
shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
shadow_draw = ImageDraw.Draw(shadow)
shadow_draw.rounded_rectangle(
    [card_x + 8, card_y + 12, card_x + card_w + 8, card_y + card_h + 12],
    radius=48, fill=(0, 0, 0, 50)
)
img = Image.alpha_composite(shadow, img)
draw = ImageDraw.Draw(img)

# ── 5. 三行文字线（代表提词器台词） ──
line_colors = [(28, 130, 252), (14, 80, 200), (28, 130, 252)]
line_widths = [260, 200, 300]
line_y = [CY - 60, CY + 40, CY + 140]

for lc, lw, ly in zip(line_colors, line_widths, line_y):
    # 发光背景
    draw.rounded_rectangle(
        [CX - lw // 2 - 4, ly - 14, CX + lw // 2 + 4, ly + 14],
        radius=16, fill=(*lc[:3], 30)
    )
    # 主线
    draw.rounded_rectangle(
        [CX - lw // 2, ly - 8, CX + lw // 2, ly + 8],
        radius=12, fill=(*lc[:3], 220)
    )

# ── 6. 播放三角 + 高亮标记 ──
# 红色高亮块（当前行）
hl_y = CY - 60
draw.rounded_rectangle(
    [CX - 130, hl_y - 16, CX - 60, hl_y + 16],
    radius=10, fill=(255, 59, 48, 220)
)

# 播放三角
tri_x, tri_y = CX + 190, CY - 120
draw.polygon(
    [(tri_x - 30, tri_y - 50), (tri_x - 30, tri_y + 50), (tri_x + 40, tri_y)],
    fill=(28, 130, 252, 200)
)

# ── 7. 圆角遮罩 ──
mask = Image.new("L", (SIZE, SIZE), 0)
mask_draw = ImageDraw.Draw(mask)
mask_draw.rounded_rectangle([0, 0, SIZE, SIZE], radius=200, fill=255)
final = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
final.paste(img, (0, 0), mask)

# ── 8. 保存 ──
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "resources", "icon-only.png")
os.makedirs(os.path.dirname(out), exist_ok=True)
final.save(out, "PNG")
print(f"Icon v2 saved: {out} ({SIZE}x{SIZE})")
