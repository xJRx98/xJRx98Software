/* C&P Aquaplants - Seite "Auswertung" (Unterseite von xjrx98software.de, #auswertung)
 *
 * Nutzerzahlen (ohne anonyme Konten) und Auswertungen der Aquariendaten für einen frei
 * wählbaren Zeitraum. Die Daten liefert die Edge Function `weekly-report` (Vorschau-Modus:
 * `dry`), die auch den Wochenbericht per E-Mail versendet; die Datenbankfunktion
 * `report_data_range` prüft den Zugriff (is_report_admin). Siehe CLOUD_SETUP.md Abschnitt 174.
 *
 * EINBINDUNG: wie die Support-Seite als Fragment (`pages/auswertung.html`) im Router von
 * index.html. `CPAuswertung.mount()` darf mehrfach aufgerufen werden. Die Anmeldung wird mit
 * der Support-Seite geteilt (gleicher Speicherschlüssel `cp-support-auth`).
 *
 * SICHERHEIT: Der Bericht (HTML) wird vom Server mit maskierten Werten gebaut und in einem
 * Rahmen ohne Skriptausführung angezeigt (`sandbox` ohne allow-scripts). Eigene Oberfläche:
 * nie innerHTML, nur textContent (siehe `h()`).
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://eznesbcyjduxqhkpcyny.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_JfIZ0nyrSoGcC19Yw_L-Yw_gpMtHn9Y';
  var FUNCTION_NAME = 'weekly-report';
  var START_DATE = '2020-01-01';   // "Seit Beginn"
  var DEFAULT_PRESET = '7';

  var client = null;
  var cleanup = null;
  var flashTimer = null;
  var running = false;
  var me = null;

  // ── Tab-Titel, Icon und Navigation der Webseite (wie bei der Support-Seite) ──
  var PAGE_TITLE = 'Auswertung';
  var FAVICON_URL = 'data:image/png;base64,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';
  var savedMeta = null;
  var metaObserver = null;

  function alive() { return !!document.getElementById('cpa-root'); }
  function $(id) { return document.getElementById('cpa-' + id); }

  /* ── DOM-Helfer (kein innerHTML) ──────────────────────────────────────── */

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

  /* ── Supabase-Client (geteilt mit der Support-Seite) ──────────────────── */

  function safeStorage() {
    try {
      var s = window.sessionStorage;
      s.setItem('__cpa_test', '1');
      s.removeItem('__cpa_test');
      return s;
    } catch (e) {
      var mem = {};
      return {
        getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
        setItem: function (k, v) { mem[k] = String(v); },
        removeItem: function (k) { delete mem[k]; },
      };
    }
  }

  /** Gleiche Einstellungen und gleicher Speicherschlüssel wie die Support-Seite - so gilt eine
   *  Anmeldung für beide Seiten (der Client liegt in `window.__cpsClient`, egal wer ihn zuerst anlegt). */
  function getClient() {
    if (!window.__cpsClient) {
      window.__cpsClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          storage: safeStorage(),
          storageKey: 'cp-support-auth',
        },
      });
    }
    return window.__cpsClient;
  }

  /* ── Tab-Titel & Icon ─────────────────────────────────────────────────── */

  function applyPageMeta() {
    var root = $('root');
    if (!root) return;
    if (!savedMeta) {
      var olds = Array.prototype.slice.call(document.querySelectorAll('link[rel~="icon"]'));
      savedMeta = {
        title: document.title,
        links: olds.map(function (l) { return { el: l, parent: l.parentNode, next: l.nextSibling }; }),
        ours: null,
      };
      olds.forEach(function (l) { if (l.parentNode) l.parentNode.removeChild(l); });
    }
    document.title = PAGE_TITLE;
    if (savedMeta.ours && savedMeta.ours.parentNode) savedMeta.ours.parentNode.removeChild(savedMeta.ours);
    var ours = document.createElement('link');
    ours.setAttribute('rel', 'icon');
    ours.setAttribute('type', 'image/png');
    ours.setAttribute('href', FAVICON_URL);
    document.head.appendChild(ours);
    savedMeta.ours = ours;
    document.body.classList.add('cpa-page');
    if (metaObserver) metaObserver.disconnect();
    if (root.parentNode && window.MutationObserver) {
      metaObserver = new MutationObserver(function () { if (!alive()) restorePageMeta(); });
      metaObserver.observe(root.parentNode, { childList: true });
    }
  }

  function restorePageMeta() {
    if (metaObserver) { metaObserver.disconnect(); metaObserver = null; }
    document.body.classList.remove('cpa-page');
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

  /* ── Ansichten ────────────────────────────────────────────────────────── */

  var VIEWS = ['viewMessage', 'viewLogin', 'viewMain'];

  function showView(id) {
    if (!alive()) return;
    VIEWS.forEach(function (v) { $(v).classList.toggle('cpa-hidden', v !== id); });
  }

  function showMessage(title, text, withSupportButton) {
    if (!alive()) return;
    $('messageTitle').textContent = title;
    $('messageText').textContent = text || '';
    $('messageAction').classList.toggle('cpa-hidden', !withSupportButton);
    showView('viewMessage');
  }

  function showLogin(errorText) {
    if (!alive()) return;
    $('session').classList.add('cpa-hidden');
    $('flash').classList.add('cpa-hidden');
    var err = $('loginError');
    err.textContent = errorText || '';
    err.classList.toggle('cpa-hidden', !errorText);
    $('loginButton').disabled = false;
    showView('viewLogin');
    $('email').focus();
  }

  function flash(text, isErr) {
    if (!alive()) return;
    var el = $('flash');
    el.textContent = text;
    el.classList.toggle('cpa-flash-err', !!isErr);
    el.classList.remove('cpa-hidden');
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { if (alive()) $('flash').classList.add('cpa-hidden'); }, 7000);
  }

  function setSession(session) {
    var u = session && session.user ? session.user : null;
    me = u ? { id: u.id, email: u.email || '' } : null;
    $('sessionMail').textContent = u && u.email ? u.email : '';
    $('session').classList.remove('cpa-hidden');
  }

  function goToSupport() {
    if (typeof window.showPage === 'function') window.showPage('support');
    else window.location.hash = '#support';
  }

  /* ── Zeitraum ─────────────────────────────────────────────────────────── */

  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /** Datum als JJJJ-MM-TT (lokale Zeit). */
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function addDays(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); return x; }

  /** Von/Bis (JJJJ-MM-TT) einer Schnellauswahl; `today` ist für Tests überschreibbar. */
  function periodFor(preset, today) {
    var t = today || new Date();
    t = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    switch (preset) {
      case '7': return { von: iso(addDays(t, -6)), bis: iso(t) };
      case '30': return { von: iso(addDays(t, -29)), bis: iso(t) };
      case '90': return { von: iso(addDays(t, -89)), bis: iso(t) };
      case 'kw': {
        var dow = (t.getDay() + 6) % 7;                 // Montag = 0
        var monday = addDays(t, -dow - 7);              // Montag der Vorwoche
        return { von: iso(monday), bis: iso(addDays(monday, 6)) };
      }
      case 'monat': return { von: iso(new Date(t.getFullYear(), t.getMonth(), 1)), bis: iso(t) };
      case 'letzter-monat': {
        var first = new Date(t.getFullYear(), t.getMonth() - 1, 1);
        var last = new Date(t.getFullYear(), t.getMonth(), 0);
        return { von: iso(first), bis: iso(last) };
      }
      case 'jahr': return { von: iso(new Date(t.getFullYear(), 0, 1)), bis: iso(t) };
      case 'alles': return { von: START_DATE, bis: iso(t) };
      default: return null;
    }
  }

  function markPreset(preset) {
    var buttons = document.querySelectorAll('#cpa-presets .cpa-preset');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].setAttribute('aria-pressed', buttons[i].getAttribute('data-preset') === preset ? 'true' : 'false');
    }
  }

  function readPeriod() {
    var von = $('von').value;
    var bis = $('bis').value;
    if (!von || !bis) { flash('Bitte „Von“ und „Bis“ auswählen.', true); return null; }
    if (von > bis) { flash('„Von“ muss vor oder gleich „Bis“ liegen.', true); return null; }
    return { von: von, bis: bis, nurZeitraum: $('nur').checked };
  }

  function fmtDay(isoDay) {
    var p = String(isoDay).split('-');
    return p.length === 3 ? p[2] + '.' + p[1] + '.' + p[0] : String(isoDay);
  }

  /* ── Aufruf der Edge Function ─────────────────────────────────────────── */

  function errorText(e) {
    if (e && e.context && typeof e.context.json === 'function') {
      return e.context.json().then(
        function (j) { return (j && j.error) || e.message || 'Unbekannter Fehler'; },
        function () { return e.message || 'Unbekannter Fehler'; });
    }
    return Promise.resolve((e && e.message) || 'Verbindung nicht möglich');
  }

  function setBusy(busy) {
    running = busy;
    ['btnRun', 'btnMail'].forEach(function (id) { $(id).disabled = busy; });
    $('btnRun').textContent = busy ? 'Werte aus …' : 'Auswerten';
  }

  function invoke(body) {
    return client.functions.invoke(FUNCTION_NAME, { body: body }).then(function (res) {
      if (res.error) throw res.error;
      return res.data || {};
    });
  }

  /* ── Bericht anzeigen ─────────────────────────────────────────────────── */

  function base64ToBlob(b64, type) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: type || 'text/csv;charset=utf-8' });
  }

  function downloadFile(att) {
    var url = URL.createObjectURL(base64ToBlob(att.contentBase64, att.contentType));
    var a = document.createElement('a');
    a.href = url;
    a.download = att.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  function fitFrame(frame) {
    try {
      var doc = frame.contentDocument;
      if (doc && doc.documentElement) frame.style.height = (doc.documentElement.scrollHeight + 24) + 'px';
    } catch (e) { /* Rahmen nicht lesbar: Standardhöhe bleibt */ }
  }

  /* ── Ergebnis mit Tabs ────────────────────────────────────────────────── */

  var current = null;      // { data, period, sections }
  var activeTab = null;

  function findSection(id) {
    if (!current || !current.sections) return null;
    for (var i = 0; i < current.sections.length; i++) if (current.sections[i].id === id) return current.sections[i];
    return null;
  }

  /** CSV-Knöpfe: im Tab-Modus nur die Dateien des gezeigten Tabs, sonst alle. */
  function renderDownloads(files) {
    var box = $('downloads');
    clear(box);
    var all = (current && current.data.attachments) || [];
    all.forEach(function (att) {
      if (files && files.indexOf(att.filename) < 0) return;
      box.appendChild(h('button', {
        type: 'button', class: 'cpa-btn cpa-btn-small', title: 'Als CSV-Datei herunterladen (öffnet in Excel)',
        text: '⬇ ' + String(att.filename || 'Datei').replace(/^CP_Aquaplants_/, ''),
        onclick: function () { downloadFile(att); },
      }));
    });
  }

  function showDoc(html) {
    var frame = $('frame');
    frame.onload = function () { fitFrame(frame); };
    frame.srcdoc = String(html || '');
  }

  /** Feste Tabs, die nicht vom Server kommen: Ihr Inhalt steht fertig in auswertung.html
   *  (`panel` = Element-ID ohne `cpa-`) und gilt unabhängig vom gewählten Zeitraum. */
  var STATIC_TABS = [
    { id: 'gh-karte', tab: 'GH-Karte', title: 'Gesamthärte des Leitungswassers je Kreis (Deutschlandkarte)', panel: 'ghkarte', files: [] },
  ];

  /** Zeigt entweder den Rahmen mit dem Bericht oder den Bereich eines festen Tabs. */
  function showPanel(panel) {
    $('frame').classList.toggle('cpa-hidden', !!panel);
    STATIC_TABS.forEach(function (t) {
      var el = $(t.panel);
      if (el) el.classList.toggle('cpa-hidden', t.panel !== panel);
    });
  }

  function selectTab(id) {
    var sec = findSection(id);
    if (!sec) return;
    activeTab = id;
    var tabs = document.querySelectorAll('#cpa-tabs .cpa-tab');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-tab') === id;
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      tabs[i].setAttribute('tabindex', on ? '0' : '-1');
    }
    showPanel(sec.panel || null);
    if (!sec.panel) showDoc(sec.html);
    renderDownloads(sec.files || []);
  }

  /* ── GH-Karte: Orts- und PLZ-Suche ──────────────────────────────────────────────── */

  var GH_MAX_TREFFER = 8;
  var ghKreise = null;     // [{ ags, name, art, land, gh }]
  var ghOrte = null;       // [{ name, key, kreis }] - Gemeinden, die Kreise selbst und Postleitzahlen
  var ghPlz = null;        // PLZ -> [Index des Kreises, …]; der erste ist der mit dem größten Flächenanteil
  var ghTreffer = [];      // aktuell angebotene Einträge aus ghOrte
  var ghAktiv = -1;        // markierter Vorschlag (Pfeiltasten)

  /** Suchschlüssel: klein, Umlaute ausgeschrieben, ohne Leer- und Sonderzeichen ("Bad Tölz" -> "badtoelz"). */
  function ghKey(s) {
    return String(s).toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]/g, '');
  }

  /** Liest die Kreis-, Gemeinde- und PLZ-Liste aus auswertung.html (einmal je Seitenaufruf).
   *  Die Liste steht in einem <template>: ein <script type="application/json"> überlebt den Router
   *  von index.html nicht (runPageScripts legt jedes <script> ohne id und type neu an). */
  function ghLoad() {
    if (ghOrte) return true;
    var el = $('ghOrte');
    if (!el) return false;
    var raw;
    try { raw = JSON.parse(el.content ? el.content.textContent : el.textContent); } catch (e) { return false; }
    if (!Array.isArray(raw)) return false;
    ghKreise = [];
    ghOrte = [];
    ghPlz = {};
    var teil = [];
    raw.forEach(function (k, i) {
      ghKreise.push({ ags: k[0], name: k[1], art: k[2], land: k[3], gh: k[4] });
      var seen = {};
      (k[5] ? k[5].split('|') : []).forEach(function (name) {
        seen[name] = true;
        ghOrte.push({ name: name, key: ghKey(name), kreis: i });
      });
      // der Kreis selbst ist auch suchbar (kreisfreie Städte stehen schon als Gemeinde in der Liste)
      if (!seen[k[1]]) ghOrte.push({ name: k[1], key: ghKey(k[1]), kreis: i, istKreis: true });
      (k[6] ? k[6].split('|') : []).forEach(function (plz) {
        ghPlz[plz] = [i];
        ghOrte.push({ name: plz, key: plz, kreis: i, plz: true });
      });
      (k[7] ? k[7].split('|') : []).forEach(function (plz) { teil.push([plz, i]); });
    });
    // PLZ, die in weitere Kreise reichen: eigener Eintrag je Kreis
    teil.forEach(function (t) {
      (ghPlz[t[0]] = ghPlz[t[0]] || []).push(t[1]);
      ghOrte.push({ name: t[0], key: t[0], kreis: t[1], plz: true, teil: true });
    });
    return true;
  }

  /** "Landkreis Harz", "Kreisfreie Stadt Kiel" - ohne Vorsatz, wenn der Name schon "Kreis" enthält (Vogtlandkreis). */
  function ghKreisText(k) {
    if (k.art === 'Stadt') return 'Kreisfreie Stadt ' + k.name;
    return /kreis/i.test(k.name) ? k.name : 'Landkreis ' + k.name;
  }

  function ghBereich(gh) { return gh < 8.4 ? 'weich' : gh <= 14 ? 'mittel' : 'hart'; }

  function ghWert(k) {
    return k.gh === null ? 'keine Angabe' : k.gh.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' °dH (' + ghBereich(k.gh) + ')';
  }

  /** Treffer: erst Namen, die mit der Eingabe beginnen, dann solche, die sie enthalten; je alphabetisch.
   *  Besteht die Eingabe nur aus Ziffern, wird nach Postleitzahlen gesucht (nur am Anfang). */
  function ghFind(text) {
    var q = ghKey(text);
    if (q.length < 2) return [];
    var nurPlz = /^[0-9]+$/.test(q);
    var start = [], inside = [];
    for (var i = 0; i < ghOrte.length; i++) {
      if (!!ghOrte[i].plz !== nurPlz) continue;
      var pos = ghOrte[i].key.indexOf(q);
      if (pos === 0) start.push(ghOrte[i]);
      else if (pos > 0 && !nurPlz) inside.push(ghOrte[i]);
    }
    var byName = function (a, b) {
      if (nurPlz) return a.key < b.key ? -1 : a.key > b.key ? 1 : (a.teil ? 1 : 0) - (b.teil ? 1 : 0) || a.kreis - b.kreis;
      return a.key.length - b.key.length || a.name.localeCompare(b.name, 'de') || a.kreis - b.kreis;
    };
    return start.sort(byName).concat(inside.sort(byName));
  }

  function ghCloseList() {
    ghTreffer = [];
    ghAktiv = -1;
    clear($('ghSuggest'));
    $('ghSuggest').classList.add('cpa-hidden');
    $('ghSearch').setAttribute('aria-expanded', 'false');
    $('ghSearch').removeAttribute('aria-activedescendant');
  }

  function ghMark(i) {
    ghAktiv = i;
    var items = $('ghSuggest').children;
    for (var j = 0; j < items.length; j++) items[j].setAttribute('aria-selected', j === i ? 'true' : 'false');
    if (i >= 0 && items[i]) $('ghSearch').setAttribute('aria-activedescendant', items[i].id);
    else $('ghSearch').removeAttribute('aria-activedescendant');
  }

  /** Hebt den Kreis auf der Karte hervor (nach vorn holen, damit der Rand nicht überdeckt wird). */
  function ghHighlight(ags) {
    var old = document.querySelectorAll('#cpa-ghkarte .cpa-gh-kreise path.cpa-gh-sel');
    for (var i = 0; i < old.length; i++) old[i].classList.remove('cpa-gh-sel');
    var path = ags ? document.querySelector('#cpa-ghkarte .cpa-gh-kreise path[data-k="' + ags + '"]') : null;
    if (!path) return;
    path.classList.add('cpa-gh-sel');
    path.parentNode.appendChild(path);
  }

  function ghTitel(ort, k) { return ort.plz ? 'PLZ ' + ort.name : ort.istKreis ? ghKreisText(k) : ort.name; }

  /** Bei einer PLZ, die in mehrere Kreise reicht: die übrigen Kreise mit ihrem Wert. */
  function ghAndereKreise(ort) {
    if (!ort.plz) return [];
    return (ghPlz[ort.name] || []).filter(function (i) { return i !== ort.kreis; }).map(function (i) {
      return ghKreisText(ghKreise[i]) + ': ' + ghWert(ghKreise[i]);
    });
  }

  function ghShowHit(ort) {
    var k = ghKreise[ort.kreis];
    var andere = ghAndereKreise(ort);
    var box = $('ghHit');
    clear(box);
    box.appendChild(h('div', { class: 'cpa-gh-hit-ort', text: ghTitel(ort, k) }));
    box.appendChild(h('dl', { class: 'cpa-kv' },
      h('dt', { text: k.art === 'Stadt' ? 'Kreisfreie Stadt' : 'Landkreis' }),
      h('dd', { text: k.name + (ort.teil ? ' (Teilgebiet der PLZ)' : andere.length ? ' (größter Teil der PLZ)' : '') }),
      h('dt', { text: 'Bundesland' }), h('dd', { text: k.land }),
      h('dt', { text: 'Gesamthärte im Kreis' }), h('dd', { class: 'cpa-gh-hit-wert', text: ghWert(k) }),
      andere.length ? [h('dt', { text: 'PLZ reicht auch in' }), h('dd', { text: andere.join('\n') })] : null));
    box.classList.remove('cpa-hidden');
    ghHighlight(k.ags);
  }

  function ghPick(ort) {
    $('ghSearch').value = ort.name;
    ghCloseList();
    ghShowHit(ort);
  }

  function ghRenderList(text) {
    var list = $('ghSuggest');
    clear(list);
    var alle = ghFind(text);
    ghTreffer = alle.slice(0, GH_MAX_TREFFER);
    ghAktiv = -1;
    if (ghKey(text).length < 2) { ghCloseList(); return; }
    if (!ghTreffer.length) {
      list.appendChild(h('li', {
        class: 'cpa-gh-leer',
        text: /^[0-9 ]+$/.test(text) ? 'Keine Postleitzahl gefunden, die so beginnt.' : 'Kein Ort gefunden. Die Suche kennt Gemeinden, Städte und Postleitzahlen, keine Ortsteile.',
      }));
    }
    ghTreffer.forEach(function (ort, i) {
      var k = ghKreise[ort.kreis];
      list.appendChild(h('li', {
        role: 'option', id: 'cpa-ghOpt-' + i, 'aria-selected': 'false',
        // mousedown statt click: sonst schließt das blur des Eingabefelds die Liste vor der Auswahl
        onmousedown: function (ev) { ev.preventDefault(); ghPick(ort); },
      },
        h('span', { class: 'cpa-gh-opt-ort', text: ghTitel(ort, k) }),
        h('span', { class: 'cpa-sub', text: (ort.istKreis ? '' : ghKreisText(k) + (ort.teil ? ' (Teilgebiet)' : '') + ' · ') + k.land + ' · ' + ghWert(k) })));
    });
    if (alle.length > ghTreffer.length) {
      list.appendChild(h('li', { class: 'cpa-gh-leer', text: (alle.length - ghTreffer.length) + ' weitere Treffer – bitte genauer eingeben.' }));
    }
    list.classList.remove('cpa-hidden');
    $('ghSearch').setAttribute('aria-expanded', 'true');
  }

  function onGhInput() {
    if (!ghLoad()) {
      var list = $('ghSuggest');
      clear(list);
      list.appendChild(h('li', { class: 'cpa-gh-leer', text: 'Die Ortsliste konnte nicht geladen werden. Bitte die Seite neu laden.' }));
      list.classList.remove('cpa-hidden');
      return;
    }
    var text = $('ghSearch').value;
    if (!text) { $('ghHit').classList.add('cpa-hidden'); ghHighlight(null); }
    ghRenderList(text);
  }

  function onGhKey(ev) {
    if (ev.key === 'Escape') { ghCloseList(); return; }
    if (!ghTreffer.length) return;
    if (ev.key === 'ArrowDown') { ev.preventDefault(); ghMark((ghAktiv + 1) % ghTreffer.length); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); ghMark((ghAktiv + ghTreffer.length - 1) % ghTreffer.length); }
    else if (ev.key === 'Enter') { ev.preventDefault(); ghPick(ghTreffer[ghAktiv >= 0 ? ghAktiv : 0]); }
  }

  /** Klick auf einen Kreis in der Karte zeigt ihn wie einen Suchtreffer. */
  function onGhMapClick(ev) {
    var ags = ev.target && ev.target.getAttribute ? ev.target.getAttribute('data-k') : null;
    if (!ags || !ghLoad()) return;
    for (var i = 0; i < ghKreise.length; i++) {
      if (ghKreise[i].ags === ags) { ghCloseList(); ghShowHit({ name: ghKreise[i].name, kreis: i, istKreis: true }); return; }
    }
  }

  function onTabKey(ev) {
    if (!current || !current.sections) return;
    var ids = current.sections.map(function (x) { return x.id; });
    var i = ids.indexOf(activeTab);
    if (ev.key === 'ArrowRight') i = (i + 1) % ids.length;
    else if (ev.key === 'ArrowLeft') i = (i + ids.length - 1) % ids.length;
    else if (ev.key === 'Home') i = 0;
    else if (ev.key === 'End') i = ids.length - 1;
    else return;
    ev.preventDefault();
    selectTab(ids[i]);
    var el = document.getElementById('cpa-tab-' + ids[i]);
    if (el) el.focus();
  }

  function buildTabs() {
    var bar = $('tabs');
    clear(bar);
    var sections = current.sections;
    bar.classList.toggle('cpa-hidden', !sections);
    if (!sections) return;
    sections.forEach(function (sec) {
      bar.appendChild(h('button', {
        type: 'button', role: 'tab', class: 'cpa-tab', id: 'cpa-tab-' + sec.id,
        'data-tab': sec.id, 'aria-selected': 'false', tabindex: '-1', title: sec.title, text: sec.tab,
        onclick: function () { selectTab(sec.id); },
        onkeydown: onTabKey,
      }));
    });
  }

  function renderResult(data, period) {
    var sections = Array.isArray(data.sections) && data.sections.length ? data.sections.concat(STATIC_TABS) : null;
    current = { data: data, period: period, sections: sections };
    $('result').classList.remove('cpa-hidden');

    var sum = data.summary || {};
    var n = sum.nutzer || {};
    $('resultInfo').textContent =
      fmtDay(period.von) + ' – ' + fmtDay(period.bis) + ' · ' +
      (period.nurZeitraum ? 'Auswertungen nur mit Messungen aus dem Zeitraum' : 'Auswertungen mit allen Messungen') +
      (n.gesamt !== undefined ? ' · ' + n.gesamt + ' Nutzer, ' + n.aktiv + ' aktiv, ' + n.neu + ' neu' : '');

    buildTabs();
    if (sections) {
      // gewählten Tab beibehalten, wenn der Zeitraum gewechselt wird
      selectTab(findSection(activeTab) ? activeTab : sections[0].id);
    } else {
      activeTab = null;
      showPanel(null);
      showDoc(data.html);
      renderDownloads(null);
    }
  }

  function onRun() {
    if (running || !client || !alive()) return;
    var period = readPeriod();
    if (!period) return;
    setBusy(true);
    invoke({ von: period.von, bis: period.bis, nurZeitraum: period.nurZeitraum, dry: true, full: true })
      .then(function (data) {
        if (!alive()) return;
        if (!data.ok) throw new Error('Keine Daten erhalten.');
        renderResult(data, period);
      })
      .catch(function (e) {
        return errorText(e).then(function (m) { flash('Auswertung nicht möglich: ' + m, true); });
      })
      .then(function () { if (alive()) setBusy(false); });
  }

  function onMail() {
    if (running || !client || !alive()) return;
    var period = readPeriod();
    if (!period) return;
    var ziel = me && me.email ? ' an ' + me.email : ' an deine Anmelde-Adresse';
    if (!window.confirm('Bericht für ' + fmtDay(period.von) + ' bis ' + fmtDay(period.bis) + ' jetzt per E-Mail' + ziel + ' senden?')) return;
    setBusy(true);
    invoke({ von: period.von, bis: period.bis, nurZeitraum: period.nurZeitraum })
      .then(function (data) {
        if (data.ok) flash('Bericht gesendet an ' + (data.sentTo || 'deine Anmelde-Adresse') + '.');
        else flash('Der Bericht wurde nicht gesendet.', true);
      })
      .catch(function (e) {
        return errorText(e).then(function (m) { flash('Bericht konnte nicht gesendet werden: ' + m, true); });
      })
      .then(function () { if (alive()) setBusy(false); });
  }

  function onPreset(ev) {
    var preset = ev.currentTarget.getAttribute('data-preset');
    var p = periodFor(preset);
    if (!p) return;
    $('von').value = p.von;
    $('bis').value = p.bis;
    markPreset(preset);
    onRun();
  }

  function onManualDate() { markPreset(''); }

  /* ── Anmeldung ────────────────────────────────────────────────────────── */

  function checkAccess() {
    return client.rpc('is_report_admin').then(function (res) {
      return !res.error && res.data === true;
    });
  }

  function openMain() {
    var today = iso(new Date());
    $('von').max = today;
    $('bis').max = today;
    $('von').min = START_DATE;
    $('bis').min = START_DATE;
    showView('viewMain');
    if (!$('von').value) {
      var p = periodFor(DEFAULT_PRESET);
      $('von').value = p.von;
      $('bis').value = p.bis;
      markPreset(DEFAULT_PRESET);
      onRun();   // beim Öffnen gleich die letzten 7 Tage zeigen
    }
  }

  function onLogin(ev) {
    ev.preventDefault();
    var email = $('email').value.trim();
    var password = $('password').value;
    if (!email || !password) { showLogin('Bitte E-Mail und Passwort eingeben.'); return; }
    $('loginButton').disabled = true;
    client.auth.signInWithPassword({ email: email, password: password }).then(function (res) {
      if (res.error || !res.data || !res.data.session) {
        $('password').value = '';
        showLogin('E-Mail oder Passwort falsch.');
        return null;
      }
      return checkAccess().then(function (ok) {
        $('password').value = '';
        if (!ok) {
          return client.auth.signOut().then(function () { showLogin('Dieses Konto hat keinen Zugang zur Auswertung.'); });
        }
        setSession(res.data.session);
        openMain();
        return null;
      });
    }).catch(function () {
      showLogin('Anmeldung nicht möglich. Bitte Verbindung prüfen.');
    });
  }

  function onLogout() {
    client.auth.signOut().then(function () {
      me = null;
      $('result').classList.add('cpa-hidden');
      current = null;
      activeTab = null;
      $('von').value = '';
      $('bis').value = '';
      showLogin();
    });
  }

  /* ── Start ────────────────────────────────────────────────────────────── */

  function mount() {
    if (cleanup) { cleanup(); cleanup = null; }
    if (!alive()) return;
    applyPageMeta();
    client = getClient();
    me = null;
    running = false;

    $('loginForm').addEventListener('submit', onLogin);
    $('btnLogout').addEventListener('click', onLogout);
    $('btnSupport').addEventListener('click', goToSupport);
    $('btnToSupport').addEventListener('click', goToSupport);
    $('btnRun').addEventListener('click', onRun);
    $('btnMail').addEventListener('click', onMail);
    $('von').addEventListener('change', onManualDate);
    $('bis').addEventListener('change', onManualDate);
    var presets = document.querySelectorAll('#cpa-presets .cpa-preset');
    for (var i = 0; i < presets.length; i++) presets[i].addEventListener('click', onPreset);
    // Orts- und PLZ-Suche der GH-Karte (die Seite wird bei jedem Öffnen neu eingefügt: Daten neu lesen)
    ghKreise = null;
    ghOrte = null;
    ghPlz = null;
    if ($('ghSearch')) {
      $('ghSearch').addEventListener('input', onGhInput);
      $('ghSearch').addEventListener('focus', onGhInput);
      $('ghSearch').addEventListener('keydown', onGhKey);
      $('ghSearch').addEventListener('blur', ghCloseList);
      var ghMap = document.querySelector('#cpa-ghkarte .cpa-gh-kreise');
      if (ghMap) ghMap.addEventListener('click', onGhMapClick);
    }

    var sub = client.auth.onAuthStateChange(function (event) {
      if (!alive()) return;
      if (event === 'SIGNED_OUT' && $('viewLogin').classList.contains('cpa-hidden')) showLogin();
    });
    cleanup = function () {
      if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
      var subscription = sub && sub.data && sub.data.subscription;
      if (subscription && subscription.unsubscribe) subscription.unsubscribe();
    };

    showMessage('Lade …');
    client.auth.getSession().then(function (res) {
      if (!alive()) return null;
      var session = res.data && res.data.session;
      if (!session) { showLogin(); return null; }
      return checkAccess().then(function (ok) {
        if (!alive()) return null;
        setSession(session);
        if (!ok) {
          // Angemeldet (z. B. über die Support-Seite), aber ohne Berechtigung: nicht abmelden.
          showMessage('Kein Zugang zur Auswertung',
            'Dieses Konto darf die Auswertung nicht sehen. Wende dich an die Verwaltung, wenn du den Zugang brauchst.', true);
          return null;
        }
        openMain();
        return null;
      });
    }).catch(function () {
      if (alive()) showLogin('Verbindung nicht möglich. Bitte später erneut versuchen.');
    });
  }

  // version muss zum ?v= in auswertung.html passen: Der Loader lädt das Skript neu, wenn im Tab noch eine ältere Fassung läuft.
  window.CPAuswertung = { version: 7, mount: mount, _periodFor: periodFor };
})();