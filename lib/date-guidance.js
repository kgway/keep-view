
class DateGuidance {
  /** @type {import('./types').Page[]|null} */ pages=null;
  property='';
  /** @type {{missing:number,invalid:number,importable:number}|null} */ summary=null;
  /** @param {boolean} enabled @param {string} property @param {()=>import('./types').Page[]} readPages @param {(name:string)=>string|null} filenameDate */
  read(enabled,property,readPages,filenameDate) {
    if(!enabled) return null;
    const pages=readPages();
    if(this.pages===pages && this.property===property) return this.summary;
    this.pages=pages;this.property=property;this.summary=null;
    // Wait for metadata rather than treating unindexed notes as missing dates.
    if(pages.some(page=>page.file.metadataReady===false)) return null;
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
