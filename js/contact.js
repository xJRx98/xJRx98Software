let lastSubmit = 0;
const SUBMIT_COOLDOWN = 30000;
const GAS_URL   = 'https://script.google.com/macros/s/AKfycbxpfHG8Z8NuViT_oFmPioMxNmLiZ907zMB4eoqdGntwshkuzF1IoMC-G2IXsElEC709dg/exec';
const GAS_TOKEN = 'xJRx98secret2026';

document.getElementById('contact-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const now = Date.now();
  if (now - lastSubmit < SUBMIT_COOLDOWN) {
    const wait = Math.ceil((SUBMIT_COOLDOWN - (now - lastSubmit)) / 1000);
    document.getElementById('cf-status').textContent = 'Bitte warte noch ' + wait + ' Sekunden vor der nächsten Anfrage.';
    document.getElementById('cf-status').style.color = '#c94b6d';
    document.getElementById('cf-status').style.display = 'block';
    return;
  }
  const btn = document.getElementById('cf-btn');
  const status = document.getElementById('cf-status');
  const honeypot = document.getElementById('cf-honeypot').value;
  if (honeypot) return;
  const name = document.getElementById('cf-name').value.trim();
  const email = document.getElementById('cf-email').value.trim();
  const message = document.getElementById('cf-message').value.trim();

  btn.textContent = 'Wird gesendet...';
  btn.disabled = true;
  status.style.display = 'none';

  try {
    const res = await fetch(GAS_URL, {
      method: 'POST',
      body: JSON.stringify({ name, email, message, token: GAS_TOKEN, honeypot: document.getElementById('cf-honeypot').value }),
    });
    const data = await res.json();
    if (data.status === 'ok') {
      status.textContent = 'Nachricht gesendet! Du bekommst gleich eine Bestätigung per E-Mail.';
      status.style.color = 'var(--accent)';
      status.style.display = 'block';
      btn.textContent = 'Gesendet ✓';
      lastSubmit = Date.now();
      document.getElementById('cf-name').value = '';
      document.getElementById('cf-email').value = '';
      document.getElementById('cf-message').value = '';
    } else { throw new Error('Fehler'); }
  } catch(err) {
    status.textContent = 'Fehler beim Senden - bitte versuche es erneut oder schreib direkt eine E-Mail.';
    status.style.color = '#c94b6d';
    status.style.display = 'block';
    btn.textContent = 'Nachricht senden ->';
    btn.disabled = false;
  }
});