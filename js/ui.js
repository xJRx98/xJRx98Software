function toggleMobileMenu() {
  var btn = document.getElementById('nav-hamburger');
  var menu = document.getElementById('nav-mobile-menu');
  var isOpen = menu.classList.contains('open');
  menu.classList.toggle('open');
  btn.classList.toggle('open');
  btn.setAttribute('aria-expanded', !isOpen);
}
function closeMobileMenu() {
  document.getElementById('nav-hamburger').classList.remove('open');
  document.getElementById('nav-hamburger').setAttribute('aria-expanded', 'false');
  document.getElementById('nav-mobile-menu').classList.remove('open');
}
document.addEventListener('click', function(e) {
  var menu = document.getElementById('nav-mobile-menu');
  var btn  = document.getElementById('nav-hamburger');
  if (menu.classList.contains('open') && !menu.contains(e.target) && !btn.contains(e.target)) {
    closeMobileMenu();
  }
});

window.addEventListener('scroll', function() {
  var btn = document.getElementById('scroll-top');
  if (!btn) return;
  if (window.scrollY > 300) { btn.classList.add('visible'); } else { btn.classList.remove('visible'); }
}, { passive: true });