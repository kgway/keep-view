import obsidianmd from 'eslint-plugin-obsidianmd';

// Use the official preset. Match the community scanner's advisory severities;
// keep security rules blocking. Source modules use ES imports and Web APIs.
const security=new Set(['no-eval','no-implied-eval','no-unsanitized/method','no-unsanitized/property','obsidianmd/regex-lookbehind','obsidianmd/no-forbidden-elements']);
const advisory=Object.assign({},...obsidianmd.configs.recommended.map(config=>config.rules||{}));
for(const [name,value] of Object.entries(advisory)) {
  const severity=Array.isArray(value)?value[0]:value;
  if(security.has(name) || severity===0 || severity==='off') continue;
  advisory[name]=Array.isArray(value)?['warn',...value.slice(1)]:'warn';
}
export default [
  {ignores:['node_modules/**','.pnpm-store/**','dist/**','.artifacts/**','tests/**','scripts/**','docs/**','.local/**']},
  ...obsidianmd.configs.recommended,
  {
    files:['main.ts','lib/**/*.ts'],
    languageOptions:{sourceType:'module',ecmaVersion:2022,parserOptions:{project:'./tsconfig.json',tsconfigRootDir:import.meta.dirname},globals:{window:'readonly',document:'readonly',navigator:'readonly',console:'readonly',setTimeout:'readonly',clearTimeout:'readonly',setInterval:'readonly',clearInterval:'readonly',requestAnimationFrame:'readonly',cancelAnimationFrame:'readonly',IntersectionObserver:'readonly',ResizeObserver:'readonly',AbortController:'readonly',TextEncoder:'readonly',TextDecoder:'readonly',CompressionStream:'readonly',DecompressionStream:'readonly',Blob:'readonly',Response:'readonly',getComputedStyle:'readonly',HTMLElement:'readonly'}},
    rules:{...advisory,'no-undef':'off','no-implicit-globals':'off','@typescript-eslint/no-require-imports':'error','@typescript-eslint/no-unnecessary-type-assertion':'error','@typescript-eslint/no-floating-promises':'error','import/no-unresolved':'off',...Object.fromEntries(['no-unsafe-assignment','no-unsafe-call','no-unsafe-member-access','no-unsafe-argument','no-unsafe-return'].map(name=>['@typescript-eslint/'+name,'error'])),...Object.fromEntries([...security].map(name=>[name,'error']))},
  },
];
