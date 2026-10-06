'use strict';
const {setIcon} = require('obsidian');
const {t:msg} = require('./i18n');
function iconButton(parent, icon, label, active=false) {
  const button=parent.createEl('button',{cls:'kv-btn kv-icon-btn'+(active?' is-active':'')});
  button.setAttribute('aria-label',label);
  setIcon(button,icon);
  return button;
}

function dropdownCheckbox(parent,{label,checked=false,disabled=false}) {
  const control=parent.createSpan({cls:'kv-checkbox-control'});
  const check=control.createEl('input',{cls:'kv-dropdown-checkbox',type:'checkbox'});
  check.checked=checked;check.disabled=disabled;check.setAttribute('aria-label',label);
  check.onpointerdown=event=>event.preventDefault();
  control.createSpan({cls:'kv-checkbox-mark'}).setAttribute('aria-hidden','true');
  return check;
}

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

function animateDisclosure(toggle,open,changed) {
  toggle.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',msg(open?'折りたたむ':'展開'));
  changed(open);
}

function folderDropdownRow(parent,{name,selected,depth=0,children=false,open=false}) {
  const item=parent.createDiv({cls:'kv-dropdown-item'+(selected?' is-selected':'')});
  item.style.paddingLeft=(12+depth*16)+'px';
  const toggle=disclosureIcon(item,open,children);
  const check=dropdownCheckbox(item,{label:name,checked:selected});
  item.createSpan({text:name});
  return {item,toggle,check};
}


module.exports = {iconButton,folderDropdownRow,dropdownCheckbox,disclosureIcon,animateDisclosure};
