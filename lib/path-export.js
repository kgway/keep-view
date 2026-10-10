
/** @param {import('./types').PathExport} payload @param {string} format @param {string|null} root */
function formatPathExport(payload,format='json',root=null) {
  const output={...payload};
  delete output.vaultRoot;
  const separator=root?.includes('\\')?'\\':'/';
  const paths=payload.paths.map(path=>root===null?path:root.replace(/[\\/]+$/,'')+separator+path.replace(/\//g,separator));
  if(root!==null) {output.paths=paths;output.pathBase='absolute';}
  if(format==='json') return JSON.stringify(root===null?output:{vaultRoot:root,...output},null,2);
  return paths.join('\n');
}

export {formatPathExport};
