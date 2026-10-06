'use strict';
const catalogs={en:require('./en.json'),ja:require('./ja.json')};
let locale='en';
function setLanguage(language) {locale=/^ja(?:[-_]|$)/i.test(language || '')?'ja':'en';}
function getLocale() {return locale;}

function t(key,values=[]) {
  if(locale==='en' && key==='{0}字' && Number(values[0])===1) key='{0}字（単数形）';
  return (catalogs[locale][key] ?? catalogs.en[key] ?? key).replace(/\{(\d+)\}/g,(match,index)=>index<values.length?String(values[index]):match);
}

module.exports={t,setLanguage,getLocale};
