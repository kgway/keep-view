const {compileSource}=require('./compile-source.cjs');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const host=process.env.KEEP_VIEW_HOST_CSS||path.join(root,'.artifacts/host-css/obsidian.css');
const theme=process.env.KEEP_VIEW_THEME_CSS||path.join(root,'.artifacts/host-css/minimal.css');
const sources=Object.fromEntries(fs.readdirSync(path.join(root,'lib')).filter(name=>/\.(js|json)$/.test(name)).map(name=>[
  './lib/'+(name.endsWith('.json')?name:name.slice(0,-3)),name.endsWith('.json')?'module.exports='+fs.readFileSync(path.join(root,'lib',name),'utf8'):compileSource(fs.readFileSync(path.join(root,'lib',name),'utf8'))
]));
sources.main=compileSource(fs.readFileSync(path.join(root,'main.js'),'utf8'))+'\nmodule.exports={TextSearchModal,PathExportModal,KeepViewSettings,CreationDateModal,DEFAULT_SETTINGS};';
const screenshots=path.join(root,'.artifacts/ui');
fs.mkdirSync(screenshots,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
  try {
    for(const mode of ['light','dark']) for(const mobile of [false,true]) {
      const page=await browser.newPage({viewport:{width:mobile?360:1000,height:850},hasTouch:mobile});
      await page.setContent(`<body class="theme-${mode} ${mobile?'is-mobile is-phone':''}"></body>`);
      await page.addStyleTag({content:fs.readFileSync(host,'utf8')});
      if(fs.existsSync(theme))await page.addStyleTag({content:fs.readFileSync(theme,'utf8')});
      await page.evaluate(sources=>{
        Element.prototype.createEl=function(tag,options={}){const el=document.createElement(tag);if(options.cls)el.className=options.cls;if(options.text!==undefined)el.textContent=options.text;for(const key of ['type','value','placeholder'])if(options[key]!==undefined)el.setAttribute(key,options[key]);this.append(el);return el;};
        Element.prototype.createDiv=function(options){return this.createEl('div',options);};
        Element.prototype.createSpan=function(options){return this.createEl('span',options);};
        Element.prototype.addClass=function(cls){this.classList.add(cls);};
        Element.prototype.empty=function(){this.replaceChildren();};
        class Modal {
          constructor(app){this.app=app;this.containerEl=document.createElement('div');this.containerEl.className='modal-container';this.modalEl=this.containerEl.createDiv({cls:'modal'});this.modalEl.createDiv({cls:'modal-header'}).createDiv({cls:'modal-title'});this.modalEl.createDiv({cls:'modal-close-button',text:'×'}).onclick=()=>this.close();this.contentEl=this.modalEl.createDiv({cls:'modal-content'});}
          open(){document.body.append(this.containerEl);this.onOpen();}
          close(){this.onClose();this.containerEl.remove();}
        }
        class Setting {
          constructor(parent){this.settingEl=parent.createDiv({cls:'setting-item'});const info=this.settingEl.createDiv({cls:'setting-item-info'});this.nameEl=info.createDiv({cls:'setting-item-name'});this.descEl=info.createDiv({cls:'setting-item-description'});this.controlEl=this.settingEl.createDiv({cls:'setting-item-control'});}
          setName(value){this.nameEl.textContent=value;return this;}
          setDesc(value){this.descEl.textContent=value;return this;}
          addText(callback){const inputEl=this.controlEl.createEl('input',{type:'text'});const text={inputEl,setValue(value){inputEl.value=value;return this;},getValue(){return inputEl.value;}};callback(text);return this;}
          addDropdown(callback){const select=this.controlEl.createEl('select',{cls:'dropdown'});const dropdown={addOption(value,text){select.createEl('option',{value,text});return this;},setValue(value){select.value=value;return this;},onChange(fn){select.onchange=()=>fn(select.value);return this;}};callback(dropdown);return this;}
          addToggle(callback){this.settingEl.classList.add('mod-toggle');const toggleEl=this.controlEl.createDiv({cls:'checkbox-container'});const toggle={setValue(value){toggleEl.classList.toggle('is-enabled',value);return this;},onChange(fn){toggleEl.onclick=()=>fn(toggleEl.classList.toggle('is-enabled'));return this;}};callback(toggle);return this;}
          addButton(callback){const button=this.controlEl.createEl('button');callback({setButtonText(value){button.textContent=value;return this;},onClick(fn){button.onclick=fn;return this;}});return this;}
        }
        const cache=new Map();
        window.require=id=>{id=id.replace(/\.js$/,'');
          if(id==='obsidian')return {Plugin:class{},ItemView:class{},PluginSettingTab:class{},Modal,Setting,Notice:class{}};
          if(id.startsWith('./')&&!id.startsWith('./lib/'))id='./lib/'+id.slice(2);
          if(!cache.has(id)){const module={exports:{}};cache.set(id,module);new Function('require','module','exports',sources[id])(window.require,module,module.exports);}
          return cache.get(id).exports;
        };
        require('./lib/i18n').setLanguage('ja');
        Object.assign(window,require('main'));
        window.app={vault:{getName:()=> 'Test Vault',adapter:{getBasePath:()=> 'C:\\Test Vault'}}};
        window.exportModal=new PathExportModal(app,{vault:'Test Vault',count:1,paths:['Notes/one.md'],filters:{},sort:{}});exportModal.open();
      },sources);
      const select=page.locator('.kv-export-format');
      const nativeShape=()=>select.evaluate(el=>{const s=getComputedStyle(el);return {image:s.backgroundImage,shadow:s.boxShadow,radius:s.borderRadius,padding:s.padding,font:s.fontSize,weight:s.fontWeight,height:el.getBoundingClientRect().height,transition:s.transition};});
      const resting=await nativeShape();
      await select.hover();const hovering=await nativeShape();
      await select.focus();const focused=await nativeShape();
      await select.evaluate(el=>el.blur());await page.mouse.move(0,0);
      await page.addStyleTag({content:fs.readFileSync(path.join(root,'styles.css'),'utf8')});
      const checkActionBorders=async()=>{
        const borders=await page.locator('.kv-modal-actions > button').evaluateAll(buttons=>buttons.map(el=>{
          const s=getComputedStyle(el),sample=document.createElement('span');sample.style.color='var(--background-modifier-border)';el.parentElement.append(sample);const expected=getComputedStyle(sample).color;sample.remove();
          return {width:s.borderTopWidth,style:s.borderTopStyle,color:s.borderTopColor,expected};
        }));
        assert.equal(borders.length,2);
        for(const border of borders){assert.equal(border.width,'1px');assert.equal(border.style,'solid');assert.equal(border.color,border.expected);}
      };
      await checkActionBorders();
      assert.deepEqual(await nativeShape(),resting,'Export keeps native dropdown geometry and arrow');
      assert.notEqual(resting.image,'none');
      const color=await select.evaluate(el=>{const s=getComputedStyle(el),sample=document.createElement('span');sample.style.backgroundColor='var(--background-secondary)';sample.style.color='var(--kv-text-primary)';el.parentElement.append(sample);const expected=getComputedStyle(sample);const result={bg:s.backgroundColor,card:expected.backgroundColor,text:s.color,expectedText:expected.color};sample.remove();return result;});
      assert.equal(color.bg,color.card);assert.equal(color.text,color.expectedText);
      await select.hover();assert.deepEqual(await nativeShape(),hovering,'Export keeps native hover');
      await select.focus();assert.deepEqual(await nativeShape(),focused,'Export keeps native keyboard focus');
      await select.selectOption('txt');assert.equal(await page.locator('.kv-export-modal textarea').inputValue(),'Notes/one.md');
      await select.selectOption('json');assert.equal(JSON.parse(await page.locator('.kv-export-modal textarea').inputValue()).count,1);
      await select.evaluate(el=>el.blur());await page.mouse.move(0,0);
      await page.screenshot({path:path.join(screenshots,`host-export-${mode}-${mobile?'mobile':'desktop'}.png`)});
      await page.evaluate(()=>{exportModal.close();window.searchModal=new TextSearchModal(app,'',value=>window.committed=value);searchModal.open();});
      assert.equal(await page.locator('.kv-text-search-dialog > .modal-header').isVisible(),false);
      const topGap=await page.locator('.kv-text-search-dialog').evaluate(el=>{const s=getComputedStyle(el),content=getComputedStyle(el.querySelector('.modal-content'));return el.querySelector('h2').getBoundingClientRect().top-el.getBoundingClientRect().top-parseFloat(s.paddingTop)-parseFloat(s.borderTopWidth)-parseFloat(content.paddingTop);});
      assert.ok(Math.abs(topGap)<1,`Search has no empty header row (${topGap}px)`);
      await checkActionBorders();
      await page.screenshot({path:path.join(screenshots,`host-search-${mode}-${mobile?'mobile':'desktop'}.png`)});
      await page.getByRole('searchbox').fill(' query ');await page.getByRole('searchbox').press('Enter');
      await page.waitForFunction(()=>window.committed==='query'&&!document.querySelector('.kv-text-search-dialog'));
      await page.evaluate(()=>{
        const shell=document.body.createDiv({cls:'modal-container'});
        const modal=shell.createDiv({cls:'modal mod-settings'});modal.style.cssText='width:900px';
        const container=modal.createDiv({cls:'modal-content'}).createDiv({cls:'vertical-tab-content'});
        const plugin={settings:{...DEFAULT_SETTINGS},saveSettings(){},confirmClearSearchCache(){},openMigration(){}};
        const tab=new KeepViewSettings(app,plugin);tab.containerEl=container;tab.display();
      });
      assert.equal(await page.locator('.kv-settings button').count(),2,'Only cache deletion and migration have buttons');
      assert.equal(await page.locator('.kv-settings .checkbox-container').count(),3);
      await page.screenshot({path:path.join(screenshots,`host-settings-${mode}-${mobile?'mobile':'desktop'}.png`)});
      await page.evaluate(()=>document.body.empty());
      for(const language of ['en','ja']) {
        await page.evaluate(language=>{
          require('./lib/i18n').setLanguage(language);window.guideOptOut=0;
          window.dateModal=new CreationDateModal(app,'created',{missing:3,invalid:3,importable:1},()=>guideOptOut++,()=>{});dateModal.open();
        },language);
        const checkbox=page.locator('.kv-date-guidance-modal input[type=checkbox]');
        await checkbox.check();assert.equal(await checkbox.isChecked(),true);
        assert.equal(await page.locator('.kv-date-guidance-modal').evaluate(el=>el.scrollWidth>el.clientWidth),false,'Popup content fits the pane');
        await checkbox.uncheck();
        await page.screenshot({path:path.join(screenshots,`date-guidance-popup-${language}-${mode}-${mobile?'mobile':'desktop'}.png`)});
        await checkbox.check();await page.evaluate(()=>dateModal.close());
        assert.equal(await page.evaluate(()=>guideOptOut),1,'Closing saves the checked preference once');
        await page.evaluate(()=>dateModal.close());assert.equal(await page.evaluate(()=>guideOptOut),1,'Closing twice cannot duplicate persistence');
      }
      await page.close();
    }
    console.log('Host modal checks passed: compact search; native export dropdown with shared colors; blank settings defaults and toggles, in light/dark on desktop/mobile.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
