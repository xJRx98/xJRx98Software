function tryHistoryState(fn) {
  try { fn(); } catch(e) {}
}

function showPage(pageId, pushState = true) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + pageId);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    initReveal();
    if (pushState) tryHistoryState(() => history.pushState({ page: pageId }, '', '#' + pageId));
  }
}

function showProject(projectId) { showPage(projectId); }

function scrollToSection(sectionId) {
  setTimeout(() => {
    const el = document.getElementById(sectionId);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }, 100);
}

window.addEventListener('popstate', (e) => {
  showPage(e.state?.page || 'home', false);
});

window.addEventListener('DOMContentLoaded', () => {
  let start = 'home';
  try {
    const hash = location.hash.replace('#', '');
    const valid = ['home', 'cp-app', 'wasserpantscher', 'patientenaufruf-produkt', 'impressum', 'datenschutz', 'ueber-mich'];
    if (valid.includes(hash)) start = hash;
    tryHistoryState(() => history.replaceState({ page: start }, '', start === 'home' ? location.pathname : '#' + start));
  } catch(e) {}
  showPage(start, false);
});

function initReveal() {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const siblings = [...el.parentElement.querySelectorAll('.reveal')];
        el.style.transitionDelay = (siblings.indexOf(el) * 0.07) + 's';
        el.classList.add('visible');
        observer.unobserve(el);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.reveal').forEach(el => {
    el.classList.remove('visible');
    el.style.transitionDelay = '0s';
    observer.observe(el);
  });
}