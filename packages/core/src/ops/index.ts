/**
 * Document operations, independent of transport. The dev API serves them over
 * HTTP for the browser, and the CLI calls them directly.
 */

export {
  ORIENTATIONS,
  type Orientation,
  PAGE_SIZE_NAMES,
  type PageSizeName,
} from '../app/lib/sdk.ts';
export { type ApiContext, makeContext } from '../vite/routes/context.ts';
export {
  createDocument,
  type DocumentSummary,
  deleteDocument,
  docDir,
  duplicateDocument,
  listDocIds,
  listDocuments,
  OpsError,
  readDocument,
  renameDocument,
  resolveEntry,
  writeDocument,
} from './documents.ts';
export { EXPORT_FORMATS, type ExportFormat } from './formats.ts';
export {
  type ImportMarkdownOptions,
  type ImportResult,
  importMarkdown,
  slugify,
} from './import.ts';
export {
  checkLayout,
  closeRenderSession,
  type ExportResult,
  exportDocument,
  type LayoutFinding,
  type LayoutReport,
} from './layout.ts';
export {
  type AssetSummary,
  createFolder,
  deleteAsset,
  fileDocument,
  findAssetUsages,
  listAssets,
  listFolders,
  listThemes,
  readTheme,
  type ThemeSummary,
  writeAsset,
} from './library.ts';
export { addComment, type Loc, readText, writeText } from './text.ts';
