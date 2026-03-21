#!/usr/bin/env node
/**
 * Recipe Site Builder
 *
 * Reads JSON data from data/ and generates all HTML pages:
 * - recipes/*.html (individual recipe pages with nav, dietary tags, footer)
 * - index.html (current week meal plan)
 * - catalog.html (searchable recipe catalog)
 * - weeks/index.html (weekly archives index)
 * - weeks/week{N}.html (archived week pages)
 *
 * Usage: node build.js
 *
 * To add a new week:
 *   1. Add recipe JSON files to data/recipes/
 *   2. Add week entry to data/weeks.json
 *   3. Run: node build.js
 *   4. Push to main
 */

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const RECIPES_DATA_DIR = path.join(DATA_DIR, 'recipes');
const RECIPES_OUT_DIR = path.join(ROOT, 'recipes');
const WEEKS_OUT_DIR = path.join(ROOT, 'weeks');

// ─── Load Data ───────────────────────────────────────────────────────────────

function loadJSON(filepath) {
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function loadAllRecipes() {
  const recipes = {};
  const files = fs.readdirSync(RECIPES_DATA_DIR).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const recipe = loadJSON(path.join(RECIPES_DATA_DIR, file));
    recipes[recipe.id] = recipe;
  }
  return recipes;
}

const weeks = loadJSON(path.join(DATA_DIR, 'weeks.json'));
const ratings = loadJSON(path.join(DATA_DIR, 'ratings.json'));
const recipes = loadAllRecipes();

// Sort weeks by week number
weeks.sort((a, b) => a.week - b.week);

// Pick current week based on date (fallback to last week if no match)
function pickCurrentWeek(weeksList) {
  const now = new Date();
  for (const w of weeksList) {
    if (!w.dates) continue;
    const [monthDayRange, year] = w.dates.split(', ');
    const [month, dayRange] = monthDayRange.split(' ');
    if (!dayRange) continue;
    const [startDay, endDay] = dayRange.split('-');
    
    // Simplistic check: If year matches and month matches and day is between start/end
    // This is enough for this specific project context
    const startDate = new Date(`${month} ${startDay}, ${year}`);
    const endDate = new Date(`${month} ${endDay}, ${year}`);
    // Set time to midday to avoid zone issues
    startDate.setHours(12);
    endDate.setHours(23);
    
    if (now >= startDate && now <= endDate) {
      return w;
    }
  }
  return weeksList[weeksList.length - 1];
}

const currentWeek = pickCurrentWeek(weeks);

// Build a map of recipe → which weeks it appears in
const recipeWeeks = {};
for (const week of weeks) {
  for (const rid of week.recipes) {
    if (!recipeWeeks[rid]) recipeWeeks[rid] = [];
    recipeWeeks[rid].push(week.week);
  }
}

// ─── Shared HTML Components ─────────────────────────────────────────────────

const DIET_LABELS = {
  gf: { label: 'Gluten-Free', bg: '#e8f8f5', color: '#0e6251' },
  df: { label: 'Dairy-Free', bg: '#ebf5fb', color: '#1a5276' },
  ef: { label: 'Egg-Free', bg: '#fef9e7', color: '#7d6608' },
  sf: { label: 'Soy-Free', bg: '#fdedec', color: '#922b21' },
  lf: { label: 'Low-FODMAP', bg: '#f4ecf7', color: '#6c3483' }
};

const PROTEIN_COLORS = {
  chicken: { bg: '#fdebd0', color: '#e67e22', border: '#e67e22' },
  beef: { bg: '#fadbd8', color: '#c0392b', border: '#c0392b' },
  turkey: { bg: '#d5f4e6', color: '#27ae60', border: '#27ae60' },
  pork: { bg: '#f5d0e0', color: '#8e44ad', border: '#8e44ad' },
  seafood: { bg: '#d6eaf8', color: '#2980b9', border: '#2980b9' },
  breakfast: { bg: '#f9e79f', color: '#7d6608', border: '#d4ac0d' }
};

