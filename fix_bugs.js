const fs = require('fs');
const path = require('path');

const files = [
    'combustion-chimenea/index.html',
    'entropy-diagram/index.html',
    'kapp-diagram/index.html',
    'static-beam/index.html'
];

let replacedKapp = 0;

files.forEach(f => {
    const fullPath = path.join('C:/Users/Usuario/Documents/engsim/simulators', f);
    if (!fs.existsSync(fullPath)) return;
    
    let content = fs.readFileSync(fullPath, 'utf8');
    
    if (f === 'kapp-diagram/index.html') {
        const initialCount = (content.match(/--color-accent/g) || []).length;
        content = content.replace(/--color-accent/g, '--brand-accent');
        const finalCount = (content.match(/--color-accent/g) || []).length;
        replacedKapp += (initialCount - finalCount);
    }
    
    content = content.replace(/<svg([^>]+)>/gi, (match, attrs) => {
        if (attrs.includes('role="img"') || attrs.includes('id="')) {
            return match; // skip functional SVGs
        }
        
        let newAttrs = attrs;
        
        if (!newAttrs.includes('aria-hidden')) newAttrs += ' aria-hidden="true"';
        if (!newAttrs.includes('xmlns=')) newAttrs += ' xmlns="http://www.w3.org/2000/svg"';
        if (!newAttrs.includes('fill=')) newAttrs += ' fill="none"';
        if (newAttrs.includes('fill="currentColor"')) newAttrs = newAttrs.replace('fill="currentColor"', 'fill="none"');
        if (!newAttrs.includes('stroke=')) newAttrs += ' stroke="currentColor"';
        if (!newAttrs.includes('stroke-width=')) newAttrs += ' stroke-width="2"';
        if (!newAttrs.includes('stroke-linecap=')) newAttrs += ' stroke-linecap="round"';
        if (!newAttrs.includes('stroke-linejoin=')) newAttrs += ' stroke-linejoin="round"';
        
        return <svg>;
    });
    
    fs.writeFileSync(fullPath, content);
});

console.log('Kapp replacements: ' + replacedKapp);
