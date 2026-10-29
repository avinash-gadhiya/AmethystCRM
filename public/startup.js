// This runs before the application modules, including when their download fails.
window.addEventListener(
  'error',
  function (event) {
    if (event.target?.tagName !== 'SCRIPT') return;
    var startup = document.getElementById('app-startup');
    if (!startup) return;
    startup.hidden = false;
  },
  true
);

document.addEventListener('click', function (event) {
  if (event.target.closest('[data-app-reload]')) window.location.reload();
});
