import en from './en.json' with {type:'json'};
import ja from './ja.json' with {type:'json'};
/** @type {Record<string,Record<string,string>>} */
const catalogs={en,ja};
/** @type {'en'|'ja'} */
let locale='en';
/** @param {string} language */
function setLanguage(language) {locale=/^ja(?:[-_]|$)/i.test(language || '')?'ja':'en';}
function getLocale() {return locale;}

/** @param {string} key @param {unknown[]} values */
function t(key,values=[]) {
  if(locale==='en' && key==='{0}字' && Number(values[0])===1) key='{0}字（単数形）';
  return (catalogs[locale][key] ?? catalogs.en[key] ?? key).replace(/\{(\d+)\}/g,/** @param {string} match @param {string} index */ (match,index)=>Number(index)<values.length?String(values[Number(index)]):match);
}

export {t,setLanguage,getLocale};
