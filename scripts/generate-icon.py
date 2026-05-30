#!/usr/bin/env python3
"""
智能提词器 Pro — 科技风 App 图标生成器
生成 1024x1024 暗色渐变底 + 发光提词符号
"""
import math, os, sys

try:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont
except ImportError:
    print("Installing Pillow...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image, ImageDraw, ImageFilter, ImageFont

SIZE = 1024
CENTER = SIZE // 2
R = 340  # 主圆半径

def lerp(a, b, t):
    return a + (b - a) * t

def gradient(img, top_left, bottom_right, color_start, color_end):
    """绘制线性渐变"""
    x1, y1 = top_left
    x2, y2 = bottom_right
    w, h = x2 - x1, y2 - y1
    for y in range(h):
        t = y / h if h > 0 else 0
        r = int(lerp(color_start[0], color_end[0], t))
        g = int(lerp(color_start[1], color_end[1], t))
        b = int(lerp(color_start[2], color_end[2], t))
        for x in range(w):
            img.putpixel((x1 + x, y1 + y), (r, g, b))

def create_icon():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # ─── 1. 深色渐变背景 ───
    gradient(img, (0, 0), (SIZE, SIZE),
             (15, 20, 45),    # 顶部深蓝紫
             (5, 8, 25))      # 底部更暗

    # ─── 2. 背景光晕 ───
    for i in range(12):
        alpha = int(12 - i)
        rr = R + 60 + i * 25
        draw.ellipse(
            [CENTER - rr, CENTER - rr, CENTER + rr, CENTER + rr],
            fill=(100, 160, 255, alpha),
        )

    # ─── 3. 主圆（深色科技感底盘） ───
    draw.ellipse(
        [CENTER - R, CENTER - R, CENTER + R, CENTER + R],
        fill=(12, 18, 40, 255),
    )

    # ─── 4. 内圆边框（发光环） ───
    for t in range(6, 0, -1):
        alpha = 40 + t * 25
        draw.ellipse(
            [CENTER - R + t*3, CENTER - R + t*3,
             CENTER + R - t*3, CENTER + R - t*3],
            outline=(80, 180, 255, alpha),
            width=2,
        )

    # ─── 5. 提词器核心符号：水平滚动线 ───
    # 三行发光滚动文字线
    line_y_positions = [CENTER - 90, CENTER + 20, CENTER + 110]
    line_alpha = [180, 255, 130]
    line_widths = [200, 320, 180]

    for i, (ly, alpha, lw) in enumerate(zip(line_y_positions, line_alpha, line_widths)):
        # 发光拖尾
        draw.line(
            [(CENTER - lw//2 - 20, ly), (CENTER + lw//2 + 20, ly)],
            fill=(60, 160, 255, 30),
            width=18,
        )
        # 主线
        draw.line(
            [(CENTER - lw//2, ly), (CENTER + lw//2, ly)],
            fill=(100, 200, 255, alpha),
            width=6,
        )

    # ─── 6. 当前高亮词块（红色发光方框） ───
    hl_x = CENTER - 70
    hl_w = 140
    hl_y = CENTER - 35
    hl_h = 70
    draw.rounded_rectangle(
        [hl_x, hl_y, hl_x + hl_w, hl_y + hl_h],
        radius=14,
        fill=(255, 70, 50, 60),
    )
    draw.rounded_rectangle(
        [hl_x, hl_y, hl_x + hl_w, hl_y + hl_h],
        radius=14,
        outline=(255, 80, 60, 220),
        width=4,
    )

    # ─── 7. 小圆点装饰（科技感点缀） ───
    dot_angles = [math.radians(a) for a in [-30, 30, 150, 210]]
    for angle in dot_angles:
        dx = int((R - 50) * math.cos(angle))
        dy = int((R - 50) * math.sin(angle))
        draw.ellipse(
            [CENTER + dx - 12, CENTER + dy - 12,
             CENTER + dx + 12, CENTER + dy + 12],
            fill=(100, 200, 255, 200),
        )
        # 小光晕
        draw.ellipse(
            [CENTER + dx - 20, CENTER + dy - 20,
             CENTER + dx + 20, CENTER + dy + 20],
            fill=(100, 200, 255, 40),
        )

    # ─── 8. 内切圆角 ───
    mask = Image.new("L", (SIZE, SIZE), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, SIZE, SIZE], radius=180, fill=255)
    img.putalpha(Image.composite(img.getchannel("A"), Image.new("L", (SIZE, SIZE), 0), mask))

    # ─── 9. 保存 ───
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "resources", "icon-only.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.save(out, "PNG")
    print(f"Icon saved: {out} ({SIZE}x{SIZE})")
    return out

if __name__ == "__main__":
    create_icon()
