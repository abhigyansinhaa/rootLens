const fs = require('fs')
const path = require('path')

const srcDir = path.join(__dirname, 'src')

function walkDir(dir) {
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath)
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8')
      let originalContent = content

      // Replace simple variables: bg-[var(--surface-1)] -> bg-(--surface-1)
      content = content.replace(/-\[var\((--[\w-]+)\)\]/g, '-($1)')
      
      // Replace length variables: text-[length:var(--font-label-xs)] -> text-(length:--font-label-xs)
      content = content.replace(/-\[([a-z]+):var\((--[\w-]+)\)\]/g, '-($1:$2)')

      // Replace z-[99999] -> z-99999
      content = content.replace(/z-\[([0-9]+)\]/g, 'z-$1')

      // Replace bg-gradient-to-br -> bg-linear-to-br
      content = content.replace(/bg-gradient-to-([a-z]+)/g, 'bg-linear-to-$1')

      if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8')
        console.log('Fixed:', fullPath)
      }
    }
  }
}

walkDir(srcDir)
console.log('Done!')
