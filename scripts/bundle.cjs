const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),web=path.join(root,'web');
let html=fs.readFileSync(path.join(web,'index.html'),'utf8');
html=html.replace('<link rel="stylesheet" href="style.css">',()=>`<style>${fs.readFileSync(path.join(web,'style.css'),'utf8')}</style>`);
for(const name of ['core.js','app.js'])html=html.replace(`<script src="${name}"></script>`,()=>`<script>${fs.readFileSync(path.join(web,name),'utf8')}</script>`);
const target=path.join(root,'android/app/src/main/assets');fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(target,'index.html'),html);console.log('Android interface bundled.');
