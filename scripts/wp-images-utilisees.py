"""
Tri des images du WordPress (lot 8) : à partir de l'export SQL et de l'archive
de wp-content/uploads, ne garde que les images réellement utilisées
(contenu des articles, images à la une, image de partage Rank Math, photos
d'auteur), en une seule version (l'originale WordPress, sans les tailles -300x200).

Entrées  : migration/*.sql, migration/archive_multi.zip
Sorties  : migration/images-utilisees/<aaaa>/<mm>/<fichier>  (copie, l'archive reste intacte)
           migration/images-rapport.json  (utilisées, introuvables, gain)
    python scripts/wp-images-utilisees.py
"""
import collections
import glob
import json
import os
import re
import zipfile

ROOT = os.path.join(os.path.dirname(__file__), "..", "migration")
SQL = glob.glob(os.path.join(ROOT, "*.sql"))[0]
ZIP = os.path.join(ROOT, "archive_multi.zip")
OUT = os.path.join(ROOT, "images-utilisees")
P = "wpbq_"

# Articles repris : tout sauf corbeille / brouillons automatiques
KEPT_STATUS = {"publish", "draft", "future", "pending", "private"}
IMG_EXT = r"(?:jpe?g|png|gif|webp|avif)"
UPLOAD_RE = re.compile(r"(?:https?:)?(?://([^/\s\"'<>]+))?/wp-content/uploads/((?:\d{4}/\d{2}/)?[^\s\"'()<>?#]+?\." + IMG_EXT + r")", re.I)
# Images hébergées par le blog ; les autres hôtes sont des images d'autres sites copiées par lien
OWN_HOSTS = {"", "blog.workyt.fr", "www.blog.workyt.fr", "workyt.fr", "www.workyt.fr"}
WP_IMAGE_RE = re.compile(r"wp-image-(\d+)")
SIZE_RE = re.compile(r"-\d+x\d+(?=\.[a-z0-9]+$)", re.I)


def tuples(s):
    i, n = 0, len(s)
    while i < n:
        if s[i] != "(":
            i += 1
            continue
        i += 1
        row, cur, inq = [], [], False
        while i < n:
            c = s[i]
            if inq:
                if c == "\\":
                    cur.append({"n": "\n", "r": "\r", "t": "\t", "0": "\0"}.get(s[i + 1], s[i + 1]))
                    i += 2
                    continue
                if c == "'":
                    if i + 1 < n and s[i + 1] == "'":
                        cur.append("'"); i += 2; continue
                    inq = False; i += 1; continue
                cur.append(c); i += 1; continue
            if c == "'":
                inq = True; i += 1; continue
            if c == ",":
                row.append("".join(cur).strip()); cur = []; i += 1; continue
            if c == ")":
                row.append("".join(cur).strip()); i += 1; break
            cur.append(c); i += 1
        yield row