function navBar(prefix) {
  return `    <div id="nav"></div>\n    <script src="${prefix}nav.js"></script>`;
}

function dietBadges(dietArr) {
  if (!dietArr || dietArr.length === 0) return '';
  const spans = dietArr.map(d => {
    const info = DIET_LABELS[d];
    if (!info) return '';
    return `<span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:0.8em;font-weight:600;background:${info.bg};color:${info.color};">${info.label}</span>`;
  }).join('');
  return `    <div style="margin: 15px 0; display: flex; flex-wrap: wrap; gap: 6px;">${spans}</div>`;
}

function navFooter(prefix) {
  return '';
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Generate Recipe Pages ──────────────────────────────────────────────────

function buildRecipePage(recipe) {
  const style = recipe.headStyle || 'body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: auto; padding: 20px; }';

  // Strip leading h1 tag(s) from bodyHtml since we generate nav + h1 + diet badges
  let body = recipe.bodyHtml || '';
  body = body.replace(/^\s*<h1[^>]*>.*?<\/h1>\s*/s, '');
  body = body.replace(/^\s*<h1[^>]*>.*?<\/h1>\s*/s, '');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${recipe.title}</title>
    <style>
${style}
    </style>
</head>
<body>
${navBar('../')}
    <h1>${recipe.title}</h1>
${dietBadges(recipe.diet)}
${body}
${navFooter('../')}
</body>
</html>`;
}

// ─── Generate Catalog ───────────────────────────────────────────────────────

function buildCatalogCard(recipe) {
  const wks = recipeWeeks[recipe.id] || [];
  const rating = ratings[recipe.id];
  const prot = PROTEIN_COLORS[recipe.protein] || {};

  const dietStr = (recipe.diet || []).join(' ');
  const weekStr = wks.join(',');
  const searchStr = [
    recipe.title.toLowerCase(),
    recipe.protein,
    ...(recipe.diet || []).map(d => DIET_LABELS[d]?.label?.toLowerCase() || '')
  ].join(' ');

  let ratingHtml = '';
  if (rating === 'loved') ratingHtml = '\n            <span class="rating rating-loved">Loved</span>';
  else if (rating === 'good') ratingHtml = '\n            <span class="rating rating-good">Good</span>';
  else if (rating === 'skip') ratingHtml = '\n            <span class="rating rating-skip">Skip</span>';

  const dietTags = (recipe.diet || []).map(d => {
    return `<span class="diet-tag diet-${d}">${d === 'lf' ? 'Low-FODMAP' : d.toUpperCase()}</span>`;
  }).join('');

  const weekTags = wks.length > 0
    ? wks.map(w => `<span class="week-tag">Week ${w}</span>`).join(' ')
    : '<span class="week-tag">Not yet scheduled</span>';

  return `        <div class="recipe-card" data-protein="${recipe.protein}" data-weeks="${weekStr}" data-diet="${dietStr}" data-search="${searchStr}">
            <a href="recipes/${recipe.id}.html">${recipe.title}</a>${ratingHtml}
            <div class="recipe-meta">
                <span class="protein-tag protein-${recipe.protein}">${capitalize(recipe.protein)}</span> ${recipe.time || ''}
            </div>
            <div class="diet-tags">${dietTags}</div>
            <div class="week-tags">${weekTags}</div>
        </div>`;
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function buildCatalog() {
  // Group recipes by protein
  const groups = { chicken: [], beef: [], turkey: [], pork: [], seafood: [], breakfast: [], other: [] };
  for (const recipe of Object.values(recipes)) {
    const group = groups[recipe.protein] || groups.other;
    group.push(recipe);
  }

  let cards = '';
  const order = ['chicken', 'beef', 'turkey', 'pork', 'seafood', 'breakfast', 'other'];
  for (const protein of order) {
    const group = groups[protein];
    if (group.length === 0) continue;
    cards += `\n        <!-- ${protein.toUpperCase()} -->\n`;
    for (const recipe of group) {
      cards += buildCatalogCard(recipe) + '\n\n';
    }
  }

  // Weekly archives section
  let weekCards = '';
  for (const week of weeks) {
    const isCurrent = week.week === currentWeek.week;
    const href = isCurrent ? 'index.html' : `weeks/week${week.week}.html`;
    const label = isCurrent ? `Week ${week.week} (Current)` : `Week ${week.week}`;
    const cls = isCurrent ? ' current' : '';
    weekCards += `            <div class="week-card${cls}">
                <a href="${href}">${label}</a>
                <div class="meta">${week.dates}</div>
                <div class="meta">${week.recipes.length} recipes</div>
            </div>\n`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Recipe Catalog</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 960px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; border-bottom: 1px solid #ecf0f1; padding-bottom: 5px; }

        .search-bar { margin: 20px 0; }
        .search-bar input {
            width: 100%;
            padding: 12px 16px;
            border: 2px solid #dce1e6;
            border-radius: 8px;
            font-size: 1em;
            box-sizing: border-box;
            outline: none;
            transition: border-color 0.2s;
        }
        .search-bar input:focus { border-color: #3498db; }
        .filter-buttons {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 15px 0;
        }
        .filter-btn {
            padding: 6px 16px;
            border: 2px solid #dce1e6;
            border-radius: 20px;
            background: white;
            font-size: 0.9em;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s;
        }
        .filter-btn:hover { border-color: #3498db; color: #3498db; }
        .filter-btn.active { background: #3498db; border-color: #3498db; color: white; }
        .result-count { color: #7f8c8d; font-size: 0.9em; margin: 10px 0; }

        .recipe-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
            gap: 16px;
            margin: 20px 0;
        }
        .recipe-card {
            background: #f8f9fa;
            border-radius: 8px;
            padding: 18px;
            border-left: 4px solid #3498db;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .recipe-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.08);
        }
        .recipe-card.hidden { display: none; }
        .recipe-card a { color: #2c3e50; text-decoration: none; font-weight: 600; font-size: 1.05em; }
        .recipe-card a:hover { color: #3498db; }
        .recipe-meta { color: #7f8c8d; font-size: 0.85em; margin-top: 6px; }
        .protein-tag {
            display: inline-block;
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 0.75em;
            font-weight: 600;
            margin-right: 4px;
        }
        .protein-chicken { background: #fdebd0; color: #e67e22; }
        .protein-beef { background: #fadbd8; color: #c0392b; }
        .protein-turkey { background: #d5f4e6; color: #27ae60; }
        .protein-pork { background: #f5d0e0; color: #8e44ad; }
        .protein-seafood { background: #d6eaf8; color: #2980b9; }
        .protein-breakfast { background: #f9e79f; color: #7d6608; }

        .rating { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 0.75em; margin-left: 4px; }
        .rating-loved { background: #d5f4e6; color: #27ae60; }
        .rating-good { background: #d6eaf8; color: #2980b9; }
        .rating-skip { background: #fadbd8; color: #e74c3c; }

        .week-tags { margin-top: 6px; }
        .week-tag {
            display: inline-block;
            padding: 1px 8px;
            border-radius: 3px;
            font-size: 0.7em;
            background: #eee;
            color: #555;
            margin-right: 3px;
        }

        .diet-tags { margin-top: 6px; display: flex; flex-wrap: wrap; gap: 3px; }
        .diet-tag {
            display: inline-block;
            padding: 1px 7px;
            border-radius: 3px;
            font-size: 0.68em;
            font-weight: 600;
            letter-spacing: 0.02em;
        }
        .diet-gf { background: #e8f8f5; color: #0e6251; }
        .diet-df { background: #ebf5fb; color: #1a5276; }
        .diet-ef { background: #fef9e7; color: #7d6608; }
        .diet-sf { background: #fdedec; color: #922b21; }
        .diet-lf { background: #f4ecf7; color: #6c3483; }

        .filter-section-label {
            font-size: 0.8em;
            font-weight: 600;
            color: #7f8c8d;
            margin-right: 6px;
            align-self: center;
        }
        .filter-btn.diet-filter { font-size: 0.82em; padding: 4px 12px; }
        .filter-btn.diet-filter.active { background: #16a085; border-color: #16a085; color: white; }
        .filter-btn.diet-filter:hover { border-color: #16a085; color: #16a085; }
        .filter-btn.diet-filter.active:hover { color: white; }

        .recipe-card[data-protein="chicken"] { border-left-color: #e67e22; }
        .recipe-card[data-protein="beef"] { border-left-color: #c0392b; }
        .recipe-card[data-protein="turkey"] { border-left-color: #27ae60; }
        .recipe-card[data-protein="pork"] { border-left-color: #8e44ad; }
        .recipe-card[data-protein="seafood"] { border-left-color: #2980b9; }
        .recipe-card[data-protein="breakfast"] { border-left-color: #d4ac0d; }

        .weeks-section {
            background: #fef9e7;
            padding: 20px;
            border-radius: 8px;
            margin: 30px 0;
        }
        .weeks-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .week-card { background: white; padding: 15px; border-radius: 5px; text-align: center; }
        .week-card a { color: #2c3e50; text-decoration: none; font-weight: 600; }
        .week-card a:hover { color: #3498db; }
        .week-card .meta { color: #7f8c8d; font-size: 0.85em; margin-top: 4px; }
        .week-card.current { border: 2px solid #3498db; }

        .no-results { text-align: center; padding: 40px; color: #7f8c8d; display: none; }
    </style>
</head>
<body>
    <h1>Recipe Catalog</h1>

    <div id="nav"></div>
    <script src="nav.js"></script>

    <div class="search-bar">
        <input type="text" id="searchInput" placeholder="Search recipes by name, protein, ingredient...">
    </div>

    <div class="filter-buttons">
        <span class="filter-section-label">Protein:</span>
        <button class="filter-btn active" data-filter="all">All</button>
        <button class="filter-btn" data-filter="chicken">Chicken</button>
        <button class="filter-btn" data-filter="beef">Beef</button>
        <button class="filter-btn" data-filter="turkey">Turkey</button>
        <button class="filter-btn" data-filter="pork">Pork</button>
        <button class="filter-btn" data-filter="seafood">Seafood</button>
    </div>

    <div class="filter-buttons" id="dietFilters">
        <span class="filter-section-label">Diet:</span>
        <button class="filter-btn diet-filter" data-diet="gf">Gluten-Free</button>
        <button class="filter-btn diet-filter" data-diet="df">Dairy-Free</button>
        <button class="filter-btn diet-filter" data-diet="ef">Egg-Free</button>
        <button class="filter-btn diet-filter" data-diet="sf">Soy-Free</button>
        <button class="filter-btn diet-filter" data-diet="lf">Low-FODMAP</button>
    </div>

    <div class="result-count" id="resultCount"></div>

    <div class="recipe-grid" id="recipeGrid">
${cards}
    </div>

    <div class="no-results" id="noResults">
        No recipes match your search. Try a different protein or keyword.
    </div>

    <div class="weeks-section">
        <h2>Weekly Archives</h2>
        <p>Browse past meal plans to see what was cooked each week.</p>
        <div class="weeks-grid">
${weekCards}        </div>
    </div>

    <script>
        const searchInput = document.getElementById('searchInput');
        const proteinButtons = document.querySelectorAll('.filter-btn:not(.diet-filter)');
        const dietButtons = document.querySelectorAll('.filter-btn.diet-filter');
        const recipeCards = document.querySelectorAll('.recipe-card');
        const resultCount = document.getElementById('resultCount');
        const noResults = document.getElementById('noResults');

        let activeFilter = 'all';
        let activeDiets = new Set();

        function updateDisplay() {
            const query = searchInput.value.toLowerCase().trim();
            let visible = 0;

            recipeCards.forEach(card => {
                const protein = card.dataset.protein;
                const searchText = card.dataset.search;
                const cardDiets = (card.dataset.diet || '').split(' ');
                const name = card.querySelector('a').textContent.toLowerCase();

                const matchesFilter = activeFilter === 'all' || protein === activeFilter;
                const matchesSearch = !query || name.includes(query) || searchText.includes(query);
                const matchesDiet = activeDiets.size === 0 || [...activeDiets].every(d => cardDiets.includes(d));

                if (matchesFilter && matchesSearch && matchesDiet) {
                    card.classList.remove('hidden');
                    visible++;
                } else {
                    card.classList.add('hidden');
                }
            });

            resultCount.textContent = visible + ' recipe' + (visible !== 1 ? 's' : '') + ' found';
            noResults.style.display = visible === 0 ? 'block' : 'none';
        }

        proteinButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                proteinButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                activeFilter = btn.dataset.filter;
                updateDisplay();
            });
        });

        dietButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const diet = btn.dataset.diet;
                if (activeDiets.has(diet)) {
                    activeDiets.delete(diet);
                    btn.classList.remove('active');
                } else {
                    activeDiets.add(diet);
                    btn.classList.add('active');
                }
                updateDisplay();
            });
        });

        searchInput.addEventListener('input', updateDisplay);
        updateDisplay();
    </script>
</body>
</html>`;
}

// ─── Generate Week Pages ────────────────────────────────────────────────────

const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_NAMES = { sunday: 'Sunday', monday: 'Monday', tuesday: 'Tuesday', wednesday: 'Wednesday', thursday: 'Thursday', friday: 'Friday', saturday: 'Saturday' };

function buildMealCell(meal, prefix) {
  if (!meal) return '-';
  if (meal.label) return meal.label;

  // If only note (no recipe), return full-row note
  if (meal.note && !meal.recipe) {
    return `<td colspan="3" style="text-align: center; color: #7f8c8d; font-style: italic;">${meal.note}</td>`;
  }

  const recipe = recipes[meal.recipe];
  const name = recipe ? recipe.title : meal.recipe;
  const href = `${prefix}recipes/${meal.recipe}.html`;

  let html = `<a href="${href}" class="meal-link">${name}</a>\n`;

  const tagClass = meal.tag === 'prep' ? 'tag-prep' : meal.tag === 'guest' ? 'tag-guest' : 'tag-fresh';
  const tagLabel = meal.tag === 'prep' ? 'Prep' : meal.tag === 'guest' ? (meal.guestNote || 'Guest') : 'Fresh';
  html += `                    <span class="tag ${tagClass}">${tagLabel}</span><br>\n`;

  // Add note if present (after recipe link)
  if (meal.note) {
    html += `                    <em style="font-size:0.85em;color:#7f8c8d;">${meal.note}</em><br>\n`;
  }

  if (meal.who) {
    html += '                    ';
    html += meal.who.map(w => `<span class="badge ${w}">${capitalize(w)}</span>`).join(' ');
  }
  if (meal.soloNote) {
    html = html.replace(/<br>\n/, `<br>\n                    <em style="font-size:0.85em;color:#7f8c8d;">${meal.soloNote}</em><br>\n`);
  }

  return html;
}

function buildWeekScheduleTable(week, prefix) {
  const hasBf = Object.values(week.schedule).some(d => d && d.breakfast);
  const hasLunch = Object.values(week.schedule).some(d => d && d.lunch);
  const hasDessert = Object.values(week.schedule).some(d => d && d.dessert);

  let headers = '<th>Day</th>';
  if (hasBf) headers += '<th>Breakfast</th>';
  if (hasLunch) headers += '<th>Lunch</th>';
  headers += '<th>Dinner</th>';
  if (hasDessert) headers += '<th>Dessert</th>';

  let rows = '';
  for (const day of DAYS) {
    const sched = week.schedule[day];
    if (!sched) continue;

    // Handle full-row notes (like "Free Day")
    if (sched.note && !sched.breakfast && !sched.lunch && !sched.dinner && !sched.dessert) {
      const colCount = 1 + (hasBf ? 1 : 0) + (hasLunch ? 1 : 0) + 1 + (hasDessert ? 1 : 0);
      rows += `            <tr>
                <td><strong>${DAY_NAMES[day]}</strong></td>
                <td colspan="${colCount - 1}" style="text-align: center; color: #7f8c8d; font-style: italic;">${sched.note}</td>
            </tr>\n`;
      continue;
    }

    rows += `            <tr>\n                <td><strong>${DAY_NAMES[day]}</strong></td>\n`;
    if (hasBf) rows += `                <td>${sched.breakfast ? buildMealCell(sched.breakfast, prefix) : '-'}</td>\n`;
    if (hasLunch) rows += `                <td>${sched.lunch ? buildMealCell(sched.lunch, prefix) : '-'}</td>\n`;
    rows += `                <td>${sched.dinner ? buildMealCell(sched.dinner, prefix) : '-'}</td>\n`;
    if (hasDessert) rows += `                <td>${sched.dessert ? buildMealCell(sched.dessert, prefix) : '-'}</td>\n`;
    rows += `            </tr>\n`;
  }

  return `    <table class="schedule-table">
        <thead>
            <tr>${headers}</tr>
        </thead>
        <tbody>
${rows}        </tbody>
    </table>`;
}

function buildWeekRecipeList(week, prefix) {
  let items = '';
  for (const rid of week.recipes) {
    const recipe = recipes[rid];
    if (!recipe) continue;
    items += `        <li>
            <a href="${prefix}recipes/${rid}.html" class="meal-link">${recipe.title}</a>
            <div class="meta">${capitalize(recipe.protein)} &middot; ${recipe.time || ''}</div>
        </li>\n`;
  }
  return `    <ul class="recipe-list">\n${items}    </ul>`;
}

function buildShoppingList(shopping) {
  let html = '\n    <h2>🛒 Shopping List</h2>\n    <div style="background: #fdfefe; border: 1px solid #d5dbdb; padding: 20px; border-radius: 8px;">\n';
  
  if (shopping.produce && shopping.produce.length > 0) {
    html += '        <h3 style="margin-top: 0; color: #27ae60;">Produce</h3>\n        <ul style="columns: 2; list-style-type: none; padding: 0;">\n';
    shopping.produce.forEach(item => {
      html += `            <li style="margin-bottom: 5px;">☐ ${item}</li>\n`;
    });
    html += '        </ul>\n';
  }
  
  if (shopping.proteins && shopping.proteins.length > 0) {
    html += '        <h3 style="color: #e74c3c;">Proteins</h3>\n        <ul style="list-style-type: none; padding: 0;">\n';
    shopping.proteins.forEach(item => {
      html += `            <li style="margin-bottom: 5px;">☐ ${item}</li>\n`;
    });
    html += '        </ul>\n';
  }
  
  if (shopping.dairy && shopping.dairy.length > 0) {
    html += '        <h3 style="color: #3498db;">Dairy & Refrigerated</h3>\n        <ul style="list-style-type: none; padding: 0;">\n';
    shopping.dairy.forEach(item => {
      html += `            <li style="margin-bottom: 5px;">☐ ${item}</li>\n`;
    });
    html += '        </ul>\n';
  }
  
  if (shopping.pantry && shopping.pantry.length > 0) {
    html += '        <h3 style="color: #d35400;">Pantry & Frozen</h3>\n        <ul style="list-style-type: none; padding: 0;">\n';
    shopping.pantry.forEach(item => {
      html += `            <li style="margin-bottom: 5px;">☐ ${item}</li>\n`;
    });
    html += '        </ul>\n';
  }
  
  html += '    </div>\n';
  return html;
}

function weekPageStyle() {
  return `    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        h2 { color: #34495e; margin-top: 30px; border-bottom: 1px solid #ecf0f1; padding-bottom: 5px; }
        .intro { background: #ecf0f1; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .note { background: #fef9e7; padding: 10px 15px; border-radius: 5px; margin: 10px 0; border-left: 4px solid #f39c12; }
        .schedule-table { width: 100%; border-collapse: collapse; margin: 20px 0; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .schedule-table th, .schedule-table td { padding: 12px 15px; text-align: left; border-bottom: 1px solid #ecf0f1; }
        .schedule-table th { background: #f8f9fa; font-weight: 600; color: #555; text-transform: uppercase; font-size: 0.85em; letter-spacing: 0.05em; }
        .schedule-table tr:hover { background: #f8f9fa; }
        .meal-link { color: #3498db; text-decoration: none; font-weight: 600; }
        .meal-link:hover { text-decoration: underline; }
        .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.8em; font-weight: 600; margin-right: 4px; }
        .zander { background: #e3f2fd; color: #1976d2; }
        .hanna { background: #fce4ec; color: #c2185b; }
        .tag { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 0.8em; margin-right: 5px; }
        .tag-prep { background: #d5f4e6; color: #27ae60; }
        .tag-fresh { background: #fdebd0; color: #e67e22; }
        .tag-guest { background: #fadbd8; color: #e74c3c; }
        .recipe-list { list-style: none; padding: 0; }
        .recipe-list li { margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 5px; border-left: 4px solid #3498db; }
        .meta { color: #7f8c8d; font-size: 0.9em; margin-top: 5px; }
    </style>`;
}

function buildWeekPage(week, isIndex) {
  const prefix = isIndex ? '' : '../';
  const weekIdx = weeks.indexOf(week);
  const prevWeek = weekIdx > 0 ? weeks[weekIdx - 1] : null;
  const nextWeek = weekIdx < weeks.length - 1 ? weeks[weekIdx + 1] : null;

  let navAttrs = '';
  if (!isIndex) {
    if (prevWeek) navAttrs += ` data-prev-week="week${prevWeek.week}.html" data-prev-label="Week ${prevWeek.week}"`;
    if (nextWeek) {
      const nextHref = nextWeek.week === currentWeek.week ? `${prefix}index.html` : `week${nextWeek.week}.html`;
      navAttrs += ` data-next-week="${nextHref}" data-next-label="Week ${nextWeek.week}"`;
    }
  }

  let introHtml = '';
  if (week.targets) introHtml += `\n    <div class="intro">\n        <p><strong>Targets:</strong> ${week.targets}</p>`;
  if (week.theme) introHtml += `\n        <p><strong>Theme:</strong> ${week.theme}</p>`;
  introHtml += '\n    </div>';

  let noteHtml = '';
  if (week.note) noteHtml = `\n    <div class="note">\n        <strong>Note:</strong> ${week.note}\n    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${isIndex ? `Meal Plan: ${week.dates}` : `Week ${week.week} Meal Plan - ${week.dates}`}</title>
${weekPageStyle()}
</head>
<body>
    <h1>Week ${week.week} Meal Plan${isIndex ? ': ' + week.dates : ''}</h1>
    ${!isIndex ? `<p style="color: #7f8c8d; margin-top: -10px;">${week.dates}</p>` : ''}

    <div id="nav"${navAttrs}></div>
    <script src="${prefix}nav.js"></script>
${introHtml}${noteHtml}

    <h2>Daily Schedule</h2>
${buildWeekScheduleTable(week, prefix)}

    <h2>Recipes</h2>
${buildWeekRecipeList(week, prefix)}
${week.shopping ? buildShoppingList(week.shopping) : ''}


</body>
</html>`;
}

// ─── Generate Weekly Archives Index ─────────────────────────────────────────

function buildWeeksIndex() {
  let weekCards = '';
  for (const week of weeks) {
    const isCurrent = week.week === currentWeek.week;
    const href = isCurrent ? '../index.html' : `week${week.week}.html`;
    const cls = isCurrent ? ' current' : '';
    const badge = isCurrent ? ' <span class="badge-current">Current</span>' : '';

    const highlights = (week.highlights || []).map(h => `                <li>${h}</li>`).join('\n');

    weekCards += `        <div class="week-card${cls}">
            <a href="${href}">Week ${week.week}</a>${badge}
            <div class="meta">${week.dates}</div>
            <div class="meta">${week.recipes.length} recipes &middot; ${week.theme}</div>
            <ul>
${highlights}
            </ul>
        </div>\n\n`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weekly Archives - Meal Plans</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
            color: #333;
        }
        h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
        .weeks-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
            gap: 16px;
            margin: 20px 0;
        }
        .week-card {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #3498db;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .week-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .week-card.current { border-left-color: #27ae60; }
        .week-card a { color: #2c3e50; text-decoration: none; font-weight: 600; font-size: 1.1em; }
        .week-card a:hover { color: #3498db; }
        .meta { color: #7f8c8d; font-size: 0.9em; margin-top: 5px; }
        .badge-current {
            display: inline-block;
            background: #27ae60;
            color: white;
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 0.75em;
            font-weight: 600;
            margin-left: 8px;
        }
        .week-card ul { margin: 8px 0 0 0; padding-left: 18px; font-size: 0.85em; color: #555; }
    </style>
</head>
<body>
    <h1>Weekly Archives</h1>
    <p style="color: #7f8c8d; margin-top: -10px;">Browse past and current meal plans</p>

    <div id="nav"></div>
    <script src="../nav.js"></script>

    <div class="weeks-grid">
${weekCards}    </div>
</body>
</html>`;
}

// ─── Write Everything ───────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function build() {
  console.log('Building recipe site...');
  console.log(`  ${Object.keys(recipes).length} recipes loaded`);
  console.log(`  ${weeks.length} weeks loaded`);
  console.log(`  Current week: ${currentWeek.week} (${currentWeek.dates})`);
  console.log('');

  ensureDir(RECIPES_OUT_DIR);
  ensureDir(WEEKS_OUT_DIR);

  // 1. Recipe pages
  let recipeCount = 0;
  for (const recipe of Object.values(recipes)) {
    const html = buildRecipePage(recipe);
    fs.writeFileSync(path.join(RECIPES_OUT_DIR, `${recipe.id}.html`), html);
    recipeCount++;
  }
  console.log(`  Generated ${recipeCount} recipe pages`);

  // 2. Catalog
  const catalogHtml = buildCatalog();
  fs.writeFileSync(path.join(ROOT, 'catalog.html'), catalogHtml);
  console.log('  Generated catalog.html');

  // 3. Current week → index.html
  const indexHtml = buildWeekPage(currentWeek, true);
  fs.writeFileSync(path.join(ROOT, 'index.html'), indexHtml);
  console.log(`  Generated index.html (Week ${currentWeek.week})`);

  // 4. Archived week pages
  for (const week of weeks) {
    if (week.week === currentWeek.week) continue; // current week is index.html
    const html = buildWeekPage(week, false);
    fs.writeFileSync(path.join(WEEKS_OUT_DIR, `week${week.week}.html`), html);
  }
  console.log(`  Generated ${weeks.length - 1} archived week pages`);

  // 5. Weekly archives index
  const weeksIndexHtml = buildWeeksIndex();
  fs.writeFileSync(path.join(WEEKS_OUT_DIR, 'index.html'), weeksIndexHtml);
  console.log('  Generated weeks/index.html');

  console.log('\nBuild complete!');
}

build();
