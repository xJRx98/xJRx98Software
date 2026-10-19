(function () {
  'use strict';

  // Öffentliche Messebecken-Seite (per QR-Code). Liest ausschließlich über die
  // Funktion get_messebecken(slug) - siehe supabase/schema_messebecken.sql.
  // Kein Login, keine Schreibzugriffe, kein innerHTML.
  var SUPABASE_URL = 'https://eznesbcyjduxqhkpcyny.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_JfIZ0nyrSoGcC19Yw_L-Yw_gpMtHn9Y';
  var SLUG_RE = /^[a-z0-9][a-z0-9-]{2,39}$/;
  var FUNCTIONS_URL = SUPABASE_URL + '/functions/v1';   // Edge Function `messebecken-bild` liefert die Fotos
  var PAGE_TITLE = 'Messebecken';
  var REFRESH_MS = 60000;     // aktualisiert sich bei offener Seite jede Minute selbst
  var FAVICON_URL = 'data:image/png;base64,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';
  var savedMeta = null;
  var metaObserver = null;
  var client = null;
  var data = null;
  var list = null;      // Übersicht (ohne Slug in der Adresse)
  var tab = 'aquarium';
  var timer = null;
  var cleanup = null;

  function alive() { return !!document.getElementById('cps-root'); }
  function $(id) { return document.getElementById('cps-' + id); }

  function appendChild(el, c) {
    if (c === null || c === undefined || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { appendChild(el, x); }); return; }
    if (c.nodeType) { el.appendChild(c); return; }
    el.appendChild(document.createTextNode(String(c)));
  }

  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(function (k) {
        var v = props[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = String(v);
        else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : String(v));
      });
    }
    for (var i = 2; i < arguments.length; i++) appendChild(el, arguments[i]);
    return el;
  }

  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }

  /* ── Formatierung ─────────────────────────────────────────────────────── */

  /** Anzeigename: Unterstriche (aus der App, z. B. "Neues_Layout") werden zu Leerzeichen. */
  function cleanName(v) { return isEmpty(v) ? v : String(v).replace(/_/g, ' '); }

  function isEmpty(v) { return v === null || v === undefined || v === ''; }
  function dash() { return h('span', { class: 'cps-dash', text: '–' }); }
  function show(v) { return isEmpty(v) ? dash() : String(v); }

  /** Zahl im deutschen Format als TEXT (Fehlende Werte: "–"). */
  function numStr(v, unit) {
    if (isEmpty(v)) return '–';
    var n = Number(v);
    var s = isFinite(n) ? n.toLocaleString('de-DE', { maximumFractionDigits: 3 }) : String(v);
    return unit ? s + '\u00a0' + unit : s;
  }

  /** Wie numStr, aber ein fehlender Wert wird als grauer Strich dargestellt. */
  function num(v, unit) {
    return isEmpty(v) ? dash() : numStr(v, unit);
  }

  function yn(v) {
    if (v === true) return 'Ja';
    if (v === false) return 'Nein';
    return dash();
  }

  function fmtDateTime(iso) {
    if (isEmpty(iso)) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
  }

  /** Kurzes Datum (TT.MM.JJ) für enge Tabellen. */
  function fmtDateShort(iso) {
    if (isEmpty(iso)) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  }

  function fmtDate(iso) {
    if (isEmpty(iso)) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString('de-DE', { dateStyle: 'medium' });
  }

  /** Eine Liste aus Schlüssel/Wert-Zeilen: rows = [[Label, Wert], ...]. */
  function kv(rows) {
    var dl = h('dl', { class: 'cps-kv' });
    rows.forEach(function (r) {
      dl.appendChild(h('dt', { text: r[0] }));
      dl.appendChild(h('dd', null, r[1] === undefined ? dash() : r[1]));
    });
    return dl;
  }

  /** Eine Karte; mit `wide` nimmt sie die volle Breite des Rasters ein. */
  function section(title, body, wide) {
    return h('div', { class: wide ? 'cps-section cps-wide' : 'cps-section' }, h('h2', { text: title }), body);
  }

  /* ── Tab-Titel & Icon ─────────────────────────────────────────────────── */
  function applyPageMeta() {
    var root = $('root');
    if (!root) return;
    if (!savedMeta) {
      // Die vorhandenen Icon-Elemente der Webseite MERKEN (samt Position) und aus
      // dem Dokument nehmen - nur beim ERSTEN Mal, damit bei erneutem Einblenden
      // nicht unser eigenes Icon als "Original" gespeichert wird.
      var olds = Array.prototype.slice.call(document.querySelectorAll('link[rel~="icon"]'));
      savedMeta = {
        title: document.title,
        links: olds.map(function (l) { return { el: l, parent: l.parentNode, next: l.nextSibling }; }),
        ours: null,
      };
      olds.forEach(function (l) { if (l.parentNode) l.parentNode.removeChild(l); });
    }
    document.title = PAGE_TITLE;

    // Ein NEUES Icon-Element einfügen: Manche Browser (Safari, Firefox) reagieren
    // nur auf neu eingefügte Elemente, nicht auf eine geänderte href.
    if (savedMeta.ours && savedMeta.ours.parentNode) savedMeta.ours.parentNode.removeChild(savedMeta.ours);
    var ours = document.createElement('link');
    ours.setAttribute('rel', 'icon');
    ours.setAttribute('type', 'image/png');
    ours.setAttribute('href', FAVICON_URL);
    document.head.appendChild(ours);
    savedMeta.ours = ours;
    document.body.classList.add('cps-support-page');

    // Der Router ersetzt beim Seitenwechsel den Inhalt des Containers: Verschwindet
    // die Support-Seite, wird alles zurückgesetzt.
    if (metaObserver) metaObserver.disconnect();
    if (root.parentNode && window.MutationObserver) {
      metaObserver = new MutationObserver(function () { if (!alive()) restorePageMeta(); });
      metaObserver.observe(root.parentNode, { childList: true });
    }
  }

  function restorePageMeta() {
    if (metaObserver) { metaObserver.disconnect(); metaObserver = null; }
    document.body.classList.remove('cps-support-page');
    if (!savedMeta) return;
    var m = savedMeta;
    savedMeta = null;
    document.title = m.title;
    if (m.ours && m.ours.parentNode) m.ours.parentNode.removeChild(m.ours);
    m.links.forEach(function (x) {
      var parent = x.parent && x.parent.isConnected !== false ? x.parent : document.head;
      var next = x.next && x.next.parentNode === parent ? x.next : null;
      parent.insertBefore(x.el, next);
    });
  }

  function renderAquarium(p) {
    var a = p.aquarium || {};
    var grid = h('div', { class: 'cps-grid' });

    var fotos = photosBlock(p, a);
    if (fotos) grid.appendChild(section('Fotos', fotos, true));

    var allgemein = [['Name', show(cleanName(a.name))], ['Netto-Volumen', num(a.nettovolumen, 'L')]];
    if (a.auto === false) {
      allgemein.push(['Volumen', 'Manuell eingegeben']);
    } else {
      allgemein.push(['Abmessungen (B × H × T)',
        [a.breite, a.hoehe, a.tiefe].every(isEmpty) ? dash() :
          [a.breite, a.hoehe, a.tiefe].map(function (x) { return numStr(x); }).join(' × ') + '\u00a0cm']);
      allgemein.push(['Glasstärke', num(a.glasstaerke, 'mm')]);
      allgemein.push(['Abstand Wasser – Glaskante', num(a.wasserkante, 'cm')]);
      allgemein.push(['Abzug Hardscape', num(a.hardscape, 'L')]);
      allgemein.push(['Bodengrund vorne / hinten',
        [a.bodenvorne, a.bodenhinten].every(isEmpty) ? dash() :
          numStr(a.bodenvorne) + ' / ' + numStr(a.bodenhinten) + '\u00a0cm']);
      allgemein.push(['Filterbecken', a.filterbecken ? 'Ja (' + numStr(a.filtervol) + '\u00a0L)' : yn(a.filterbecken)]);
    }
    grid.appendChild(section('Allgemein', kv(allgemein)));

    grid.appendChild(section('Wasser', kv([
      ['Wasserart', show(a.wasserart)],
      ['Wasserwerte', show(a.wasserwerte)],
      ['Mischverhältnis', show(a.mischverhaeltnis)],
      ['Temperatur', num(a.temperatur, '°C')],
    ])));

    grid.appendChild(section('Beleuchtung', kv([
      ['Lampe', show(a.lampe)],
      ['Beleuchtungsdauer', show(a.beleuchtungsdauer)],
      ['Intensität', show(a.beleuchtungsintensitaet)],
      ['Details', show(a.beleuchtungsdetail)],
      ['Abstand Lampe – Wasser', num(a.lampenabstand, 'cm')],
    ])));

    grid.appendChild(section('CO₂ & Filter', kv([
      ['CO₂-Anlage', yn(a.co2)],
      ['CO₂-Details', show(a.co2detail)],
      ['Filter', show(a.filter)],
      ['Filter-Details', show(a.filterdetail)],
    ])));

    grid.appendChild(section('Boden & Hardscape', kv([
      ['Bodengrund', show(a.bodengrund)],
      ['Hardscape', show(a.hardscapetyp)],
    ])));

    // Pflege (neueste zuerst)
    var pflege = Array.isArray(a.pflege) ? a.pflege.slice() : [];
    pflege.sort(function (x, y) { return String(y && y.datum || '').localeCompare(String(x && x.datum || '')); });
    grid.appendChild(section('Pflege (' + pflege.length + ')', listOrEmpty(pflege, function (m) {
      m = m || {};
      return h('li', null,
        h('span', null, show(m.typ), isEmpty(m.kommentar) ? null : h('div', { class: 'cps-sub', text: m.kommentar })),
        h('span', { class: 'cps-sub', text: fmtDate(m.datum) }));
    })));

    // Pflanzen (alte Daten: reine Texte)
    var pflanzen = Array.isArray(a.pflanzen) ? a.pflanzen : [];
    grid.appendChild(section('Pflanzen (' + pflanzen.length + ')', listOrEmpty(pflanzen, function (x) {
      var name = typeof x === 'string' ? x : (x && x.name);
      var seit = typeof x === 'object' && x ? x.eingesetztAm : null;
      return h('li', null, h('span', { text: name || '–' }),
        h('span', { class: 'cps-sub', text: seit ? 'eingesetzt ' + fmtDate(seit) : '' }));
    })));

    // Besatz
    var besatz = Array.isArray(a.besatz) ? a.besatz : [];
    grid.appendChild(section('Besatz (' + besatz.length + ')', listOrEmpty(besatz, function (b) {
      b = b || {};
      return h('li', null,
        h('span', { text: (isEmpty(b.anzahl) ? '' : b.anzahl + ' × ') + (b.name || '–') }),
        h('span', { class: 'cps-sub', text: b.eingesetztAm ? 'eingesetzt ' + fmtDate(b.eingesetztAm) : '' }));
    })));

    return grid;
  }

  /** Foto-URL (Edge Function); der Kurz-Hash ändert sich mit dem Bild und umgeht so alte Zwischenspeicher. */
  function photoUrl(slug, nr, hash) {
    return FUNCTIONS_URL + '/messebecken-bild?slug=' + encodeURIComponent(slug) + '&bild=' + nr
      + '&v=' + encodeURIComponent(hash || '');
  }

  /** Ein Foto als Bild mit Link auf die Originalgröße; fehlt es doch, verschwindet die Karte. */
  function photoFigure(slug, nr, hash, caption) {
    var url = photoUrl(slug, nr, hash);
    var fig = h('figure', { class: 'cps-photo' });
    var img = h('img', { src: url, alt: caption, loading: 'lazy' });
    img.addEventListener('error', function () { if (fig.parentNode) fig.parentNode.removeChild(fig); });
    fig.appendChild(h('a', { href: url, target: '_blank', rel: 'noopener' }, img));
    fig.appendChild(h('figcaption', { text: caption }));
    return fig;
  }

  function photosBlock(p, a) {
    var slug = currentSlug;
    var figs = [];
    if (a.bild_1) figs.push(photoFigure(slug, 1, a.bild_1, 'Aquarium'));
    if (a.bild_2) figs.push(photoFigure(slug, 2, a.bild_2, 'Beleuchtung'));
    return figs.length ? h('div', { class: 'cps-photos' }, figs) : null;
  }

  function listOrEmpty(items, renderItem) {
    if (!items.length) return h('p', { class: 'cps-muted', text: 'Keine Einträge.' });
    return h('ul', { class: 'cps-list' }, items.map(renderItem));
  }

  /* ── Tab 2: Messwerte ─────────────────────────────────────────────────── */

  var PARAM_ORDER = ['Nitrat', 'Phosphat', 'Kalium', 'Magnesium', 'Eisen_sensitiv', 'Calcium',
    'pH', 'pH_45_565', 'pH_566_8', 'KH', 'GH', 'Silikat', 'Nitrit'];
  var PARAM_LABEL = {
    Eisen_sensitiv: 'Eisen sensitiv', pH_45_565: 'pH 4,5 – 5,65', pH_566_8: 'pH 5,66 – 8',
  };
  var PARAM_UNIT = {
    Nitrat: 'mg/l', Phosphat: 'mg/l', Kalium: 'mg/l', Magnesium: 'mg/l',
    Eisen_sensitiv: 'mg/l', Calcium: 'mg/l', Silikat: 'mg/l', Nitrit: 'mg/l',
  };

  function paramLabel(key) {
    var base = PARAM_LABEL[key] || key;
    return PARAM_UNIT[key] ? base + ' (' + PARAM_UNIT[key] + ')' : base;
  }

  function renderMesswerte(p) {
    var reihen = Array.isArray(p.messwerte) ? p.messwerte : [];
    if (!reihen.length) return h('p', { class: 'cps-muted', text: 'Für dieses Aquarium sind keine Messwerte gespeichert.' });

    var present = {};
    reihen.forEach(function (r) {
      Object.keys((r && r.werte) || {}).forEach(function (k) { present[k] = true; });
    });
    var keys = PARAM_ORDER.filter(function (k) { return present[k]; });
    Object.keys(present).filter(function (k) { return PARAM_ORDER.indexOf(k) < 0; }).sort()
      .forEach(function (k) { keys.push(k); });

    var head = h('tr', null, h('th', { class: 'cps-sticky', text: 'Parameter' }));
    reihen.forEach(function (r) {
      head.appendChild(h('th', { text: fmtDateTime(r.zeit_iso) || String(r.zeit || '') }));
    });

    var body = h('tbody');
    keys.forEach(function (k) {
      var tr = h('tr', null, h('td', { class: 'cps-sticky', text: paramLabel(k) }));
      reihen.forEach(function (r) {
        var v = r && r.werte ? r.werte[k] : undefined;
        tr.appendChild(h('td', null, valueCell(v)));
      });
      body.appendChild(tr);
    });
    if (reihen.some(function (r) { return r && !isEmpty(r.kommentar); })) {
      var tr = h('tr', null, h('td', { class: 'cps-sticky', text: 'Kommentar' }));
      reihen.forEach(function (r) {
        tr.appendChild(h('td', { class: 'cps-comment' }, show(r && r.kommentar)));
      });
      body.appendChild(tr);
    }

    return h('div', { class: 'cps-p-list' },
      // Desktop/Tablet: Tabelle (Parameter untereinander, Messreihen nebeneinander)
      h('div', { class: 'cps-table-wrap cps-only-wide' }, h('table', { class: 'cps-table' }, h('thead', null, head), body)),
      // Handy: eine Karte je Messreihe, neueste oben - kein seitliches Wischen nötig
      renderMesswerteKarten(reihen, keys),
      h('p', { class: 'cps-note cps-only-wide', text: reihen.length + ' Messreihe' + (reihen.length === 1 ? '' : 'n') + ', neueste links.' }));
  }

  var KARTEN_ERST = 8;    // so viele Karten sind zunächst sichtbar; der Rest per Knopf

  function renderMesswerteKarten(reihen, keys) {
    var box = h('div', { class: 'cps-only-narrow' });
    var list = h('div', { class: 'cps-mcards' });
    var shown = 0;
    var more = h('button', { type: 'button', class: 'cps-btn cps-more' });

    function addCard(r) {
      var chips = h('dl', { class: 'cps-mvals' });
      var n = 0;
      keys.forEach(function (k) {
        var v = r && r.werte ? r.werte[k] : undefined;
        if (isEmpty(v) || String(v).trim() === '-') return;     // leere Werte gar nicht erst zeigen
        n++;
        chips.appendChild(h('div', { class: 'cps-mval' },
          h('dt', { text: PARAM_LABEL[k] || k.replace(/_/g, ' ') }),
          h('dd', null, valueCell(v), PARAM_UNIT[k] && !isTooHighLow(v) ? h('span', { class: 'cps-unit', text: PARAM_UNIT[k] }) : null)));
      });
      list.appendChild(h('article', { class: 'cps-mcard' },
        h('header', null,
          h('time', { text: fmtDateTime(r.zeit_iso) || String(r.zeit || '') }),
          h('span', { class: 'cps-sub', text: n + ' Wert' + (n === 1 ? '' : 'e') })),
        n ? chips : h('p', { class: 'cps-muted', text: 'Keine Werte.' }),
        isEmpty(r.kommentar) ? null : h('p', { class: 'cps-mcomment', text: r.kommentar })));
    }
    function showMore() {
      var upto = Math.min(reihen.length, shown + KARTEN_ERST);
      for (; shown < upto; shown++) addCard(reihen[shown]);
      var rest = reihen.length - shown;
      more.textContent = 'Ältere Messungen anzeigen (' + rest + ')';
      more.classList.toggle('cps-hidden', rest <= 0);
    }
    more.addEventListener('click', showMore);
    showMore();
    box.appendChild(list);
    box.appendChild(more);
    box.appendChild(h('p', { class: 'cps-note', text: reihen.length + ' Messreihe' + (reihen.length === 1 ? '' : 'n') + ', neueste oben.' }));
    return box;
  }

  function isTooHighLow(v) { return /^zu\s/i.test(String(v).trim()); }

  function valueCell(v) {
    if (isEmpty(v) || String(v).trim() === '-') return dash();
    if (isTooHighLow(v)) return h('span', { class: 'cps-pill cps-warn', text: String(v) });
    var n = toNumber(v);
    return n === null ? String(v) : numStr(n);
  }

  /* ── Tab 3: Düngung ───────────────────────────────────────────────────── */

  var NUTRIENTS = ['Nitrat', 'Phosphat', 'Kalium', 'Magnesium'];

  /** Letzte tatsächliche Messung je Nährstoff (wie in der App, Abschnitt 160). */
  function latestPerNutrient(reihen, key) {
    for (var i = 0; i < reihen.length; i++) {
      var r = reihen[i];
      var raw = r && r.werte ? r.werte[key] : undefined;
      if (isEmpty(raw)) continue;
      var s = String(raw).trim();
      if (s === '-' || s === '') continue;
      if (isTooHighLow(s) || !isNaN(Number(s.replace(',', '.')))) {
        return { value: s, zeit: r.zeit_iso || r.zeit };
      }
    }
    return null;
  }

  function renderDuengung(p) {
    var d = p.duengung || {};
    var reihen = Array.isArray(p.messwerte) ? p.messwerte : [];
    var grid = h('div', { class: 'cps-grid' });

    var nb = h('tbody');
    NUTRIENTS.forEach(function (k) {
      var ist = latestPerNutrient(reihen, k);
      var ziel = zielOf(k, d);
      nb.appendChild(h('tr', null,
        h('td', { text: k }),
        h('td', null, ist ? valueCell(ist.value) : dash()),
        h('td', { text: ist ? fmtDateShort(ist.zeit) : '' }),
        h('td', null, num(ziel))));
    });
    // Volle Breite + umbrechende Überschriften (cps-table-fit): Ist, Messdatum und
    // Ziel sollen ohne seitliches Scrollen sichtbar sein.
    grid.appendChild(section('Nährstoffe: letzte Messung / Ziel (mg/l)', h('div', { class: 'cps-table-wrap' },
      h('table', { class: 'cps-table cps-table-fit' },
        h('thead', null, h('tr', null,
          h('th', { text: 'Nährstoff' }), h('th', { text: 'Ist' }),
          h('th', { text: 'Datum' }), h('th', { text: 'Ziel' }))),
        nb)), true));

    var taeglich = Array.isArray(d.taegliche_duengung) ? d.taegliche_duengung : [];
    grid.appendChild(section('Tägliche Düngung', listOrEmpty(taeglich, function (x) {
      x = x || {};
      return h('li', null, h('span', { text: x.name || '–' }), h('span', null, num(x.value, 'ml')));
    })));

    grid.appendChild(section('Düngekapseln', kv([
      ['Letzte Gabe', isEmpty(d.duengekapseln_datum) ? dash() : fmtDate(d.duengekapseln_datum)],
      // Das Intervall wird in der App in WOCHEN angegeben (Standard 10, empfohlen 6-10).
      ['Intervall', isEmpty(d.duengekapseln_intervall) ? dash() :
        (Number(d.duengekapseln_intervall) === 1 ? 'jede Woche' : 'alle ' + d.duengekapseln_intervall + ' Wochen')],
    ])));

    return grid;
  }


  /* ── Verlaufs-Diagramme (Nährstoffe) ──────────────────────────────────── */

  var DEFAULT_ZIEL = { Nitrat: 20, Phosphat: 1.2, Kalium: 5, Magnesium: 10 };
  var SVGNS = 'http://www.w3.org/2000/svg';

  function svg(tag, attrs) {
    var el = document.createElementNS(SVGNS, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, String(attrs[k])); });
    for (var i = 2; i < arguments.length; i++) if (arguments[i]) el.appendChild(arguments[i]);
    return el;
  }

  function toNumber(v) {
    if (isEmpty(v)) return null;
    var n = Number(String(v).trim().replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  function zielOf(key, d) {
    var z = toNumber(d && d.zielwerte ? d.zielwerte[key] : null);
    return z === null ? DEFAULT_ZIEL[key] : z;
  }

  /** Zeitreihe eines Parameters (älteste zuerst); "zu hoch"/"-" werden übersprungen. */
  function seriesOf(reihen, key) {
    var pts = [];
    reihen.forEach(function (r) {
      var n = toNumber(r && r.werte ? r.werte[key] : null);
      var t = r && r.zeit_iso ? new Date(r.zeit_iso).getTime() : NaN;
      if (n !== null && isFinite(t)) pts.push({ t: t, v: n });
    });
    pts.sort(function (a, b) { return a.t - b.t; });
    return pts;
  }

  function chartCard(key, pts, ziel) {
    var title = key + ' (mg/l)';
    var body = h('div', { class: 'cps-chart' });
    if (pts.length < 2) {
      body.appendChild(h('p', { class: 'cps-muted', text: 'Für ein Diagramm sind mindestens zwei Messungen nötig.' }));
      return section(title, body);
    }
    var W = 320, H = 150, L = 40, R = 12, T = 12, B = 26;
    var t0 = pts[0].t, t1 = pts[pts.length - 1].t;
    var vmax = Math.max.apply(null, pts.map(function (p) { return p.v; }).concat(ziel || 0)) * 1.15 || 1;
    function X(t) { return L + (t1 === t0 ? 0 : (t - t0) / (t1 - t0)) * (W - L - R); }
    function Y(v) { return T + (1 - v / vmax) * (H - T - B); }

    var s = svg('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'cps-svg', role: 'img',
      'aria-label': key + ' im Zeitverlauf, ' + pts.length + ' Messungen' });
    // Raster: Basislinie und obere Linie, dezent
    [0, vmax].forEach(function (v) {
      s.appendChild(svg('line', { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: 'cps-grid-line' }));
      var lab = svg('text', { x: L - 6, y: Y(v) + 4, 'text-anchor': 'end', class: 'cps-axis' });
      lab.textContent = numStr(Math.round(v * 10) / 10);
      s.appendChild(lab);
    });
    // Zielwert: gestrichelt, direkt beschriftet
    if (ziel !== undefined && ziel !== null) {
      s.appendChild(svg('line', { x1: L, x2: W - R, y1: Y(ziel), y2: Y(ziel), class: 'cps-target' }));
      var tl = svg('text', { x: W - R, y: Y(ziel) - 5, 'text-anchor': 'end', class: 'cps-axis cps-axis-target' });
      tl.textContent = 'Ziel ' + numStr(ziel);
      s.appendChild(tl);
    }
    // X-Achse: erstes und letztes Datum
    var xa = svg('text', { x: L, y: H - 8, class: 'cps-axis' }); xa.textContent = fmtDate(t0);
    var xb = svg('text', { x: W - R, y: H - 8, 'text-anchor': 'end', class: 'cps-axis' }); xb.textContent = fmtDate(t1);
    s.appendChild(xa); s.appendChild(xb);
    // Linie
    s.appendChild(svg('polyline', { class: 'cps-line',
      points: pts.map(function (p) { return X(p.t).toFixed(1) + ',' + Y(p.v).toFixed(1); }).join(' ') }));
    if (pts.length <= 40) {
      pts.forEach(function (p) {
        s.appendChild(svg('circle', { cx: X(p.t).toFixed(1), cy: Y(p.v).toFixed(1), r: 3, class: 'cps-dot' }));
      });
    }
    // Hover: Fadenkreuz + Tooltip am nächsten Punkt
    var cross = svg('line', { y1: T, y2: H - B, class: 'cps-cross', visibility: 'hidden' });
    var mark = svg('circle', { r: 5, class: 'cps-mark', visibility: 'hidden' });
    s.appendChild(cross); s.appendChild(mark);
    var tip = h('div', { class: 'cps-tip cps-hidden', role: 'status' });
    function move(ev) {
      var rect = s.getBoundingClientRect();
      if (!rect.width) return;
      var px = (ev.clientX - rect.left) / rect.width * W;
      var best = pts[0], bd = Infinity;
      pts.forEach(function (p) { var d = Math.abs(X(p.t) - px); if (d < bd) { bd = d; best = p; } });
      cross.setAttribute('x1', X(best.t)); cross.setAttribute('x2', X(best.t));
      mark.setAttribute('cx', X(best.t)); mark.setAttribute('cy', Y(best.v));
      cross.setAttribute('visibility', 'visible'); mark.setAttribute('visibility', 'visible');
      tip.textContent = fmtDate(best.t) + ': ' + numStr(best.v) + ' mg/l';
      tip.classList.remove('cps-hidden');
    }
    function leave() {
      cross.setAttribute('visibility', 'hidden'); mark.setAttribute('visibility', 'hidden');
      tip.classList.add('cps-hidden');
    }
    s.addEventListener('pointermove', move);
    s.addEventListener('pointerdown', move);
    s.addEventListener('pointerleave', leave);

    var last = pts[pts.length - 1];
    body.appendChild(h('p', { class: 'cps-chart-now' },
      'Zuletzt ', h('b', { text: numStr(last.v) }), ' mg/l (' + fmtDate(last.t) + ')',
      ziel !== undefined && ziel !== null ? ' · Ziel ' + numStr(ziel) : ''));
    body.appendChild(s);
    body.appendChild(tip);
    return section(title, body);
  }

  function renderCharts(p) {
    var reihen = Array.isArray(p.messwerte) ? p.messwerte : [];
    var d = p.duengung || {};
    var grid = h('div', { class: 'cps-grid cps-charts' });
    NUTRIENTS.forEach(function (k) { grid.appendChild(chartCard(k, seriesOf(reihen, k), zielOf(k, d))); });
    return grid;
  }

  /* ── Seite ────────────────────────────────────────────────────────────── */

  var currentSlug = '';

  /** Slug aus #messebecken/<slug>; leer = Übersicht aller freigegebenen Becken. */
  function slugFromHash() {
    var parts = location.hash.replace('#', '').split('/');
    var s = (parts[1] || '').trim().toLowerCase();
    try { s = decodeURIComponent(s); } catch (e) { /* unverändert lassen */ }
    return s;
  }

  function showMessage(title, text, retry) {
    if (!alive()) return;
    $('messageTitle').textContent = title;
    $('messageText').textContent = text || '';
    $('btnRetry').classList.toggle('cps-hidden', !retry);
    $('viewMessage').classList.remove('cps-hidden');
    $('viewDetail').classList.add('cps-hidden');
    $('viewList').classList.add('cps-hidden');
    $('btnBack').classList.toggle('cps-hidden', !currentSlug);
  }

  function renderPanel() {
    var panel = $('panel');
    clear(panel);
    panel.classList.remove('cps-mess');
    if (!data) return;
    if (tab === 'messwerte') {
      if (Array.isArray(data.messwerte) && data.messwerte.length) {
        panel.classList.add('cps-mess');
        panel.appendChild(h('h2', { class: 'cps-h2 cps-p-charts-h', text: 'Verlauf der Nährstoffe' }));
        var charts = renderCharts(data); charts.classList.add('cps-p-charts');
        panel.appendChild(charts);
        panel.appendChild(h('h2', { class: 'cps-h2 cps-p-list-h', text: 'Alle Messreihen' }));
      }
      panel.appendChild(renderMesswerte(data));
    } else if (tab === 'duengung') {
      panel.appendChild(renderDuengung(data));
    } else {
      panel.appendChild(renderAquarium(data));
    }
    var tabs = document.querySelectorAll('#cps-tabs .cps-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].setAttribute('aria-selected', tabs[i].getAttribute('data-tab') === tab ? 'true' : 'false');
    }
  }

  function renderAll() {
    if (!alive() || !data) return;
    var a = data.aquarium || {};
    $('detailTitle').textContent = cleanName(data.titel || a.name) || 'Messebecken';
    var reihen = Array.isArray(data.messwerte) ? data.messwerte : [];
    var latest = reihen.length ? fmtDate(reihen[0].zeit_iso) : null;
    $('detailMeta').textContent = 'Live aus der C&P Aquaplants App'
      + (latest ? ' · letzte Messung: ' + latest : '')
      + ' · Stand der Seite: ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
    $('viewMessage').classList.add('cps-hidden');
    $('viewList').classList.add('cps-hidden');
    $('viewDetail').classList.remove('cps-hidden');
    $('btnBack').classList.remove('cps-hidden');
    renderPanel();
  }

  /** Übersicht: eine Karte je freigegebenem Becken (Foto, Name, Maße, letzte Messung). */
  function renderList() {
    if (!alive() || !list) return;
    var box = $('listGrid');
    clear(box);
    $('listEmpty').classList.toggle('cps-hidden', list.length > 0);
    list.forEach(function (b) {
      var maße = (b.auto === false || [b.breite, b.hoehe, b.tiefe].every(isEmpty)) ? null :
        [b.breite, b.hoehe, b.tiefe].map(function (x) { return numStr(x); }).join(' × ') + '\u00a0cm';
      var info = [];
      if (!isEmpty(b.nettovolumen)) info.push(numStr(b.nettovolumen, 'L'));
      if (maße) info.push(maße);
      var thumb = h('div', { class: 'cps-thumb' });
      if (b.bild_1) {
        var img = h('img', { src: photoUrl(b.slug, 1, b.bild_1), alt: '', loading: 'lazy' });
        img.addEventListener('error', function () { if (img.parentNode) img.parentNode.removeChild(img); });
        thumb.appendChild(img);
      }
      box.appendChild(h('a', { class: 'cps-tank', href: '#messebecken/' + b.slug },
        thumb,
        h('div', { class: 'cps-tank-body' },
          h('h2', { class: 'cps-tank-title', text: cleanName(b.titel) || b.slug }),
          info.length ? h('p', { class: 'cps-tank-info', text: info.join(' · ') }) : null,
          b.letzte_messung ? h('p', { class: 'cps-sub', text: 'Letzte Messung: ' + fmtDate(b.letzte_messung) }) : null)));
    });
    $('viewMessage').classList.add('cps-hidden');
    $('viewDetail').classList.add('cps-hidden');
    $('btnBack').classList.add('cps-hidden');
    $('viewList').classList.remove('cps-hidden');
  }

  function load(silent) {
    var slug = slugFromHash();
    currentSlug = slug;
    if (!slug) { loadList(silent); return; }
    if (!SLUG_RE.test(slug)) { showMessage('Seite nicht gefunden', 'Der Link ist ungültig.'); return; }
    if (!silent && !data) showMessage('Lade …', '');
    client.rpc('get_messebecken', { p_slug: slug }).then(function (res) {
      if (!alive()) return;
      if (res.error) throw res.error;
      if (!res.data) {
        data = null;
        showMessage('Seite nicht verfügbar', 'Dieses Messebecken ist nicht (mehr) freigegeben.');
        return;
      }
      data = res.data;
      renderAll();
    }).catch(function () {
      if (!alive()) return;
      // Bereits angezeigte Daten bleiben stehen; nur beim ersten Laden eine Fehlerseite.
      if (!data) showMessage('Keine Verbindung', 'Die Daten konnten nicht geladen werden. Bitte Internetverbindung prüfen.', true);
    });
  }

  function loadList(silent) {
    data = null;
    if (!silent && !list) showMessage('Lade …', '');
    client.rpc('get_messebecken_liste').then(function (res) {
      if (!alive()) return;
      if (res.error) throw res.error;
      list = Array.isArray(res.data) ? res.data : [];
      renderList();
    }).catch(function () {
      if (!alive()) return;
      if (!list) showMessage('Keine Verbindung', 'Die Daten konnten nicht geladen werden. Bitte Internetverbindung prüfen.', true);
    });
  }

  function onHashChange() {
    if (!alive()) return;
    if (location.hash.replace('#', '').split('/')[0] !== 'messebecken') return;
    data = null;
    list = null;
    tab = 'aquarium';
    load(false);
  }

  function getClient() {
    if (!window.__cpmClient) {
      window.__cpmClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
    }
    return window.__cpmClient;
  }

  function mount() {
    if (cleanup) { cleanup(); cleanup = null; }
    if (!alive()) return;
    applyPageMeta();
    client = getClient();
    data = null;
    list = null;
    tab = 'aquarium';

    var tabs = document.querySelectorAll('#cps-tabs .cps-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function (ev) {
        tab = ev.currentTarget.getAttribute('data-tab');
        renderPanel();
      });
    }
    $('btnRetry').addEventListener('click', function () { load(false); });
    $('btnRefresh').addEventListener('click', function () { load(true); });
    window.addEventListener('hashchange', onHashChange);
    // Bei offener Seite regelmäßig neu laden - aber nur, wenn der Tab sichtbar ist.
    timer = setInterval(function () {
      if (!alive()) { clearInterval(timer); return; }
      if (!document.hidden) load(true);
    }, REFRESH_MS);
    cleanup = function () {
      if (timer) { clearInterval(timer); timer = null; }
      window.removeEventListener('hashchange', onHashChange);
    };
    load(false);
  }

  window.CPMesse = { mount: mount };
})();
