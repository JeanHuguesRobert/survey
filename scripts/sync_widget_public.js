// scripts/sync_widget_public.js
// Synchronise le widget et ses assets dans public/widget/

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '../widget');
const DEST = path.join(__dirname, '../public/widget');

if (!fs.existsSync(DEST)) fs.mkdirSync(DEST, { recursive: true });

const files = ['ophelia-widget.js', 'demo-widget-ophelia.html', 'README.md'];

for (const file of files) {
  const srcFile = path.join(SRC, file);
  const destFile = path.join(DEST, file);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, destFile);
    console.log(`✔ Copié : ${file}`);
  }
}
