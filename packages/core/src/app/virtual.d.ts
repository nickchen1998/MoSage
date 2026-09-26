declare module 'virtual:mosage/docs' {
  import type { DocModule } from './lib/sdk';

  export const docIds: string[];
  export const docCreatedAt: Record<string, number>;
  export const docThemes: Record<string, string>;
  export function loadDoc(id: string): Promise<DocModule>;
}

declare module 'virtual:mosage/themes' {
  import type { ThemeDemoModule, ThemeMeta } from './lib/themes';

  export const themes: ThemeMeta[];
  export function loadThemeDemo(id: string): Promise<ThemeDemoModule>;
}

declare module 'virtual:mosage/folders' {
  import type { FoldersManifest } from './lib/sdk';

  const manifest: FoldersManifest;
  export default manifest;
}

declare module 'virtual:mosage/config' {
  import type { MoSageConfig } from '../config';

  type ResolvedBuild = { showDocBrowser: boolean };
  const config: MoSageConfig & { build: ResolvedBuild; version: string };
  export default config;
}
