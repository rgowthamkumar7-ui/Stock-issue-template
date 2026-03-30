import fs from 'fs';
import { readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const srcDir = String.raw`c:\Users\HP\Documents\ITC\Stock issue\code\Stock issue template\src`;

function getAllFiles(dir) {
    const files = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            files.push(...getAllFiles(full));
        } else if (['.tsx', '.ts'].includes(extname(entry).toLowerCase())) {
            files.push(full);
        }
    }
    return files;
}

for (const file of getAllFiles(srcDir)) {
    const buf = fs.readFileSync(file);
    const content = buf.toString('utf8');
    const rel = file.replace(srcDir, '');
    for (let i = 0; i < content.length; i++) {
        const charCode = content.charCodeAt(i);
        if (charCode > 127) {
            const surrounding = content.substring(Math.max(0, i - 15), Math.min(content.length, i + 15));
            console.log(`${rel} [Line ${content.substring(0, i).split('\n').length}]: U+${charCode.toString(16).toUpperCase()} (${content[i]}) context: "${surrounding.replace(/\n/g, '\\n')}"`);
            i += 5; // next char
        }
    }
}
