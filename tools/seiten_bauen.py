"""
Baut die Webseite für GitHub Pages (läuft automatisch in .github/workflows/pages.yml).

Für jede öffentliche Seite aus <script id="seiten-daten"> in index.html entsteht eine
eigene Datei mit fertigem Inhalt, eigenem Titel und eigener Beschreibung:

    /                    → _site/index.html            (Startseite)
    /cp-app/             → _site/cp-app/index.html
    /patientenaufruf/    → _site/patientenaufruf/index.html  …

So können Suchmaschinen jede Seite einzeln finden. Im Browser übernimmt danach wie
gewohnt der Router in index.html. Seiten, die nur per direktem Link erreichbar sein
sollen (#support, #auswertung, #messebecken), bekommen keine eigene Datei und stehen
nicht in der Sitemap.

Lokal ausprobieren:
    python3 tools/seiten_bauen.py && python3 -m http.server -d _site 8000
"""
import html
import json
import os
import re
import shutil
import subprocess
from datetime import date, datetime, timezone

WURZEL = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
AUSGABE = os.path.join(WURZEL, "_site")
NICHT_KOPIEREN = {".git", ".github", "tools", "_site"}


def lesen(pfad: str) -> str:
    with open(os.path.join(WURZEL, pfad), encoding="utf-8", newline="") as f:
        return f.read()


def domain() -> str:
    return "https://" + lesen("CNAME").strip()


def seiten_daten(index: str) -> dict:
    treffer = re.search(r'<script type="application/json" id="seiten-daten">(.*?)</script>', index, re.S)
    if not treffer:
        raise SystemExit("index.html: <script id=\"seiten-daten\"> nicht gefunden")
    return json.loads(treffer.group(1))


def meta_ersetzen(text: str, muster: str, neu: str) -> str:
    """Ersetzt genau ein Vorkommen – bricht ab, falls index.html umgebaut wurde."""
    ergebnis, anzahl = re.subn(muster, lambda _: neu, text, count=1)
    if anzahl != 1:
        raise SystemExit(f"index.html: Muster nicht gefunden: {muster}")
    return ergebnis


def seite_bauen(index: str, seite_id: str, seite: dict, basis: str) -> str:
    titel = html.escape(seite["titel"], quote=True)
    beschreibung = html.escape(seite["beschreibung"], quote=True)
    url = basis + seite["pfad"]

    text = index.replace("<html lang=\"de\">", "<html lang=\"de\" data-gebaut>", 1)
    text = meta_ersetzen(text, r"<title>.*?</title>", f"<title>{titel}</title>")
    text = meta_ersetzen(text, r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{beschreibung}">')
    text = meta_ersetzen(text, r'<link rel="canonical" href="[^"]*">', f'<link rel="canonical" href="{url}">')
    text = meta_ersetzen(text, r'<meta property="og:title" content="[^"]*">', f'<meta property="og:title" content="{titel}">')
    text = meta_ersetzen(text, r'<meta property="og:description" content="[^"]*">', f'<meta property="og:description" content="{beschreibung}">')
    text = meta_ersetzen(text, r'<meta property="og:url" content="[^"]*">', f'<meta property="og:url" content="{url}">')
    text = meta_ersetzen(text, r'<meta name="twitter:title" content="[^"]*">', f'<meta name="twitter:title" content="{titel}">')
    text = meta_ersetzen(text, r'<meta name="twitter:description" content="[^"]*">', f'<meta name="twitter:description" content="{beschreibung}">')

    # Seiteninhalt direkt einsetzen. Skripte im Inhalt sollen erst laufen, wenn der Router
    # bereit ist (wie beim normalen Laden) → vorerst als inaktiver Typ markieren;
    # runPageScripts() in index.html startet sie anschließend.
    inhalt = lesen(f"pages/{seite_id}.html")
    inhalt = re.sub(r"<script(?![^>]*\btype=)", '<script type="text/x-vorgeladen"', inhalt)
    container = re.search(r'<div id="page-container"[^>]*>\s*<div class="page-loading">[^<]*</div>\s*</div>', text)
    if not container:
        raise SystemExit("index.html: page-container nicht gefunden")
    neu = f'<div id="page-container" tabindex="-1" data-vorgeladen="{seite_id}">\n{inhalt}\n</div>'
    return text[:container.start()] + neu + text[container.end():]


def letzte_aenderung(pfad: str) -> str:
    try:
        ausgabe = subprocess.run(["git", "log", "-1", "--format=%cI", "--", pfad], cwd=WURZEL,
                                 capture_output=True, text=True, check=True).stdout.strip()
        if ausgabe:
            return datetime.fromisoformat(ausgabe).astimezone(timezone.utc).date().isoformat()
    except (OSError, subprocess.CalledProcessError, ValueError):
        pass
    return date.today().isoformat()


def sitemap(seiten: dict, basis: str) -> str:
    eintraege = []
    for seite_id, seite in seiten.items():
        prioritaet = "1.0" if seite_id == "home" else ("0.3" if "datenschutz" in seite_id or seite_id == "impressum" else "0.8")
        eintraege.append(
            f"  <url>\n    <loc>{basis}{seite['pfad']}</loc>\n"
            f"    <lastmod>{letzte_aenderung(f'pages/{seite_id}.html')}</lastmod>\n"
            f"    <priority>{prioritaet}</priority>\n  </url>")
    for pdf in ("Anleitung_Praxispersonal.pdf", "Technische_Dokumentation.pdf"):
        if os.path.exists(os.path.join(WURZEL, pdf)):
            eintraege.append(f"  <url>\n    <loc>{basis}/{pdf}</loc>\n    <lastmod>{letzte_aenderung(pdf)}</lastmod>\n    <priority>0.5</priority>\n  </url>")
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "\n".join(eintraege) + "\n</urlset>\n")


def main():
    if os.path.exists(AUSGABE):
        shutil.rmtree(AUSGABE)
    shutil.copytree(WURZEL, AUSGABE, ignore=lambda ordner, namen:
                    [n for n in namen if ordner == WURZEL and n in NICHT_KOPIEREN])

    index = lesen("index.html")
    seiten = seiten_daten(index)
    basis = domain()
    for seite_id, seite in seiten.items():
        ziel = os.path.join(AUSGABE, seite["pfad"].strip("/"), "index.html")
        os.makedirs(os.path.dirname(ziel), exist_ok=True)
        with open(ziel, "w", encoding="utf-8", newline="") as f:
            f.write(seite_bauen(index, seite_id, seite, basis))
        print(f"  {seite['pfad']:20s} {seite['titel']}")

    with open(os.path.join(AUSGABE, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(sitemap(seiten, basis))
    print(f"Fertig: {len(seiten)} Seiten + sitemap.xml in {AUSGABE}")


if __name__ == "__main__":
    main()
