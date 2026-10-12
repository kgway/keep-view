import en from './en.json' with {type:'json'};
import ja from './ja.json' with {type:'json'};

const catalogs: Record<string,Record<string,string>>={en,ja};

let locale: 'en'|'ja'='en';

function setLanguage(language: string) {locale=/^ja(?:[-_]|$)/i.test(language || '')?'ja':'en';}
function getLocale() {return locale;}

function t(key: string,values: unknown[]=[]) {
  if(locale==='en' && key==='{0}字' && Number(values[0])===1) key='{0}字（単数形）';
  return (catalogs[locale][key] ?? catalogs.en[key] ?? key).replace(/\{(\d+)\}/g, (match: string,index: string)=>Number(index)<values.length?String(values[Number(index)]):match);
}

export {t,setLanguage,getLocale};
