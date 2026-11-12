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

  var B = window.CPBasis;
  var SUPABASE_URL = B.SUPABASE_URL;
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

  function alive() { return !!document.getElementById('cpa-root'); }
  function $(id) { return document.getElementById('cpa-' + id); }

  /* ── Gemeinsame Grundlage (support/basis.js): DOM-Helfer ohne innerHTML ── */

  var h = B.h;
  var clear = B.clear;
  var getClient = B.getClient;
  var meta = B.pageMeta('cpa-root', PAGE_TITLE, 'cpa-page');
  function applyPageMeta() { meta.apply(); }

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
    if (sec.panel === 'ghkarte') ghEnsure();
    if (!sec.panel) showDoc(sec.html);
    renderDownloads(sec.files || []);
  }

  /* ── GH-Karte: Orts- und PLZ-Suche ──────────────────────────────────────────────── */

  // Die Karte (rund 390 KB) steht in auswertung/gh-karte.html und wird erst geladen, wenn
  // ihr Tab geöffnet wird; der Browser hält sie danach im Cache.
  var GH_URL = 'auswertung/gh-karte.html?v=1';
  var ghHtml = null;       // geladener Inhalt (bleibt über Seitenwechsel erhalten)
  var ghReady = null;      // Promise: Karte in dieser Einblendung eingesetzt

  /** Setzt die Karte ein (lädt sie beim ersten Mal) und verdrahtet Suche und Klicks. */
  function ghEnsure() {
    if (ghReady) return ghReady;
    var load = ghHtml ? Promise.resolve(ghHtml) : fetch(GH_URL).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    });
    ghReady = load.then(function (text) {
      ghHtml = text;
      var slot = $('ghkarte');
      if (!alive() || !slot) return;
      // Eigener, statischer Inhalt vom selben Server (keine Nutzerdaten): innerHTML ist hier unbedenklich.
      var tpl = document.createElement('template');
      tpl.innerHTML = text;
      var neu = tpl.content.querySelector('#cpa-ghkarte');
      if (!neu) throw new Error('Inhalt fehlt');
      neu.classList.toggle('cpa-hidden', slot.classList.contains('cpa-hidden'));
      slot.parentNode.replaceChild(neu, slot);
      var orte = tpl.content.querySelector('#cpa-ghOrte');
      if (orte && !$('ghOrte')) neu.appendChild(orte);
      $('ghSearch').addEventListener('input', onGhInput);
      $('ghSearch').addEventListener('focus', onGhInput);
      $('ghSearch').addEventListener('keydown', onGhKey);
      $('ghSearch').addEventListener('blur', ghCloseList);
      var ghMap = document.querySelector('#cpa-ghkarte .cpa-gh-kreise');
      if (ghMap) ghMap.addEventListener('click', onGhMapClick);
    }).catch(function () {
      ghReady = null;
      var slot = $('ghkarte');
      if (slot) { clear(slot); slot.appendChild(h('p', { class: 'cpa-muted', text: 'Die Karte konnte nicht geladen werden. Bitte den Tab erneut öffnen.' })); }
    });
    return ghReady;
  }

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
    savePrefs(preset);
    onRun();
  }

  function onManualDate() { markPreset(''); savePrefs(''); }

  /* Zuletzt gewählter Zeitraum (Schnellauswahl) und Häkchen bleiben auf diesem Gerät
   * gespeichert. Eigene Datumsangaben nicht: Sie wären beim nächsten Besuch veraltet. */
  var PREFS_KEY = 'cp-auswertung';

  function loadPrefs() {
    try { return JSON.parse(window.localStorage.getItem(PREFS_KEY)) || {}; } catch (e) { return {}; }
  }

  function savePrefs(preset) {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({ preset: preset, nur: $('nur').checked }));
    } catch (e) { /* Speicher gesperrt: Standard beim nächsten Mal */ }
  }

  function currentPreset() {
    var on = document.querySelector('#cpa-presets .cpa-preset[aria-pressed="true"]');
    return on ? on.getAttribute('data-preset') : '';
  }

  /** Häkchen geändert: speichern und, wenn schon ein Ergebnis da ist, neu auswerten. */
  function onNurChange() {
    savePrefs(currentPreset());
    if (current) onRun();
  }

  /** Enter in einem Datumsfeld wertet aus. */
  function onDateKey(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); onRun(); }
  }

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
      // Beim Öffnen gleich auswerten: mit der zuletzt gewählten Schnellauswahl, sonst 7 Tage.
      var prefs = loadPrefs();
      var preset = prefs.preset && periodFor(prefs.preset) ? prefs.preset : DEFAULT_PRESET;
      var p = periodFor(preset);
      $('von').value = p.von;
      $('bis').value = p.bis;
      $('nur').checked = prefs.nur === true;
      markPreset(preset);
      onRun();
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
    $('von').addEventListener('keydown', onDateKey);
    $('bis').addEventListener('keydown', onDateKey);
    $('nur').addEventListener('change', onNurChange);
    var presets = document.querySelectorAll('#cpa-presets .cpa-preset');
    for (var i = 0; i < presets.length; i++) presets[i].addEventListener('click', onPreset);
    // GH-Karte: die Seite wird bei jedem Öffnen neu eingefügt, die Karte also neu eingesetzt.
    ghKreise = null;
    ghOrte = null;
    ghPlz = null;
    ghReady = null;

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
  window.CPAuswertung = { version: 8, mount: mount, _periodFor: periodFor };
})();