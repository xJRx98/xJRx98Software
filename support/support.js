/* C&P Aquaplants - Support-Seite (Unterseite von xjrx98software.de)
 *
 * Zeigt die Daten, die die App bei einer WhatsApp-Support-Anfrage als
 * "Snapshot" in `public.support_snapshots` ablegt (siehe
 * supabase/schema_support_snapshots.sql und CLOUD_SETUP.md Abschnitt 162).
 *
 * EINBINDUNG: Die Seite wird wie `reset-password` vom Router in index.html als
 * Fragment (`pages/support.html`) per innerHTML geladen. Der Router blendet sie
 * bei jedem Besuch NEU ein - darum gibt es `CPSupport.mount()`, das mehrfach
 * aufgerufen werden darf (alte Listener werden vorher entfernt). Link-Format:
 * `https://xjrx98software.de/#support/<Snapshot-ID>`.
 *
 * SICHERHEIT: Die Snapshot-Daten stammen von Kundinnen und Kunden und sind
 * nicht vertrauenswürdig. Darum wird NIE innerHTML verwendet - alles läuft
 * über textContent/createTextNode (siehe `h()`).
 */
(function () {
  'use strict';

  var SUPABASE_URL = 'https://eznesbcyjduxqhkpcyny.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_JfIZ0nyrSoGcC19Yw_L-Yw_gpMtHn9Y';
  var ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  var client = null;

  /** sessionStorage, falls verfügbar - sonst ein Speicher im Arbeitsspeicher.
   *  Manche Browser/Modi sperren sessionStorage (der bloße Zugriff wirft dann
   *  eine Ausnahme); die Seite soll deshalb nicht komplett ausfallen. Folge:
   *  Die Anmeldung gilt dann nur bis zum Neuladen der Seite. */
  function safeStorage() {
    try {
      var s = window.sessionStorage;
      s.setItem('__cps_test', '1');
      s.removeItem('__cps_test');
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

  /** Ein Client pro Seitenaufruf (nicht pro Einblendung). sessionStorage statt
   *  localStorage: Wird der Tab geschlossen, ist man abgemeldet. Eigener
   *  storageKey, damit er sich nicht mit einem Client der Passwort-Reset-Seite
   *  ins Gehege kommt. */
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

  var cleanup = null; // entfernt die globalen Listener der vorherigen Einblendung

  /** Läuft das Fragment noch? (Der Router kann die Seite jederzeit austauschen,
   *  während noch eine Netzwerkantwort unterwegs ist.) */
  function alive() { return !!document.getElementById('cps-root'); }

  function $(id) { return document.getElementById('cps-' + id); }

  /* ── DOM-Helfer (kein innerHTML!) ─────────────────────────────────────── */

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

  /* ── Ansichten ────────────────────────────────────────────────────────── */

  var VIEWS = ['viewMessage', 'viewLogin', 'viewList', 'viewDetail'];

  function showView(id) {
    if (!alive()) return;
    VIEWS.forEach(function (v) { $(v).classList.toggle('cps-hidden', v !== id); });
  }

  function showMessage(title, text) {
    if (!alive()) return;
    $('messageTitle').textContent = title;
    $('messageText').textContent = text || '';
    showView('viewMessage');
  }

  function showLogin(errorText) {
    if (!alive()) return;
    $('session').classList.add('cps-hidden');
    var err = $('loginError');
    err.textContent = errorText || '';
    err.classList.toggle('cps-hidden', !errorText);
    $('loginButton').disabled = false;
    showView('viewLogin');
    $('email').focus();
  }

  function setSession(session) {
    $('sessionMail').textContent = session && session.user && session.user.email ? session.user.email : '';
    $('session').classList.remove('cps-hidden');
  }

  /* ── Anmeldung ────────────────────────────────────────────────────────── */

  function checkAdmin() {
    return client.rpc('is_support_admin').then(function (res) {
      return !res.error && res.data === true;
    });
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
      return checkAdmin().then(function (ok) {
        if (!ok) {
          return client.auth.signOut().then(function () {
            $('password').value = '';
            showLogin('Dieses Konto hat keinen Support-Zugang.');
          });
        }
        $('password').value = '';
        setSession(res.data.session);
        route();
        return null;
      });
    }).catch(function () {
      showLogin('Anmeldung nicht möglich. Bitte Verbindung prüfen.');
    });
  }

  function onLogout() {
    client.auth.signOut().then(function () {
      current = null;
      history.replaceState({ page: 'support' }, '', '#support');
      showLogin();
    });
  }

  /* ── Routing ──────────────────────────────────────────────────────────── */

  var current = null; // { row, payload }
  var activeTab = 'aquarium';

  /** Die Snapshot-ID aus `#support/<ID>` (leer = Übersicht). */
  function currentId() {
    var parts = location.hash.replace(/^#/, '').split('/');
    return parts[0] === 'support' ? (parts[1] || '') : '';
  }

  /** Wechselt Ansicht per history.pushState - NICHT per `location.hash`: Das würde
   *  den popstate-Handler des Routers auslösen (State = null -> Startseite). */
  function navigate(id) {
    history.pushState({ page: 'support' }, '', '#support' + (id ? '/' + id : ''));
    route();
  }

  function route() {
    if (!alive()) return;
    var id = currentId();
    if (!id) { loadList(); return; }
    if (!ID_RE.test(id)) {
      showMessage('Ungültiger Link', 'Dieser Link ist nicht vollständig. Bitte den Link aus der WhatsApp-Nachricht erneut öffnen.');
      return;
    }
    loadDetail(id);
  }

  function loadList() {
    showMessage('Lade …');
    client.from('support_snapshots')
      .select('id,aquarium_name,created_at,expires_at,app_version')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(function (res) {
        if (res.error) { showMessage('Fehler', 'Die Übersicht konnte nicht geladen werden.'); return; }
        var body = $('listTable').querySelector('tbody');
        clear(body);
        var rows = res.data || [];
        $('listEmpty').classList.toggle('cps-hidden', rows.length > 0);
        rows.forEach(function (r) {
          body.appendChild(h('tr', null,
            h('td', { text: r.aquarium_name || '(ohne Namen)' }),
            h('td', { text: fmtDateTime(r.created_at) }),
            h('td', { text: fmtDateTime(r.expires_at) }),
            h('td', { text: r.app_version || '' }),
            h('td', null, h('button', {
              type: 'button', class: 'cps-link', text: 'Öffnen',
              onclick: function () { navigate(r.id); },
            }))
          ));
        });
        showView('viewList');
      })
      .catch(function () { showMessage('Fehler', 'Die Übersicht konnte nicht geladen werden.'); });
  }

  function loadDetail(id) {
    showMessage('Lade …');
    client.from('support_snapshots').select('*').eq('id', id).maybeSingle().then(function (res) {
      if (res.error) { showMessage('Fehler', 'Die Daten konnten nicht geladen werden.'); return; }
      if (!res.data) {
        showMessage('Nicht gefunden', 'Diesen Eintrag gibt es nicht (mehr). Daten-Links werden nach 7 Tagen automatisch gelöscht.');
        return;
      }
      current = { row: res.data, payload: res.data.payload || {} };
      activeTab = 'aquarium';
      renderDetailHead();
      selectTab('aquarium');
      showView('viewDetail');
      window.scrollTo(0, 0);
    }).catch(function () { showMessage('Fehler', 'Die Daten konnten nicht geladen werden.'); });
  }

  /* ── Detail-Kopf & Tabs ───────────────────────────────────────────────── */

  function renderDetailHead() {
    var row = current.row;
    var p = current.payload;
    var app = p.app || {};
    var name = row.aquarium_name || (p.aquarium && p.aquarium.name) || '(ohne Namen)';
    $('detailTitle').textContent = name;

    var expired = row.expires_at && new Date(row.expires_at) < new Date();
    var parts = [
      'Erstellt ' + fmtDateTime(row.created_at),
      'gültig bis ' + fmtDateTime(row.expires_at) + (expired ? ' (abgelaufen)' : ''),
    ];
    if (app.version) parts.push('App ' + app.version);
    if (app.platform) parts.push(app.platform);
    parts.push(app.account === false ? 'ohne Konto' : 'mit Konto');
    $('detailMeta').textContent = parts.join('  ·  ');
  }

  var RENDERERS = {
    aquarium: renderAquarium,
    messwerte: renderMesswerte,
    duengung: renderDuengung,
    einstellungen: renderEinstellungen,
  };

  function selectTab(id) {
    activeTab = id;
    var tabs = document.querySelectorAll('#cps-tabs .cps-tab');
    for (var i = 0; i < tabs.length; i++) {
      var on = tabs[i].getAttribute('data-tab') === id;
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      tabs[i].setAttribute('tabindex', on ? '0' : '-1');
    }
    var panel = $('panel');
    panel.setAttribute('aria-labelledby', 'cps-tab-' + id);
    clear(panel);
    try {
      panel.appendChild(RENDERERS[id](current.payload));
    } catch (e) {
      panel.appendChild(h('p', { class: 'cps-error', text: 'Dieser Bereich konnte nicht dargestellt werden.' }));
    }
  }

  function onTabKey(ev) {
    var order = ['aquarium', 'messwerte', 'duengung', 'einstellungen'];
    var i = order.indexOf(activeTab);
    if (ev.key === 'ArrowRight') i = (i + 1) % order.length;
    else if (ev.key === 'ArrowLeft') i = (i + order.length - 1) % order.length;
    else return;
    ev.preventDefault();
    selectTab(order[i]);
    $('tab-' + order[i]).focus();
  }

  /* ── Fotos ────────────────────────────────────────────────────────────── */

  /** Nur Adressen des EIGENEN Supabase-Projekts werden geladen: die Adresse
   *  stammt aus den Kundendaten (nicht vertrauenswürdig) und würde sonst
   *  beliebige Fremdserver im Browser des Support-Teams aufrufen (IP-Leak,
   *  Tracking-Pixel). Erlaubt sind die Kurz-Links der Edge Function `img` und
   *  signierte Storage-Links. */
  function safePhotoUrl(u) {
    try {
      var x = new URL(String(u));
      if (x.protocol !== 'https:') return null;
      if (x.host !== new URL(SUPABASE_URL).host) return null;
      if (x.pathname.indexOf('/functions/v1/img/') !== 0 &&
          x.pathname.indexOf('/storage/v1/object/sign/') !== 0) return null;
      return x.href;
    } catch (e) { return null; }
  }

  function photoFigure(label, url) {
    var fig = h('figure', { class: 'cps-photo' });
    var safe = safePhotoUrl(url);
    if (!safe) {
      fig.appendChild(h('div', { class: 'cps-photo-missing', text: 'Bild nicht angezeigt (ungültige Adresse).' }));
    } else {
      var img = h('img', { src: safe, alt: label, loading: 'lazy', referrerpolicy: 'no-referrer' });
      var link = h('a', { href: safe, target: '_blank', rel: 'noopener noreferrer' }, img);
      img.addEventListener('error', function () {
        if (!link.parentNode) return;
        link.parentNode.replaceChild(h('div', { class: 'cps-photo-missing',
          text: 'Bild nicht (mehr) verfügbar – der Link ist abgelaufen oder das Bild wurde gelöscht.' }), link);
      });
      fig.appendChild(link);
    }
    fig.appendChild(h('figcaption', { text: label }));
    return fig;
  }

  function renderPhotos(f) {
    f = f || {};
    var items = [['Aquarium', f.aquarium], ['Lampe / Einstellungen', f.lampe]]
      .filter(function (x) { return !isEmpty(x[1]); });
    if (!items.length) return h('p', { class: 'cps-muted', text: 'Es wurden keine Fotos mitgesendet.' });
    return h('div', { class: 'cps-photos' }, items.map(function (x) { return photoFigure(x[0], x[1]); }));
  }

  /* ── Tab 1: Aquarium ──────────────────────────────────────────────────── */

  function renderAquarium(p) {
    var a = p.aquarium || {};
    var grid = h('div', { class: 'cps-grid' });

    // Fotos zuerst: genau die Bilder, die die Person per WhatsApp-Link mitgesendet hat.
    grid.appendChild(section('Fotos', renderPhotos(p.fotos), true));

    var allgemein = [['Name', show(a.name)], ['Netto-Volumen', num(a.nettovolumen, 'L')]];
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

  function listOrEmpty(items, renderItem) {
    if (!items.length) return h('p', { class: 'cps-muted', text: 'Keine Einträge.' });
    return h('ul', { class: 'cps-list' }, items.map(renderItem));
  }

  /* ── Tab 2: Messwerte ─────────────────────────────────────────────────── */

  var PARAM_ORDER = ['Nitrat', 'Phosphat', 'Kalium', 'Magnesium', 'Eisen_sensitiv', 'Calcium',
    'pH_45_565', 'pH_566_8', 'KH', 'GH', 'Silikat', 'Nitrit'];
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

    return h('div', null,
      h('div', { class: 'cps-table-wrap' }, h('table', { class: 'cps-table' }, h('thead', null, head), body)),
      h('p', { class: 'cps-note', text: reihen.length + ' Messreihe' + (reihen.length === 1 ? '' : 'n') + ', neueste links.' }));
  }

  function isTooHighLow(v) { return /^zu\s/i.test(String(v).trim()); }

  function valueCell(v) {
    if (isEmpty(v) || String(v).trim() === '-') return dash();
    if (isTooHighLow(v)) return h('span', { class: 'cps-pill cps-warn', text: String(v) });
    return String(v);
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
      var ziel = d.zielwerte ? d.zielwerte[k] : null;
      nb.appendChild(h('tr', null,
        h('td', { text: k }),
        h('td', null, ist ? valueCell(ist.value) : dash()),
        h('td', { text: ist ? fmtDate(ist.zeit) : '' }),
        h('td', null, num(ziel))));
    });
    // Volle Breite + umbrechende Überschriften (cps-table-fit): Ist, Messdatum und
    // Ziel sollen ohne seitliches Scrollen sichtbar sein.
    grid.appendChild(section('Nährstoffe: Ist / Ziel (mg/l)', h('div', { class: 'cps-table-wrap' },
      h('table', { class: 'cps-table cps-table-fit' },
        h('thead', null, h('tr', null,
          h('th', { text: 'Nährstoff' }), h('th', { text: 'Ist (letzte Messung)' }),
          h('th', { text: 'Messdatum' }), h('th', { text: 'Ziel' }))),
        nb)), true));

    var taeglich = Array.isArray(d.taegliche_duengung) ? d.taegliche_duengung : [];
    grid.appendChild(section('Tägliche Düngung', listOrEmpty(taeglich, function (x) {
      x = x || {};
      return h('li', null, h('span', { text: x.name || '–' }), h('span', null, num(x.value, 'ml')));
    })));

    grid.appendChild(section('Düngekapseln', kv([
      ['Letzte Gabe', isEmpty(d.duengekapseln_datum) ? dash() : String(d.duengekapseln_datum)],
      // Das Intervall wird in der App in WOCHEN angegeben (Standard 10, empfohlen 6-10).
      ['Intervall', isEmpty(d.duengekapseln_intervall) ? dash() :
        (Number(d.duengekapseln_intervall) === 1 ? 'jede Woche' : 'alle ' + d.duengekapseln_intervall + ' Wochen')],
    ])));

    grid.appendChild(section('Salzrechner', kv([
      ['Salzart', show(d.salzart)],
      ['Menge', isEmpty(d.salzmenge) ? dash() : num(d.salzmenge, d.salzeinheit || 'L')],
    ])));

    return grid;
  }

  /* ── Tab 4: Einstellungen ─────────────────────────────────────────────── */

  var SETTING_LABEL = {
    nitrat: 'Nitrat', phosphat: 'Phosphat', kalium: 'Kalium', magnesium: 'Magnesium',
    eisen_sensitiv: 'Eisen sensitiv', calcium: 'Calcium', kh: 'KH', gh: 'GH',
    silikat: 'Silikat', nitrit: 'Nitrit', ph: 'pH',
    ph_45_565: 'pH 4,5 – 5,65', ph_566_8: 'pH 5,66 – 8',
  };

  function renderEinstellungen(p) {
    var e = p.einstellungen || {};
    var app = p.app || {};
    var row = current.row;
    var grid = h('div', { class: 'cps-grid' });

    grid.appendChild(section('Allgemein', kv([
      ['Sprache der App', e.appLanguage === 'de' ? 'Deutsch' : e.appLanguage === 'en' ? 'English' : show(e.appLanguage)],
      ['Fotometer verwenden', yn(e.useFotometer)],
      ['Fotometertyp', show(e.fotometertyp)],
      ['Fotometer', show(e.fotometer)],
      ['Fotometerserie', show(e.fotometerserie)],
      ['Faktor F', num(e.faktor_f)],
    ])));

    // Faktoren & Serien: alle Schlüssel faktor_<x> / serie_<x> einsammeln
    var names = {};
    Object.keys(e).forEach(function (k) {
      var m = /^(faktor|serie)_(.+)$/.exec(k);
      if (m && !(m[1] === 'faktor' && m[2] === 'f')) names[m[2]] = true;
    });
    var order = Object.keys(SETTING_LABEL);
    var keys = order.filter(function (k) { return names[k]; });
    Object.keys(names).filter(function (k) { return order.indexOf(k) < 0; }).sort()
      .forEach(function (k) { keys.push(k); });

    var tb = h('tbody');
    keys.forEach(function (k) {
      tb.appendChild(h('tr', null,
        h('td', { text: SETTING_LABEL[k] || k }),
        h('td', null, num(e['faktor_' + k])),
        h('td', null, show(e['serie_' + k]))));
    });
    grid.appendChild(section('Faktoren & Serien', keys.length
      ? h('div', { class: 'cps-table-wrap' }, h('table', { class: 'cps-table' },
        h('thead', null, h('tr', null, h('th', { text: 'Parameter' }), h('th', { text: 'Faktor' }), h('th', { text: 'Serie' }))), tb))
      : h('p', { class: 'cps-muted', text: 'Keine Angaben.' })));

    grid.appendChild(section('App & Gerät', kv([
      ['App-Version', show(app.version)],
      ['Plattform', show(app.platform)],
      ['Konto', app.account === false ? 'Ohne Konto (anonym)' : 'Mit Konto'],
      ['Sprache (Gerät)', show(app.language)],
      ['Absender-ID', show(row.created_by)],
      ['Snapshot-ID', show(row.id)],
    ])));

    return grid;
  }

  /* ── Start ────────────────────────────────────────────────────────────── */

  function onHashChange() {
    if (!alive() || !client) return;
    client.auth.getSession().then(function (res) {
      if (res.data && res.data.session) route();
    });
  }

  /** Verdrahtet die frisch eingeblendete Seite. Darf mehrfach aufgerufen werden. */
  function mount() {
    if (cleanup) { cleanup(); cleanup = null; }
    if (!alive()) return;
    client = getClient();
    current = null;

    $('loginForm').addEventListener('submit', onLogin);
    $('btnLogout').addEventListener('click', onLogout);
    $('btnList').addEventListener('click', function () { navigate(''); });
    var tabs = document.querySelectorAll('#cps-tabs .cps-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function (ev) {
        selectTab(ev.currentTarget.getAttribute('data-tab'));
      });
      tabs[i].addEventListener('keydown', onTabKey);
    }

    window.addEventListener('hashchange', onHashChange);
    var sub = client.auth.onAuthStateChange(function (event) {
      if (!alive()) return;
      // Nur umschalten, wenn die Anmeldeseite nicht schon (ggf. mit Hinweis) steht.
      if (event === 'SIGNED_OUT') {
        current = null;
        if ($('viewLogin').classList.contains('cps-hidden')) showLogin();
      }
    });
    cleanup = function () {
      window.removeEventListener('hashchange', onHashChange);
      var subscription = sub && sub.data && sub.data.subscription;
      if (subscription && subscription.unsubscribe) subscription.unsubscribe();
    };

    showMessage('Lade …');
    client.auth.getSession().then(function (res) {
      if (!alive()) return null;
      var session = res.data && res.data.session;
      if (!session) { showLogin(); return null; }
      return checkAdmin().then(function (ok) {
        if (!alive()) return null;
        if (!ok) {
          return client.auth.signOut().then(function () {
            showLogin('Dieses Konto hat keinen Support-Zugang.');
          });
        }
        setSession(session);
        route();
        return null;
      });
    }).catch(function () {
      if (alive()) showLogin('Verbindung nicht möglich. Bitte später erneut versuchen.');
    });
  }

  window.CPSupport = { mount: mount };
})();
