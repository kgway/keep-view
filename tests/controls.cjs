const {compileSource}=require('./compile-source.cjs');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {unzipSync}=require('fflate');
const root=path.resolve(__dirname,'..');
const host=process.env.KEEP_VIEW_HOST_CSS||path.join(root,'.artifacts/host-css/obsidian.css');
const theme=process.env.KEEP_VIEW_THEME_CSS||path.join(root,'.artifacts/host-css/minimal.css');
const oldZip=['keep-view-1.35.0.zip','.artifacts/releases/keep-view-1.35.0.zip'].map(name=>path.join(root,name)).find(fs.existsSync);
if(!fs.existsSync(host)||!oldZip) throw Error('Provide KEEP_VIEW_HOST_CSS and the 1.35.0 release for the host CSS comparison.');
const oldCss=Buffer.from(unzipSync(fs.readFileSync(oldZip))['keep-view/styles.css']).toString();
const screenshots=path.join(root,'.artifacts/ui');fs.mkdirSync(screenshots,{recursive:true});
const geometry=el=>{
  const s=getComputedStyle(el),r=el.getBoundingClientRect();
  return {width:r.width,height:r.height,padding:s.padding,radius:s.borderRadius,font:s.fontSize,line:s.lineHeight};
};
(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  try {
    let reference;
    for(const mobile of [true,false]) {
      const page=await browser.newPage({viewport:{width:mobile?360:1000,height:600},hasTouch:mobile});
      await page.setContent(`<body class="theme-light ${mobile?'is-mobile':''}"><div class="keep-view-content" style="width:100%"><div class="keep-view-root"><div class="kv-controls"><div class="kv-tree-area"><div class="kv-add-row"><button class="kv-node-btn kv-add-btn"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg><span>追加</span></button></div></div></div></div></div>`);
      await page.addStyleTag({content:fs.readFileSync(host,'utf8')});
      if(fs.existsSync(theme)) await page.addStyleTag({content:fs.readFileSync(theme,'utf8')});
      if(mobile) {
        const old=await page.addStyleTag({content:oldCss});
        reference=await page.locator('.kv-add-btn').evaluate(geometry);
        await old.evaluate(el=>el.remove());
      }
      await page.evaluate(()=>{
        const settings=document.createElement('div');settings.className='kv-settings';
        settings.innerHTML='<div class="setting-item"><div class="setting-item-control"><button>初期値に戻す</button><button class="mod-cta">適用</button><select><option>標準</option></select><input type="text" value="created"></div></div>';
        document.body.append(settings);
      });
      const nativeStyles=()=>page.locator('.kv-settings :is(button,select,input)').evaluateAll(els=>els.map(el=>{
        const s=getComputedStyle(el),r=el.getBoundingClientRect();
        return {background:s.background,shadow:s.boxShadow,color:s.color,radius:s.borderRadius,weight:s.fontWeight,transform:s.transform,transition:s.transition,width:r.width,height:r.height};
      }));
      const reset=page.locator('.kv-settings button').first();
      const nativeRest=await nativeStyles();
      await reset.hover();const nativeHover=await nativeStyles();
      await reset.focus();const nativeFocus=await nativeStyles();
      await reset.evaluate(el=>{el.blur();el.disabled=true;});const nativeDisabled=await nativeStyles();
      await reset.evaluate(el=>{el.disabled=false;});await page.mouse.move(0,0);
      await page.addStyleTag({content:fs.readFileSync(path.join(root,'styles.css'),'utf8')});
      assert.deepEqual(await nativeStyles(),nativeRest,'Settings preserve native host styles at rest');
      await reset.hover();assert.deepEqual(await nativeStyles(),nativeHover,'Settings preserve native hover');
      await reset.focus();assert.deepEqual(await nativeStyles(),nativeFocus,'Settings preserve native focus');
      await reset.evaluate(el=>{el.blur();el.disabled=true;});assert.deepEqual(await nativeStyles(),nativeDisabled,'Settings preserve native disabled styles');
      await reset.evaluate(el=>{el.disabled=false;});await page.mouse.move(0,0);
      const add=page.locator('.kv-add-btn');
      assert.deepEqual(await add.evaluate(geometry),reference,'Both devices reproduce the old mobile geometry with actual host CSS');
      assert.equal(await add.evaluate(el=>getComputedStyle(el).fontWeight),'450');
      assert.equal(await add.evaluate(el=>getComputedStyle(el).color),await add.evaluate(el=>{
        const sample=document.createElement('span');sample.style.color='var(--kv-text-primary)';el.append(sample);const color=getComputedStyle(sample).color;sample.remove();return color;
      }),'Add uses the shared dark control text');
      const resting=await add.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color}));
      if(!mobile) await add.hover();
      else {const box=await add.boundingBox();await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);}
      assert.deepEqual(await add.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color})),resting,'Add never changes color');
      assert.equal(await add.evaluate(el=>getComputedStyle(el).transform),'none');
      assert.equal(await add.evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
      if(!mobile) assert.notEqual(await add.evaluate(el=>getComputedStyle(el).boxShadow),'none');
      else {await page.waitForFunction(()=>getComputedStyle(document.querySelector('.kv-add-btn')).boxShadow==='none',{},{timeout:1500});assert.equal(await add.evaluate(el=>getComputedStyle(el).boxShadow),'none','Touch shadow ends when the finger is released');}
      await page.evaluate(source=>{
        Element.prototype.createEl=function(tag,options={}){const el=document.createElement(tag);if(options.cls)el.className=options.cls;if(options.type)el.type=options.type;if(options.text)el.textContent=options.text;this.append(el);return el;};
        Element.prototype.createSpan=function(options){return this.createEl('span',options);};
        Element.prototype.createDiv=function(options){return this.createEl('div',options);};
        const module={exports:{}};
        new Function('require','module','exports',source)(id=>id==='obsidian'?{setIcon(){}}:{t:key=>key},module,module.exports);
        const popup=document.body.createEl('div',{cls:'keep-view-root kv-dropdown'});
        popup.style.cssText='position:relative;inset:auto;margin:24px;width:280px';
        for(const [name,cls,depth] of [['Filter','',0],['Move','kv-move-folder',1],['Tags','is-selected',0]]) {
          const {item}=module.exports.folderDropdownRow(popup,{name,selected:true,depth});
          if(cls)item.classList.add(cls);
          let checked=true;item.onclick=()=>{checked=!checked;item.querySelector('input').checked=checked;};
        }
      },compileSource(fs.readFileSync(path.join(root,'lib/ui.js'),'utf8')));
      const offsets=await page.locator('.kv-dropdown-checkbox').evaluateAll(els=>els.map(el=>{
        const input=el.getBoundingClientRect(),mark=el.parentElement.querySelector('.kv-checkbox-mark').getBoundingClientRect();
        return {box:[input.width,input.height],mark:[mark.left-input.left,mark.top-input.top,mark.width,mark.height],native:getComputedStyle(el,'::after').display};
      }));
      assert.deepEqual(offsets[0],offsets[1]);assert.deepEqual(offsets[0],offsets[2]);
      assert.equal(offsets[0].native,'none','The host marker cannot overlap the shared marker');
      const check=page.getByRole('checkbox',{name:'Filter',exact:true});await check.uncheck();await check.check();
      await check.focus();await page.keyboard.press('Space');assert.equal(await check.isChecked(),false);await page.keyboard.press('Space');assert.equal(await check.isChecked(),true);
      await page.screenshot({path:path.join(screenshots,`host-controls-${mobile?'mobile':'desktop'}.png`)});
      await page.close();
    }
    console.log('Host CSS comparison passed: native settings; Add geometry and updated text on both devices; shadow only; identical filter, move and tag markers.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
