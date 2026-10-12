import type {PathExport} from "./types";


function formatPathExport(payload: PathExport,format: string='json',root: string|null=null) {
  const output={...payload};
  delete output.vaultRoot;
  const separator=root?.includes('\\')?'\\':'/';
  const paths=payload.paths.map((path)=>root===null?path:root.replace(/[\\/]+$/,'')+separator+path.replace(/\//g,separator));
  if(root!==null) {output.paths=paths;output.pathBase='absolute';}
  if(format==='json') return JSON.stringify(root===null?output:{vaultRoot:root,...output},null,2);
  return paths.join('\n');
}

export {formatPathExport};
