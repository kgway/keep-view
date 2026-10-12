import type {App, TFile} from "obsidian";

/** Open a note in a tab and bring that tab into view, including on mobile. */
async function openNoteInForeground(app: App,file: TFile) {
  const leaf=app.workspace.getLeaf('tab');
  // Omitting active follows the host preference, which may open a background tab.
  await leaf.openFile(file,{active:true});
  await app.workspace.revealLeaf(leaf);
}

export {openNoteInForeground};
