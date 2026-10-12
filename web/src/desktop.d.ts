import type { Game } from './lib/catalog'
export type DownloadTask = { id: string; gameId: string; title: string; destination: string; status: 'downloading' | 'completed' | 'failed' | 'cancelled' | 'interrupted'; received: number; total: number | null; error: string }
export type DesktopSettings = { folder: string }
declare global {
  interface Window {
    overdrive?: {
      catalog(): Promise<Game[]>; importCatalog(): Promise<boolean>;
      settings(): Promise<DesktopSettings>; pickFolder(): Promise<DesktopSettings>;
      downloads(): Promise<DownloadTask[]>; download(id: string): Promise<DownloadTask>;
      cancel(id: string): Promise<void>; retry(id: string): Promise<DownloadTask>; reveal(id: string): Promise<void>;
      onDownloads(callback: (rows: DownloadTask[]) => void): () => void;
    }
  }
}
