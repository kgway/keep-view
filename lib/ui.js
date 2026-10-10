import {setIcon} from "obsidian";
import {t as msg} from "./i18n.js";
/** @type {WeakMap<Document,Set<HTMLElement>>} */
const hoveredSurfaces=new WeakMap();
/** @param {HTMLElement} root */
function suppressHoverTooltips(root) {
  const document=root.ownerDocument;
  if(!root.addEventListener || !document.body) return ()=>{};
  let surfaces=hoveredSurfaces.get(document);
  if(!surfaces) {surfaces=new Set();hoveredSurfaces.set(document,surfaces);}
  const enter=()=>{surfaces.add(root);document.body.classList.add('kv-hide-tooltips');};
  const leave=()=>{surfaces.delete(root);document.body.classList.toggle('kv-hide-tooltips',surfaces.size>0);};
  root.addEventListener('pointerenter',enter);root.addEventListener('pointerleave',leave);
  return ()=>{root.removeEventListener('pointerenter',enter);root.removeEventListener('pointerleave',leave);leave();};
}
/** @param {HTMLElement} parent @param {string} icon @param {string} label @param {boolean} active */
function iconButton(parent, icon, label, active=false) {
  const button=parent.createEl('button',{cls:'kv-btn kv-icon-btn'+(active?' is-active':'')});
  button.setAttribute('aria-label',label);
  setIcon(button,icon);
  return button;
}

/** @param {HTMLElement} parent @param {{label:string,checked?:boolean,disabled?:boolean}} options */
function dropdownCheckbox(parent,{label,checked=false,disabled=false}) {
  const control=parent.createSpan({cls:'kv-checkbox-control'});
  const check=control.createEl('input',{cls:'kv-dropdown-checkbox',type:'checkbox'});
  check.checked=checked;check.disabled=disabled;check.setAttribute('aria-label',label);
  check.onpointerdown=event=>event.preventDefault();
  control.createSpan({cls:'kv-checkbox-mark'}).setAttribute('aria-hidden','true');
  return check;
}

/** @param {HTMLElement} parent @param {boolean} open @param {boolean} children */
function disclosureIcon(parent,open=false,children=true) {
  const toggle=parent.createSpan({cls:children?'kv-dropdown-toggle'+(open?' is-open':''):'kv-dropdown-spacer'});
  if(children) {
    setIcon(toggle,'chevron-right');
    if(parent.tagName!=='BUTTON') {toggle.setAttribute('role','button');toggle.tabIndex=0;}
    toggle.setAttribute('aria-expanded',String(open));
    toggle.setAttribute('aria-label',msg(open?'折りたたむ':'展開'));
    toggle.onpointerdown=event=>event.preventDefault();
    toggle.onkeydown=event=>{if(event.key==='Enter'||event.key===' ') {event.preventDefault();event.stopPropagation();toggle.click();}};
  }
  return toggle;
}

/** @param {HTMLElement} toggle @param {boolean} open @param {(open:boolean)=>void} changed */
function animateDisclosure(toggle,open,changed) {
  toggle.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',msg(open?'折りたたむ':'展開'));
  changed(open);
}

/** @param {HTMLElement} parent @param {{name:string,selected:boolean,depth?:number,children?:boolean,open?:boolean}} options */
function folderDropdownRow(parent,{name,selected,depth=0,children=false,open=false}) {
  const item=parent.createDiv({cls:'kv-dropdown-item'+(selected?' is-selected':'')});
  item.style.paddingLeft=(12+depth*16)+'px';
  const toggle=disclosureIcon(item,open,children);
  const check=dropdownCheckbox(item,{label:name,checked:selected});
  item.createSpan({text:name});
  return {item,toggle,check};
}


export {iconButton,folderDropdownRow,dropdownCheckbox,disclosureIcon,animateDisclosure,suppressHoverTooltips};
