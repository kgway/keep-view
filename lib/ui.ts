import {setIcon} from "obsidian";
import {t as msg} from "./i18n";

const hoveredSurfaces: WeakMap<Document,Set<HTMLElement>>=new WeakMap();

function suppressHoverTooltips(root: HTMLElement) {
  const document=root.ownerDocument;
  if(!root.addEventListener || !document.body) return ()=>{};
  let surfaces=hoveredSurfaces.get(document);
  if(!surfaces) {surfaces=new Set();hoveredSurfaces.set(document,surfaces);}
  const enter=()=>{surfaces.add(root);document.body.classList.add('kv-hide-tooltips');};
  const leave=()=>{surfaces.delete(root);document.body.classList.toggle('kv-hide-tooltips',surfaces.size>0);};
  root.addEventListener('pointerenter',enter);root.addEventListener('pointerleave',leave);
  return ()=>{root.removeEventListener('pointerenter',enter);root.removeEventListener('pointerleave',leave);leave();};
}

function iconButton(parent: HTMLElement, icon: string, label: string, active: boolean=false) {
  const button=parent.createEl('button',{cls:'kv-btn kv-icon-btn'+(active?' is-active':'')});
  button.setAttribute('aria-label',label);
  setIcon(button,icon);
  return button;
}

function dropdownCheckbox(parent: HTMLElement,{label,checked=false,disabled=false}: {label:string,checked?:boolean,disabled?:boolean}) {
  const control=parent.createSpan({cls:'kv-checkbox-control'});
  const check=control.createEl('input',{cls:'kv-dropdown-checkbox',type:'checkbox'});
  check.checked=checked;check.disabled=disabled;check.setAttribute('aria-label',label);
  check.onpointerdown=(event)=>event.preventDefault();
  control.createSpan({cls:'kv-checkbox-mark'}).setAttribute('aria-hidden','true');
  return check;
}

function disclosureIcon(parent: HTMLElement,open: boolean=false,children: boolean=true) {
  const toggle=parent.createSpan({cls:children?'kv-dropdown-toggle'+(open?' is-open':''):'kv-dropdown-spacer'});
  if(children) {
    setIcon(toggle,'chevron-right');
    if(parent.tagName!=='BUTTON') {toggle.setAttribute('role','button');toggle.tabIndex=0;}
    toggle.setAttribute('aria-expanded',String(open));
    toggle.setAttribute('aria-label',msg(open?'折りたたむ':'展開'));
    toggle.onpointerdown=(event)=>event.preventDefault();
    toggle.onkeydown=(event)=>{if(event.key==='Enter'||event.key===' ') {event.preventDefault();event.stopPropagation();toggle.click();}};
  }
  return toggle;
}

function animateDisclosure(toggle: HTMLElement,open: boolean,changed: (open:boolean)=>void) {
  toggle.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',msg(open?'折りたたむ':'展開'));
  changed(open);
}

function folderDropdownRow(parent: HTMLElement,{name,selected,depth=0,children=false,open=false}: {name:string,selected:boolean,depth?:number,children?:boolean,open?:boolean}) {
  const item=parent.createDiv({cls:'kv-dropdown-item'+(selected?' is-selected':'')});
  item.style.paddingLeft=(12+depth*16)+'px';
  const toggle=disclosureIcon(item,open,children);
  const check=dropdownCheckbox(item,{label:name,checked:selected});
  item.createSpan({text:name});
  return {item,toggle,check};
}

export {iconButton,folderDropdownRow,dropdownCheckbox,disclosureIcon,animateDisclosure,suppressHoverTooltips};
