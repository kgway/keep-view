import type { TFile } from "obsidian";
export type Settings = {
  dateProperty: string;
  creationTimeZone: string;
  previewLengths: number[];
  previewMode: string;
  confirmDelete: boolean;
  fastSearch: boolean;
  showDateGuidance: boolean;
  language: string;
  obsidianLanguage?: string;
};
export type TagNode = {
  type: string;
  id: string;
  tag?: string;
  children?: TagNode[];
};
export type Page = {
  file: {
    path: string;
    name: string;
    folder: string;
    tags: string[];
    mtime: number;
    ctime: number;
    property: number | null;
    propertyPresent?: boolean;
    metadataReady?: boolean;
  };
};
export type ResultFolder = {
  path: string;
  name: string;
  pages: Page[];
  children: Map<string, ResultFolder>;
  count: number;
};
export type FolderNode = {
  name: string;
  path: string;
  children: Record<string, FolderNode>;
};
export type TagDraft = {
  common: string[];
  partial: string[];
  checked: string[];
  counts: Record<string, number>;
  total: number;
};
export type TagValue = {
  present: boolean;
  value: unknown;
};
export type TagChange = {
  path: string;
  expected: TagValue;
  target: TagValue;
};
export type CacheEntry = {
  mtime: number;
  size: number;
  text: string;
};
export type Bucket = {
  entries: Map<string, CacheEntry & {
    epoch: number;
  }>;
  dirty: boolean;
  bytes: number;
};
export type CachedMatch = {
  file: TFile;
  mtime: number;
  size: number;
  match: boolean;
};
export type SearchProgress = {
  matches: Set<string>;
  settled: Set<string>;
};
export type ProgressCallback = (completed: number, total: number, progress: SearchProgress) => void;
export type SearchResult = {
  matches: Set<string>;
  errors: string[];
  cancelled: boolean;
  storageError?: boolean;
};
export type SavedState = {
  searchTree: TagNode;
  formula: string;
  textQuery: string;
  dateField: string;
  sortField: string;
  sortOrder: string;
  dateFrom: string;
  dateTo: string;
  noTagOnly: boolean;
  density: string;
  previewChars: number;
  folderFilters: string[];
  groupByFolder: boolean;
  folderGroupState: Record<string, boolean>;
  tagGroupState: Record<string, boolean>;
  resultTreeOpen?: Record<string, boolean>;
};
export type Snapshot = SavedState & {
  _selection?: {
    mode: boolean;
    paths: string[];
    folders: string[];
    draft: TagDraft | null;
    destination: string | null;
  };
  _tagChanges?: TagChange[];
};
export type ContentEntry = {
  summary: string;
  markdown?: string;
  thumb: string | null;
  loading: boolean;
  promise: Promise<void>;
};
export type ViewState = SavedState & {
  formulaError: string;
  resultTreeOpen: Record<string, boolean>;
  resultTreeLimits: Record<string, number>;
  limit: number;
  tagCache: Record<string, number> | null;
  tagRevision: number | null;
  contentCache: Record<string, ContentEntry>;
  undoStack: Snapshot[];
  redoStack: Snapshot[];
};
export type PathExport = {
  schema: string;
  exportedAt: string;
  vault: string;
  pathBase: string;
  count: number;
  filters: Record<string, unknown>;
  paths: string[];
  vaultRoot?: string;
};
