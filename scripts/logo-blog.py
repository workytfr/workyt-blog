"""
Prépare le logo du blog pour le site, à partir du fichier d'Affinity
(« Blog Workyt.svg ») :

1. le contour blanc du renard est retiré ; les yeux et le nez restent
   transparents (on voit le fond à travers) ;
2. le texte « le blog' » est converti en tracés (Funnel Display Bold) : dans
   une balise <img>, le navigateur n'a pas accès aux polices du site ;
3. on écrit public/logo-blog-workyt.svg (logo complet) et
   public/renard-workyt.png (le renard seul, pour les petits formats).

    python scripts/logo-blog.py "C:/Users/nadir/Downloads/Blog Workyt.svg" "C:/…/FunnelDisplay-Bold.ttf"
"""
import base64
import io
import re
import sys
from collections import deque
from pathlib import Path

from PIL import Image
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

src, font_path = Path(sys.argv[1]), Path(sys.argv[2])
public = Path(__file__).resolve().parent.parent / "public"
svg = src.read_text(encoding="utf-8")

# ── 1. Renard : sans contour blanc (yeux et nez transparents, comme dans l'original) ──
m = re.search(r'(<image\b[^>]*?(?:xlink:href|href)="data:image/png;base64,)([^"]+)(")', svg)
img = Image.open(io.BytesIO(base64.b64decode(m.group(2)))).convert("RGBA")
w, h = img.size
px = img.load()


def flood(passable) -> bytearray:
    """Pixels atteignables depuis le bord de l'image en ne passant que par « passable »"""
    seen = bytearray(w * h)
    queue = deque()
    for x in range(w):
        queue.extend(((x, 0), (x, h - 1)))
    for y in range(h):
        queue.extend(((0, y), (w - 1, y)))
    while queue:
        x, y = queue.popleft()
        i = y * w + x
        if seen[i] or not passable(px[x, y]):
            continue
        seen[i] = 1
        for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
            if 0 <= nx < w and 0 <= ny < h and not seen[ny * w + nx]:
                queue.append((nx, ny))
    return seen


# Contour blanc : le blanc (et le fondu blanc → orange) relié à l'extérieur. L'orange du renard
# n'a pas de bleu : on peut retirer le blanc (« couleur vers transparence ») sans toucher à la tête.
ring = flood(lambda p: p[3] < 128 or p[2] > 8)
for y in range(h):
    for x in range(w):
        if not ring[y * w + x]:
            continue
        r, g, b, a = px[x, y]
        k = 1 - min(r, g, b) / 255  # part de couleur dans le mélange avec le blanc
        if k <= 0.02:
            px[x, y] = (0, 0, 0, 0)
            continue
        px[x, y] = tuple(max(0, min(255, round((c - 255 * (1 - k)) / k))) for c in (r, g, b)) + (round(a * k),)

buf = io.BytesIO()
# Affiché à ~40 px de haut : 400 px restent nets même zoomé sur écran haute densité (le <use> garde la taille d'origine)
img.resize((400, round(400 * h / w)), Image.LANCZOS).save(buf, format="PNG", optimize=True)
svg = svg[: m.start(2)] + base64.b64encode(buf.getvalue()).decode() + svg[m.end(2) :]
# Le renard seul, recadré
fox = img.crop(img.getbbox())
fox.thumbnail((384, 384), Image.LANCZOS)
fox.save(public / "renard-workyt.png", optimize=True)

# ── 2. « le blog' » en tracés ──
font = TTFont(str(font_path))
glyphs = font.getGlyphSet()
cmap = font.getBestCmap()
upm = font["head"].unitsPerEm
hmtx = font["hmtx"]


def outline(text: str, x0: float, y0: float, size: float) -> str:
    """Tracé SVG d'un texte (ligne de base en y0), lettre après lettre"""
    scale = size / upm
    pen = SVGPathPen(glyphs)
    x = x0
    for ch in text:
        name = cmap[ord(ch)]
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, y0)))
        x += hmtx[name][0] * scale
    return pen.getCommands()


t = re.search(r"<text\b([^>]*)>([\s\S]*?)</text>", svg)
attrs, inner = t.group(1), t.group(2)
num = lambda name, s: float(re.search(rf'{name}="([-\d.]+)px', s).group(1))
size = float(re.search(r"font-size:([\d.]+)px", attrs).group(1))
fill = re.search(r"fill:([^;\"]+)", attrs).group(1)
x0, y0 = num("x", attrs), num("y", attrs)
first = re.match(r"([^<]*)", inner).group(1)
d = outline(first.replace("&apos;", "'"), x0, y0, size)
for tm in re.finditer(r"<tspan\b([^>]*)>([^<]*)</tspan>", inner):
    d += " " + outline(tm.group(2).replace("&apos;", "'"), num("x", tm.group(1)), num("y", tm.group(1)), size)
svg = svg[: t.start()] + f'<path d="{d}" style="fill:{fill};"/>' + svg[t.end() :]

# Taille intrinsèque (proportions du viewBox) au lieu de 100 % : utilisable dans <img>
vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
svg = re.sub(r'<svg width="100%" height="100%"', f'<svg width="{vb[2]:.0f}" height="{vb[3]:.0f}"', svg, count=1)
(public / "logo-blog-workyt.svg").write_text(svg, encoding="utf-8")
print("écrit :", public / "logo-blog-workyt.svg", f"({len(svg) // 1024} Ko)", "et", public / "renard-workyt.png")
