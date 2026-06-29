const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const srcDir = path.join(__dirname, 'src');
let totalChanges = 0;

walkDir(srcDir, function(filePath) {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;

  let content = fs.readFileSync(filePath, 'utf-8');
  let original = content;

  // 1. Replace orphaned surface-0 references -> app-bg (surface-0 doesn't exist now)
  content = content.replace(/--surface-0\)/g, '--app-bg)');

  // 2. Replace orphaned surface-4 -> surface-3 (surface-4 doesn't exist now)
  content = content.replace(/--surface-4\)/g, '--surface-3)');

  // 3. Replace orphaned surface-5 -> border-strong (surface-5 doesn't exist now)
  content = content.replace(/--surface-5\)/g, '--border-strong)');

  // 4. Replace orphaned --border-brand -> --border-focus (border-brand doesn't exist)
  content = content.replace(/--border-brand\)/g, '--border-focus)');
  content = content.replace(/--border-brand\'/g, "--border-focus'");
  content = content.replace(/--border-brand\"/g, '--border-focus"');
  // Also handle border-brand in var() strings
  content = content.replace(/var\(--border-brand\)/g, 'var(--border-focus)');

  // 5. Replace --color-brand-500 -> --brand (in var() usage) 
  content = content.replace(/var\(--color-brand-500\)/g, 'var(--brand)');

  // 6. Replace glass / glass-2 classes (removed concepts)
  content = content.replace(/glass-2\s+/g, '');
  content = content.replace(/glass\s+/g, '');

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(`Updated: ${path.relative(srcDir, filePath)}`);
    totalChanges++;
  }
});

console.log(`\nTotal files updated: ${totalChanges}`);
