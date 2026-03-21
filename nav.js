// Shared navigation bar for all pages.
// Usage: <div id="nav" data-prev-week="week2.html" data-next-week="week4.html"></div>
//        <script src="nav.js"></script>  (or "../nav.js" from subdirectories)
//
// The script auto-detects the directory depth from the <script> tag's src attribute
// to set correct relative paths. Optional data attributes on #nav:
//   data-prev-week  — href for "← Week N" link (week pages only)
//   data-next-week  — href for "Week N →" link (week pages only)
//   data-prev-label  — label text like "Week 2" (defaults to parsing the href)
//   data-next-label  — label text like "Week 4" (defaults to parsing the href)

(function () {
  // Detect base path by finding our own script tag
  var scripts = document.getElementsByTagName('script');
  var base = '';
  for (var i = 0; i < scripts.length; i++) {
    var src = scripts[i].getAttribute('src') || '';
    if (src.match(/nav\.js$/)) {
      base = src.replace('nav.js', '');
      break;
    }
  }

  var links = [
    { href: base + 'index.html', text: 'Current Week' },
    { href: base + 'catalog.html', text: 'Recipe Catalog' },
    { href: base + 'weeks/index.html', text: 'Weekly Archives' },
    { href: base + 'friends.html', text: 'Friends Dinners' }
  ];

  var container = document.getElementById('nav');
  if (!container) return;

  var html = '';
  for (var j = 0; j < links.length; j++) {
    html += '<a href="' + links[j].href + '">' + links[j].text + '</a>';
  }

  // Add contextual prev/next week links if specified
  var prevWeek = container.getAttribute('data-prev-week');
  var nextWeek = container.getAttribute('data-next-week');
  var prevLabel = container.getAttribute('data-prev-label');
  var nextLabel = container.getAttribute('data-next-label');

  if (prevWeek) {
    html += '<a href="' + prevWeek + '">&larr; ' + (prevLabel || prevWeek.replace('.html', '').replace('week', 'Week ').replace('../index', 'Current')) + '</a>';
  }
  if (nextWeek) {
    html += '<a href="' + nextWeek + '">' + (nextLabel || nextWeek.replace('.html', '').replace('week', 'Week ').replace('../index', 'Current')) + ' &rarr;</a>';
  }

  container.innerHTML = html;
})();
