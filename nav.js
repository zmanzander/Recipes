// Shared sidebar navigation for all pages.
// Usage: <div id="nav"></div>
//        <script src="nav.js"></script>  (or "../nav.js" from subdirectories)
//
// Auto-detects directory depth from the <script> tag's src attribute.
// Optional data attributes on #nav:
//   data-prev-week  — href for "← Week N" link (week pages only)
//   data-next-week  — href for "Week N →" link (week pages only)
//   data-prev-label — label text like "Week 2"
//   data-next-label — label text like "Week 4"

(function () {
  var scripts = document.getElementsByTagName('script');
  var base = '';
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].getAttribute('src') || '';
    if (src.match(/nav\.js$/)) {
      base = src.replace('nav.js', '');
      break;
    }
  }

  var container = document.getElementById('nav');
  if (!container) return;

  var prevWeek = container.getAttribute('data-prev-week');
  var nextWeek = container.getAttribute('data-next-week');
  var prevLabel = container.getAttribute('data-prev-label');
  var nextLabel = container.getAttribute('data-next-label');

  // Build sidebar links
  var links = [
    { href: base + 'index.html', text: 'Current Week', icon: '&#128197;' },
    { href: base + 'catalog.html', text: 'Recipe Catalog', icon: '&#128218;' },
    { href: base + 'weeks/index.html', text: 'Weekly Archives', icon: '&#128451;' },
    { href: base + 'friends.html', text: 'Friends Dinners', icon: '&#127860;' }
  ];

  // Week nav links
  var weekLinks = '';
  if (prevWeek || nextWeek) {
    weekLinks += '<div class="nav-sidebar-divider"></div>';
    if (prevWeek) {
      var pLabel = prevLabel || prevWeek.replace('.html', '').replace('week', 'Week ').replace('../index', 'Current');
      weekLinks += '<a href="' + prevWeek + '" class="nav-sidebar-link">&larr; ' + pLabel + '</a>';
    }
    if (nextWeek) {
      var nLabel = nextLabel || nextWeek.replace('.html', '').replace('week', 'Week ').replace('../index', 'Current');
      weekLinks += '<a href="' + nextWeek + '" class="nav-sidebar-link">' + nLabel + ' &rarr;</a>';
    }
  }

  // Inject styles
  var style = document.createElement('style');
  style.textContent =
    '.nav-menu-btn{position:fixed;top:16px;right:16px;z-index:1000;width:44px;height:44px;border:none;border-radius:10px;background:#2c3e50;color:#fff;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,0.15);transition:background 0.2s;}' +
    '.nav-menu-btn:hover{background:#3498db;}' +
    '.nav-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1001;opacity:0;visibility:hidden;transition:opacity 0.25s,visibility 0.25s;}' +
    '.nav-overlay.open{opacity:1;visibility:visible;}' +
    '.nav-sidebar{position:fixed;top:0;right:0;bottom:0;width:260px;max-width:80vw;background:#fff;z-index:1002;transform:translateX(100%);transition:transform 0.25s ease;box-shadow:-4px 0 20px rgba(0,0,0,0.15);display:flex;flex-direction:column;}' +
    '.nav-sidebar.open{transform:translateX(0);}' +
    '.nav-sidebar-header{display:flex;align-items:center;justify-content:space-between;padding:20px 20px 16px;border-bottom:1px solid #ecf0f1;}' +
    '.nav-sidebar-header span{font-weight:700;font-size:1.05em;color:#2c3e50;}' +
    '.nav-close-btn{width:36px;height:36px;border:none;background:#f0f0f0;border-radius:8px;font-size:18px;cursor:pointer;color:#555;display:flex;align-items:center;justify-content:center;transition:background 0.15s;}' +
    '.nav-close-btn:hover{background:#e0e0e0;}' +
    '.nav-sidebar-links{flex:1;padding:12px 0;overflow-y:auto;}' +
    '.nav-sidebar-link{display:flex;align-items:center;gap:12px;padding:12px 20px;color:#333;text-decoration:none;font-size:0.95em;font-weight:500;transition:background 0.15s;}' +
    '.nav-sidebar-link:hover{background:#f5f7fa;color:#3498db;}' +
    '.nav-sidebar-link .nav-icon{font-size:1.2em;width:24px;text-align:center;}' +
    '.nav-sidebar-divider{height:1px;background:#ecf0f1;margin:8px 20px;}';
  document.head.appendChild(style);

  // Clear container and remove old nav styling
  container.className = '';
  container.removeAttribute('style');
  container.innerHTML = '';

  // Menu button
  var btn = document.createElement('button');
  btn.className = 'nav-menu-btn';
  btn.setAttribute('aria-label', 'Open menu');
  btn.innerHTML = '&#9776;';
  document.body.appendChild(btn);

  // Overlay
  var overlay = document.createElement('div');
  overlay.className = 'nav-overlay';
  document.body.appendChild(overlay);

  // Sidebar
  var sidebar = document.createElement('div');
  sidebar.className = 'nav-sidebar';
  var sidebarHtml = '<div class="nav-sidebar-header"><span>Menu</span><button class="nav-close-btn" aria-label="Close menu">&times;</button></div>';
  sidebarHtml += '<div class="nav-sidebar-links">';
  for (var j = 0; j < links.length; j++) {
    sidebarHtml += '<a href="' + links[j].href + '" class="nav-sidebar-link"><span class="nav-icon">' + links[j].icon + '</span>' + links[j].text + '</a>';
  }
  sidebarHtml += weekLinks;
  sidebarHtml += '</div>';
  sidebar.innerHTML = sidebarHtml;
  document.body.appendChild(sidebar);

  // Toggle logic
  function openNav() {
    overlay.classList.add('open');
    sidebar.classList.add('open');
    btn.innerHTML = '&times;';
  }
  function closeNav() {
    overlay.classList.remove('open');
    sidebar.classList.remove('open');
    btn.innerHTML = '&#9776;';
  }
  btn.addEventListener('click', function () {
    if (sidebar.classList.contains('open')) closeNav(); else openNav();
  });
  overlay.addEventListener('click', closeNav);
  sidebar.querySelector('.nav-close-btn').addEventListener('click', closeNav);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeNav();
  });
})();