def table_rows(name):
    buf, on = [], False
    with open(SQL, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith(f"INSERT INTO `{name}`"):
                on, buf = True, [line[line.index("VALUES") + 6:]]
            elif on:
                buf.append(line)
            if on and line.rstrip().endswith(";"):
                yield from tuples("".join(buf))
                on = False


def original(rel):
    """« 2024/03/photo-300x200.jpg » → « 2024/03/photo.jpg »"""
    return SIZE_RE.sub("", rel)


# 1. Articles repris et pièces jointes
attached = {}  # id pièce jointe → chemin relatif (_wp_attached_file)
posts = []  # (id, contenu)
for r in table_rows(P + "posts"):
    if len(r) < 21:
        continue
    pid, content, status, ptype = r[0], r[4], r[7], r[20]
    if ptype == "post" and status in KEPT_STATUS:
        posts.append((pid, content))
kept_ids = {pid for pid, _ in posts}

thumb, og = {}, {}
for r in table_rows(P + "postmeta"):
    if len(r) < 4:
        continue
    _, post_id, key, val = r[:4]
    if key == "_wp_attached_file":
        attached[post_id] = val
    elif key == "_thumbnail_id" and post_id in kept_ids:
        thumb[post_id] = val
    elif key in ("rank_math_facebook_image", "rank_math_twitter_image") and post_id in kept_ids and val:
        og[post_id] = val

# Photos d'auteur PublishPress (term meta « avatar » = id de pièce jointe)
avatar_ids = set()
for r in table_rows(P + "termmeta"):
    if len(r) >= 4 and r[2] == "avatar" and r[3].isdigit():
        avatar_ids.add(r[3])

# 2. Références
used = collections.defaultdict(set)  # chemin original → raisons
external = collections.Counter()  # hôte → nombre d'images d'autres sites
for pid, content in posts:
    for host, m in UPLOAD_RE.findall(content):
        if host.lower() in OWN_HOSTS:
            used[original(m)].add("contenu")
        else:
            external[host.lower()] += 1
    for aid in WP_IMAGE_RE.findall(content):
        if aid in attached:
            used[original(attached[aid])].add("contenu")
for pid, aid in thumb.items():
    if aid in attached:
        used[original(attached[aid])].add("à la une")
for pid, url in og.items():
    for host, m in UPLOAD_RE.findall(url):
        if host.lower() in OWN_HOSTS:
            used[original(m)].add("partage")
for aid in avatar_ids:
    if aid in attached:
        used[original(attached[aid])].add("auteur")

# 3. Correspondance avec l'archive
z = zipfile.ZipFile(ZIP)
files = {i.filename[len("uploads/"):]: i for i in z.infolist() if not i.is_dir() and i.filename.startswith("uploads/")}
total_size = sum(i.file_size for i in files.values())

# Même nom de fichier ailleurs (ex. envoyé par erreur dans wpmc-trash par le nettoyeur de médias)
by_name = collections.defaultdict(list)
for rel in files:
    by_name[os.path.basename(rel).lower()].append(rel)

found, missing, recovered = {}, [], 0
for rel in sorted(used):
    cand = [rel]
    # Image redimensionnée par WordPress (> 2560 px) : l'original s'appelle « -scaled »
    base, ext = os.path.splitext(rel)
    cand += [f"{base}-scaled{ext}", rel.replace("-scaled", "")]
    hit = next((c for c in cand if c in files), None)
    if not hit:
        alt = by_name.get(os.path.basename(rel).lower()) or by_name.get(os.path.basename(rel.replace("-scaled", "")).lower())
        if alt:
            hit = alt[0]
            recovered += 1
    if hit:
        found[hit] = sorted(used[rel])
    else:
        missing.append(rel)

os.makedirs(OUT, exist_ok=True)
kept_size = 0
for rel in found:
    info = files[rel]
    # Rangée sous son chemin d'origine (« wpmc-trash/2024/03/x.jpg » → « 2024/03/x.jpg »)
    dest = os.path.join(OUT, *rel.removeprefix("wpmc-trash/").split("/"))
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if not os.path.exists(dest) or os.path.getsize(dest) != info.file_size:
        with z.open(info) as src, open(dest, "wb") as dst:
            dst.write(src.read())
    kept_size += info.file_size

by_reason = collections.Counter(r for rs in found.values() for r in rs)
report = {
    "articles_repris": len(posts),
    "fichiers_archive": len(files),
    "taille_archive_go": round(total_size / 1e9, 2),
    "images_utilisees": len(found),
    "taille_gardee_mo": round(kept_size / 1e6, 1),
    "par_usage": dict(by_reason),
    "recuperees_ailleurs": recovered,
    "images_d_autres_sites": dict(external.most_common()),
    "introuvables": missing,
    "fichiers": found,
}
with open(os.path.join(ROOT, "images-rapport.json"), "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=1)

print(f"articles repris : {len(posts)}")
print(f"archive : {len(files)} fichiers, {total_size / 1e9:.2f} Go")
print(f"gardées : {len(found)} images, {kept_size / 1e6:.0f} Mo  (usages : {dict(by_reason)})")
print(f"écartées : {len(files) - len(found)} fichiers, {(total_size - kept_size) / 1e9:.2f} Go")
print(f"retrouvées dans un autre dossier (wpmc-trash…) : {recovered}")
print(f"images d'autres sites (liens directs, non reprises) : {sum(external.values())} sur {len(external)} sites")
print(f"du blog mais absentes de l'archive : {len(missing)}")
