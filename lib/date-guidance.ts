import type {Page} from "./types";

class DateGuidance {
   pages: Page[]|null=null;
  property='';
   summary: {missing:number,invalid:number,importable:number}|null=null;

  read(enabled: boolean,property: string,readPages: ()=>Page[],filenameDate: (name:string)=>string|null) {
    if(!enabled) return null;
    const pages=readPages();
    if(this.pages===pages && this.property===property) return this.summary;
    this.pages=pages;this.property=property;this.summary=null;
    // Wait for metadata rather than treating unindexed notes as missing dates.
    if(pages.some((page)=>page.file.metadataReady===false)) return null;
    let missing=0,invalid=0,importable=0;
    for(const {file} of pages) {
      if(file.property!==null) continue;
      if(file.propertyPresent) invalid++;
      else {missing++;if(filenameDate(file.name)!==null) importable++;}
    }
    if(missing || invalid) this.summary={missing,invalid,importable};
    return this.summary;
  }
}

export {DateGuidance};
