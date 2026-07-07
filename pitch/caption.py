"""Burn a caption bar onto a screenshot for the demo video.
Usage: python pitch/caption.py <in.png> <caption text> <out.png>"""
import sys

from PIL import Image, ImageDraw, ImageFont

src, text, dst = sys.argv[1], sys.argv[2], sys.argv[3]
img = Image.open(src).convert("RGB")
# letterbox onto a 1600x900 ink canvas
canvas = Image.new("RGB", (1600, 900), (33, 28, 18))
img.thumbnail((1600, 900))
canvas.paste(img, ((1600 - img.width) // 2, (900 - img.height) // 2))

draw = ImageDraw.Draw(canvas, "RGBA")
font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 28)
pad = 14
box = draw.textbbox((0, 0), text, font=font)
tw, th = box[2] - box[0], box[3] - box[1]
x, y = 40, 900 - th - 2 * pad - 36
draw.rectangle([x - pad, y - pad, x + tw + pad, y + th + pad], fill=(33, 28, 18, 224))
draw.text((x, y - box[1] // 1), text, font=font, fill=(244, 241, 231))
canvas.save(dst)
