const fs = require('fs');
const path = require('path');

const recipesDir = path.join(__dirname, 'recipes');
const outputDir = path.join(__dirname, 'data', 'recipes');

// Create output directory if it doesn't exist
fs.mkdirSync(outputDir, { recursive: true });

// Diet badge mappings
const dietMap = {
  'Gluten-Free': 'gf',
  'Dairy-Free': 'df',
  'Egg-Free': 'ef',
  'Soy-Free': 'sf',
  'Low-FODMAP': 'lf',
};

// Protein detection: filename -> protein override
const proteinOverrides = {
  'breakfast-hash': 'breakfast',
  'thai-coconut-curry': 'pork',
  'pork-chimichurri': 'pork',
  'turkey-sweet-potato-hash': 'turkey',
};

function detectProtein(id, html) {
  if (proteinOverrides[id]) return proteinOverrides[id];

  const lower = html.toLowerCase();

  // Check for specific proteins in title and ingredients
  if (/\b(salmon|cod|shrimp|fish|seafood)\b/.test(lower)) return 'seafood';
  if (/\b(chicken|chicken thighs?|chicken breasts?)\b/.test(lower)) return 'chicken';
  if (/\b(beef|steak)\b/.test(lower)) return 'beef';
  if (/\b(pork|pork tenderloin|pork chops?)\b/.test(lower)) return 'pork';
  if (/\b(turkey|ground turkey)\b/.test(lower)) return 'turkey';

  return 'unknown';
}

function extractTitle(html) {
  const match = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
  if (!match) return '';
  let title = match[1].trim();
  // Strip leading emoji and space. Emojis are multi-byte unicode chars.
  title = title.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+\s*/u, '');
  return title;
}

function extractDiet(html) {
  const diet = [];
  // Look for the dietary badge div
  const badgeDiv = html.match(/<div style="margin: 15px 0; display: flex; flex-wrap: wrap; gap: 6px;">(.*?)<\/div>/s);
  if (badgeDiv) {
    for (const [label, code] of Object.entries(dietMap)) {
      if (badgeDiv[1].includes(label)) {
        diet.push(code);
      }
    }
  }
  return diet;
}

function extractTime(html) {
  const times = {};
  // Look for meta section - could be div.meta or inline
  const metaMatch = html.match(/<div class="meta">([\s\S]*?)<\/div>/);
  if (!metaMatch) return null;

  const metaContent = metaMatch[1];

  // Extract time fields: Prep, Cook, Total, Time
  const prepMatch = metaContent.match(/<strong>Prep:<\/strong>\s*(.*?)(?:<\/span>|<\/div>|<)/);
  const cookMatch = metaContent.match(/<strong>Cook:<\/strong>\s*(.*?)(?:<\/span>|<\/div>|<)/);
  const totalMatch = metaContent.match(/<strong>Total:<\/strong>\s*(.*?)(?:<\/span>|<\/div>|<)/);
  const timeMatch = metaContent.match(/<strong>Time:<\/strong>\s*(.*?)(?:<\/span>|<\/div>|<)/);

  const parts = [];
  if (prepMatch) parts.push('Prep: ' + prepMatch[1].trim());
  if (cookMatch) parts.push('Cook: ' + cookMatch[1].trim());
  if (totalMatch) parts.push('Total: ' + totalMatch[1].trim());
  if (timeMatch) parts.push('Time: ' + timeMatch[1].trim());

  return parts.length > 0 ? parts.join(' | ') : null;
}

function extractStyle(html) {
  const metaMatch = html.match(/<div class="meta">([\s\S]*?)<\/div>/);
  if (!metaMatch) return null;

  const styleMatch = metaMatch[1].match(/<strong>Style:<\/strong>\s*(.*?)(?:<\/span>|<\/div>|<)/);
  return styleMatch ? styleMatch[1].trim() : null;
}

function extractHeadStyle(html) {
  const match = html.match(/<style>([\s\S]*?)<\/style>/);
  return match ? match[1].trim() : null;
}

function extractBodyHtml(html) {
  const bodyMatch = html.match(/<body>([\s\S]*)<\/body>/);
  if (!bodyMatch) return '';

  let body = bodyMatch[1];

  // Remove nav bar div
  body = body.replace(/<div style="background:#f8f9fa;padding:10px 15px;[\s\S]*?<\/div>/, '');

  // Remove dietary tags div
  body = body.replace(/<div style="margin: 15px 0; display: flex; flex-wrap: wrap; gap: 6px;">[\s\S]*?<\/div>/, '');

  // Remove footer nav paragraph
  body = body.replace(/<p style="margin-top:30px;font-size:0.9em;">[\s\S]*?<\/p>/, '');

  return body.trim();
}

function processFile(filename) {
  const filepath = path.join(recipesDir, filename);
  const html = fs.readFileSync(filepath, 'utf-8');
  const id = path.basename(filename, '.html');

  const title = extractTitle(html);
  const protein = detectProtein(id, html);
  const diet = extractDiet(html);
  const time = extractTime(html);
  const style = extractStyle(html);
  const bodyHtml = extractBodyHtml(html);
  const headStyle = extractHeadStyle(html);

  const recipe = {
    id,
    title,
    protein,
    diet,
    time,
    style,
    rating: null,
    headStyle,
    bodyHtml,
  };

  const outputPath = path.join(outputDir, id + '.json');
  fs.writeFileSync(outputPath, JSON.stringify(recipe, null, 2) + '\n');
  console.log(`Processed: ${filename} -> ${id}.json (protein: ${protein}, diet: [${diet.join(', ')}])`);
}

// Main
const files = fs.readdirSync(recipesDir).filter(f => f.endsWith('.html'));
console.log(`Found ${files.length} recipe HTML files`);

for (const file of files) {
  processFile(file);
}

console.log(`Done. ${files.length} JSON files written to ${outputDir}`);
