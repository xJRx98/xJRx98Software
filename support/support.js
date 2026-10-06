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
 * FÄLLE: Jeder Snapshot ist ein Fall mit Status (ausstehend / in Bearbeitung /
 * abgeschlossen) und kann einer Support-Person zugeordnet werden (siehe
 * supabase/schema_support_cases.sql und CLOUD_SETUP.md Abschnitt 171). Die
 * Übersicht zeigt, wer welchen Fall bearbeitet, und lädt automatisch neu.
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

  // ── Tab-Titel, Icon und Navigation der Webseite ──────────────────────────
  // Solange die Support-Seite angezeigt wird, steht im Browser-Tab "Support"
  // mit dem C&P-Aquaplants-Icon, und die Navigationsleiste der Webseite ist
  // ausgeblendet (CSS in pages/support.html, Klasse `cps-support-page` auf <body>).
  // Verlässt man die Seite (der Router tauscht den Inhalt aus), wird alles
  // wiederhergestellt - siehe `restorePageMeta`.
  var PAGE_TITLE = 'Support';
  // Das Icon (rundes C&P-App-Icon, 64x64) steckt direkt im Skript: Es braucht keine
  // zusätzliche Datei auf dem Server und kann nicht an einem falschen Pfad (404)
  // scheitern - dann würde der Browser nur das generische Weltkugel-Symbol zeigen.
  var FAVICON_URL = 'data:image/png;base64,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';
  var savedMeta = null;     // Titel/Icon der Webseite, solange die Support-Seite aktiv ist
  var metaObserver = null;

  // ── Fall-Verwaltung ──────────────────────────────────────────────────────
  var STATUS_LABEL = { ausstehend: 'Ausstehend', in_bearbeitung: 'In Bearbeitung', abgeschlossen: 'Abgeschlossen' };
  var CASE_COLS = 'id,aquarium_name,created_at,expires_at,app_version,status,assigned_to,assigned_at,closed_at,closed_by';
  var CASE_RET = 'id,expires_at,status,assigned_to,assigned_at,closed_at,closed_by';
  var POLL_MS = 30000;   // Übersicht lädt so oft automatisch neu
  var me = null;         // { id, email } der angemeldeten Person
  var team = {};         // user_id -> Anzeigename ('' = noch keiner festgelegt)
  var listCases = [];    // zuletzt geladene Fälle (ohne Nutzlast)
  var listTab = 'ausstehend';
  var onlyMine = false;
  var listUpdated = null;
  var pollTimer = null;
  var flashTimer = null;

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

  /* ── Ansichten ────────────────────────────────────────────────────────── */

  var VIEWS = ['viewMessage', 'viewLogin', 'viewList', 'viewDetail'];

  function showView(id) {
    if (!alive()) return;
    if (id !== 'viewList') stopPoll();
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
    $('flash').classList.add('cps-hidden');
    var err = $('loginError');
    err.textContent = errorText || '';
    err.classList.toggle('cps-hidden', !errorText);
    $('loginButton').disabled = false;
    showView('viewLogin');
    $('email').focus();
  }

  function setSession(session) {
    var u = session && session.user ? session.user : null;
    me = u ? { id: u.id, email: u.email || '' } : null;
    $('sessionMail').textContent = u && u.email ? u.email : '';
    $('session').classList.remove('cps-hidden');
    updateNameButton();
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
    stopPoll();
    client.auth.signOut().then(function () {
      current = null;
      me = null;
      team = {};
      listCases = [];
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

  /** Meldet einen Datenbankfehler; fehlt die Migration, kommt ein klarer Hinweis. */
  function dbError(error, fallback) {
    var msg = (error && error.message) || '';
    if (error && (String(error.code) === '42703' || /column .*(status|assigned_to)/i.test(msg))) {
      showMessage('Datenbank-Update fehlt', 'Bitte supabase/schema_support_cases.sql im Supabase SQL-Editor ausführen.');
    } else {
      showMessage('Fehler', fallback);
    }
  }

  /** Kurze Rückmeldung zu einer Aktion (verschwindet nach 6 Sekunden). */
  function flash(text, isErr) {
    if (!alive()) return;
    var el = $('flash');
    el.textContent = text;
    el.classList.toggle('cps-flash-err', !!isErr);
    el.classList.remove('cps-hidden');
    if (flashTimer) clearTimeout(flashTimer);
    flashTimer = setTimeout(function () { if (alive()) $('flash').classList.add('cps-hidden'); }, 6000);
  }

  function statusOf(c) { return c && STATUS_LABEL[c.status] ? c.status : 'ausstehend'; }

  /* ── Team & Anzeigename ───────────────────────────────────────────────── */

  function loadTeam() {
    return client.from('support_admins').select('user_id,display_name').then(function (res) {
      if (res.error) return;
      team = {};
      (res.data || []).forEach(function (r) { if (r && r.user_id) team[r.user_id] = r.display_name || ''; });
      updateNameButton();
    });
  }

  function nameOf(id) {
    if (!id) return '–';
    if (team[id]) return team[id];
    if (me && id === me.id && me.email) return me.email;
    return 'Mitarbeiter ' + String(id).slice(0, 4);
  }

  function updateNameButton() {
    var b = $('btnName');
    if (!b) return;
    var mine = !!(me && team[me.id]);
    b.textContent = mine ? 'Mein Name' : 'Name festlegen';
    b.classList.toggle('cps-btn-accent', !mine);
  }

  function onSetName() {
    if (!me) return;
    var input = window.prompt('Name, der den Kolleginnen und Kollegen angezeigt wird (max. 40 Zeichen):', team[me.id] || '');
    if (input === null) return;
    var name = String(input).trim().slice(0, 40);
    if (!name) { flash('Der Name darf nicht leer sein.', true); return; }
    client.from('support_admins').update({ display_name: name }).eq('user_id', me.id).select('user_id').then(function (res) {
      if (res.error || !(res.data && res.data.length)) { flash('Der Name konnte nicht gespeichert werden.', true); return; }
      team[me.id] = name;
      updateNameButton();
      flash('Name gespeichert.');
      if (!$('viewList').classList.contains('cps-hidden')) renderList();
      else if (current) renderCaseBar();
    }).catch(function () { flash('Der Name konnte nicht gespeichert werden.', true); });
  }

  /* ── Übersicht: Ausstehend / In Bearbeitung / Abgeschlossen ───────────── */

  function startPoll() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      if (!alive()) { stopPoll(); return; }
      if ($('viewList').classList.contains('cps-hidden')) return;
      loadList(true);
    }, POLL_MS);
  }

  function stopPoll() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  /** `silent` = automatische Aktualisierung: keine "Lade …"-Anzeige, Fehler
   *  werden ignoriert, und die Ansicht wird nicht gewechselt. */
  function loadList(silent) {
    if (!silent) showMessage('Lade …');
    Promise.all([
      loadTeam(),
      client.from('support_snapshots').select(CASE_COLS)
        .order('created_at', { ascending: false })
        .limit(200),
    ]).then(function (r) {
      if (!alive()) return;
      var res = r[1];
      if (res.error) { if (!silent) dbError(res.error, 'Die Übersicht konnte nicht geladen werden.'); return; }
      if (silent && $('viewList').classList.contains('cps-hidden')) return;
      listCases = res.data || [];
      listUpdated = new Date();
      renderList();
      showView('viewList');
      startPoll();
    }).catch(function () {
      if (!silent) showMessage('Fehler', 'Die Übersicht konnte nicht geladen werden.');
    });
  }

  var LIST_COLUMNS = {
    ausstehend: ['Aquarium', 'Eingegangen', 'Gültig bis', 'App', ''],
    in_bearbeitung: ['Aquarium', 'Bearbeiter', 'Seit', 'Eingegangen', 'Gültig bis', ''],
    abgeschlossen: ['Aquarium', 'Bearbeiter', 'Abgeschlossen', 'Wird gelöscht am', ''],
  };

  var LIST_EMPTY = {
    ausstehend: 'Keine ausstehenden Fälle – alles zugeordnet.',
    in_bearbeitung: 'Zurzeit bearbeitet niemand einen Fall.',
    abgeschlossen: 'Keine abgeschlossenen Fälle.',
  };

  function renderList() {
    var groups = { ausstehend: [], in_bearbeitung: [], abgeschlossen: [] };
    listCases.forEach(function (c) { groups[statusOf(c)].push(c); });

    ['ausstehend', 'in_bearbeitung', 'abgeschlossen'].forEach(function (k) {
      var b = $('ltab-' + k);
      b.textContent = STATUS_LABEL[k] + ' (' + groups[k].length + ')';
      b.setAttribute('aria-selected', k === listTab ? 'true' : 'false');
    });
    renderTeamSummary(groups);

    var mineBtn = $('btnMine');
    mineBtn.classList.toggle('cps-hidden', listTab !== 'in_bearbeitung');
    mineBtn.textContent = onlyMine ? 'Alle Fälle zeigen' : 'Nur meine Fälle';

    var rows = groups[listTab].slice();
    if (listTab === 'in_bearbeitung' && onlyMine && me) {
      rows = rows.filter(function (c) { return c.assigned_to === me.id; });
    }
    if (listTab === 'ausstehend') {
      rows.sort(function (a, b) { return String(a.created_at).localeCompare(String(b.created_at)); }); // wartet am längsten zuerst
    } else if (listTab === 'in_bearbeitung') {
      rows.sort(function (a, b) {
        return nameOf(a.assigned_to).localeCompare(nameOf(b.assigned_to), 'de') ||
          String(a.created_at).localeCompare(String(b.created_at));
      });
    } else {
      rows.sort(function (a, b) { return String(b.closed_at || '').localeCompare(String(a.closed_at || '')); });
    }

    var head = $('listTable').querySelector('thead');
    var body = $('listTable').querySelector('tbody');
    clear(head);
    clear(body);
    head.appendChild(h('tr', null, LIST_COLUMNS[listTab].map(function (t) { return h('th', { text: t }); })));
    rows.forEach(function (c) { body.appendChild(caseRow(c)); });

    $('listEmpty').textContent = LIST_EMPTY[listTab];
    $('listEmpty').classList.toggle('cps-hidden', rows.length > 0);
    $('listUpdated').textContent = listUpdated
      ? 'Aktualisiert ' + listUpdated.toLocaleTimeString('de-DE') + ' · lädt automatisch alle ' + Math.round(POLL_MS / 1000) + ' Sekunden neu.'
      : '';
  }

  /** Wer bearbeitet gerade wie viele Fälle? (Übersicht für das ganze Team) */
  function renderTeamSummary(groups) {
    var box = $('team');
    clear(box);
    box.appendChild(h('span', { class: 'cps-chip' }, 'Ausstehend ', h('b', { text: groups.ausstehend.length })));
    var counts = {};
    groups.in_bearbeitung.forEach(function (c) { var k = c.assigned_to || ''; counts[k] = (counts[k] || 0) + 1; });
    var ids = Object.keys(counts).sort(function (a, b) { return nameOf(a).localeCompare(nameOf(b), 'de'); });
    if (!ids.length) {
      box.appendChild(h('span', { class: 'cps-muted', text: 'Niemand bearbeitet gerade einen Fall.' }));
      return;
    }
    box.appendChild(h('span', { class: 'cps-muted', text: 'In Bearbeitung:' }));
    ids.forEach(function (id) {
      box.appendChild(h('span', { class: me && id === me.id ? 'cps-chip cps-chip-me' : 'cps-chip' },
        nameOf(id) + ' ', h('b', { text: counts[id] })));
    });
  }

  function td(text) { return h('td', { text: text }); }

  /** Button, der während der Aktion gesperrt ist (kein Doppelklick). */
  function actionBtn(label, fn, accent) {
    return h('button', {
      type: 'button',
      class: accent ? 'cps-btn cps-btn-small cps-btn-accent' : 'cps-btn cps-btn-small',
      text: label,
      onclick: function (ev) {
        var b = ev.currentTarget;
        b.disabled = true;
        var enable = function () { b.disabled = false; };
        var r = fn();
        if (r && r.then) r.then(enable, enable); else enable();
      },
    });
  }

  function caseRow(c) {
    var st = statusOf(c);
    var nameCell = td(c.aquarium_name || '(ohne Namen)');
    var open = h('button', { type: 'button', class: 'cps-link', text: 'Öffnen', onclick: function () { navigate(c.id); } });
    var actions = h('div', { class: 'cps-actions' });
    var cells;
    var mine = me && c.assigned_to === me.id;

    if (st === 'ausstehend') {
      actions.appendChild(actionBtn('Übernehmen', function () { return claimCase(c.id); }, true));
      actions.appendChild(open);
      cells = [nameCell, td(fmtDateTime(c.created_at)), td(fmtDateTime(c.expires_at)), td(c.app_version || '')];
    } else if (st === 'in_bearbeitung') {
      actions.appendChild(open);
      actions.appendChild(actionBtn('Abschließen', function () { return closeCase(c.id); }));
      cells = [nameCell, td(nameOf(c.assigned_to) + (mine ? ' (ich)' : '')), td(fmtDateTime(c.assigned_at)),
        td(fmtDateTime(c.created_at)), td(fmtDateTime(c.expires_at))];
    } else {
      actions.appendChild(open);
      actions.appendChild(actionBtn('Wieder öffnen', function () { return reopenCase(c.id); }));
      cells = [nameCell, td(c.assigned_to ? nameOf(c.assigned_to) : '–'),
        td((c.closed_at ? fmtDateTime(c.closed_at) : '') + (c.closed_by ? ' · ' + nameOf(c.closed_by) : '')),
        td(fmtDateTime(c.expires_at))];
    }
    cells.push(h('td', null, actions));
    return h('tr', null, cells);
  }

  /* ── Aktionen auf einem Fall ──────────────────────────────────────────── */

  /** Ändert Status/Zuordnung; mit `onlyIfStatus` nur, wenn der Fall noch in diesem
   *  Status ist (Übernehmen: nur wenn noch ausstehend - so gewinnt bei zwei
   *  gleichzeitigen Klicks genau eine Person). Gibt die geänderten Zeilen zurück. */
  function updateCase(id, patch, onlyIfStatus) {
    var q = client.from('support_snapshots').update(patch).eq('id', id);
    if (onlyIfStatus) q = q.eq('status', onlyIfStatus);
    return q.select(CASE_RET).then(function (res) {
      if (res.error) throw res.error;
      return res.data || [];
    });
  }

  function afterCaseChange(id) {
    if (!alive()) return;
    if (!$('viewList').classList.contains('cps-hidden')) { loadList(true); return; }
    if (current && current.row.id === id) refreshCase(id);
  }

  function failed(e) {
    flash('Aktion nicht möglich' + (e && e.message ? ': ' + e.message : '.'), true);
  }

  function claimCase(id) {
    if (!me) return Promise.resolve();
    return updateCase(id, { assigned_to: me.id, status: 'in_bearbeitung' }, 'ausstehend').then(function (rows) {
      if (!rows.length) flash('Dieser Fall wurde inzwischen von jemand anderem übernommen oder geändert.', true);
      else flash('Fall übernommen – du bearbeitest ihn jetzt.');
      afterCaseChange(id);
    }).catch(failed);
  }

  /** userId leer = Zuordnung entfernen (Fall wird wieder ausstehend). */
  function assignCase(id, userId) {
    var patch = userId ? { assigned_to: userId, status: 'in_bearbeitung' } : { assigned_to: null, status: 'ausstehend' };
    return updateCase(id, patch).then(function (rows) {
      if (!rows.length) flash('Der Fall konnte nicht geändert werden.', true);
      else flash(userId ? 'Fall zugeordnet an ' + nameOf(userId) + '.' : 'Zuordnung entfernt – der Fall ist wieder ausstehend.');
      afterCaseChange(id);
    }).catch(failed);
  }

  function closeCase(id) {
    if (!window.confirm('Fall abschließen?\n\nEr verschwindet aus der Übersicht und wird unter „Abgeschlossen“ aufbewahrt, bis er automatisch gelöscht wird (7 Tage nach Eingang).')) {
      return Promise.resolve();
    }
    return updateCase(id, { status: 'abgeschlossen' }).then(function (rows) {
      if (!rows.length) flash('Der Fall konnte nicht abgeschlossen werden.', true);
      else flash('Fall abgeschlossen – er liegt jetzt unter „Abgeschlossen“.');
      afterCaseChange(id);
    }).catch(failed);
  }

  function reopenCase(id) {
    return updateCase(id, { status: 'in_bearbeitung' }).then(function (rows) {
      if (!rows.length) flash('Der Fall konnte nicht wieder geöffnet werden.', true);
      else flash('Fall wieder geöffnet.');
      afterCaseChange(id);
    }).catch(failed);
  }

  /** Lädt Status/Zuordnung des geöffneten Falls neu (ohne die Nutzlast). */
  function refreshCase(id) {
    return client.from('support_snapshots').select(CASE_RET).eq('id', id).maybeSingle().then(function (res) {
      if (!alive() || !current || current.row.id !== id || res.error || !res.data) return;
      Object.keys(res.data).forEach(function (k) { current.row[k] = res.data[k]; });
      renderDetailHead();
      renderCaseBar();
    });
  }

  /* ── Fall-Leiste im Detail ────────────────────────────────────────────── */

  function teamSelect(selectedId) {
    var sel = h('select', { 'aria-label': 'Zuordnen an' });
    sel.appendChild(h('option', { value: '', text: '– niemand –' }));
    Object.keys(team).sort(function (a, b) {
      if (me && a === me.id) return -1;
      if (me && b === me.id) return 1;
      return nameOf(a).localeCompare(nameOf(b), 'de');
    }).forEach(function (id) {
      sel.appendChild(h('option', { value: id, text: nameOf(id) + (me && id === me.id ? ' (ich)' : '') }));
    });
    sel.value = selectedId || '';
    return sel;
  }

  function caseInfo(row) {
    var st = statusOf(row);
    var parts = [h('span', { class: 'cps-status cps-status-' + st, text: STATUS_LABEL[st] }), ' '];
    if (st === 'ausstehend') {
      parts.push('Noch niemand zugeordnet.');
    } else if (st === 'in_bearbeitung') {
      parts.push('Bearbeiter: ', h('strong', { text: nameOf(row.assigned_to) }),
        row.assigned_at ? ' · seit ' + fmtDateTime(row.assigned_at) : '');
    } else {
      parts.push((row.assigned_to ? 'Bearbeiter: ' + nameOf(row.assigned_to) + ' · ' : '') +
        'abgeschlossen' + (row.closed_at ? ' am ' + fmtDateTime(row.closed_at) : '') +
        (row.closed_by ? ' von ' + nameOf(row.closed_by) : '') +
        ' · wird am ' + fmtDateTime(row.expires_at) + ' automatisch gelöscht.');
    }
    return parts;
  }

  function renderCaseBar() {
    var bar = $('casebar');
    if (!bar || !current) return;
    clear(bar);
    var row = current.row;
    var st = statusOf(row);
    var id = row.id;
    var actions = h('div', { class: 'cps-casebar-actions' });

    if (st === 'abgeschlossen') {
      actions.appendChild(actionBtn('Wieder öffnen', function () { return reopenCase(id); }));
    } else {
      if (!me || row.assigned_to !== me.id) {
        actions.appendChild(actionBtn(st === 'ausstehend' ? 'Übernehmen' : 'Mir zuweisen',
          function () { return st === 'ausstehend' ? claimCase(id) : assignCase(id, me && me.id); }, true));
      }
      var sel = teamSelect(row.assigned_to);
      actions.appendChild(sel);
      actions.appendChild(actionBtn('Zuordnen', function () { return assignCase(id, sel.value); }));
      if (st === 'in_bearbeitung') {
        actions.appendChild(actionBtn('Abschließen', function () { return closeCase(id); }, true));
      }
    }
    bar.appendChild(h('div', { class: 'cps-casebar-info' }, caseInfo(row)));
    bar.appendChild(actions);
  }

  /* ── Detailansicht laden ──────────────────────────────────────────────── */

  function loadDetail(id) {
    showMessage('Lade …');
    Promise.all([
      loadTeam(),
      client.from('support_snapshots').select('*').eq('id', id).maybeSingle(),
    ]).then(function (r) {
      if (!alive()) return;
      var res = r[1];
      if (res.error) { showMessage('Fehler', 'Die Daten konnten nicht geladen werden.'); return; }
      if (!res.data) {
        showMessage('Nicht gefunden', 'Diesen Eintrag gibt es nicht (mehr). Daten-Links werden nach 7 Tagen automatisch gelöscht.');
        return;
      }
      current = { row: res.data, payload: res.data.payload || {} };
      activeTab = 'aquarium';
      renderDetailHead();
      renderCaseBar();
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
    applyPageMeta();
    client = getClient();
    current = null;
    me = null;
    team = {};
    listCases = [];
    listTab = 'ausstehend';
    onlyMine = false;

    $('loginForm').addEventListener('submit', onLogin);
    $('btnLogout').addEventListener('click', onLogout);
    $('btnList').addEventListener('click', function () { navigate(''); });
    $('btnName').addEventListener('click', onSetName);
    $('btnRefresh').addEventListener('click', function () { loadList(true); });
    $('btnMine').addEventListener('click', function () { onlyMine = !onlyMine; renderList(); });
    var listTabs = document.querySelectorAll('#cps-listTabs .cps-tab');
    for (var j = 0; j < listTabs.length; j++) {
      listTabs[j].addEventListener('click', function (ev) {
        listTab = ev.currentTarget.getAttribute('data-list');
        renderList();
      });
    }
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
      stopPoll();
      if (flashTimer) { clearTimeout(flashTimer); flashTimer = null; }
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
