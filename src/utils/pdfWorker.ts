import * as pdfjsLib from 'pdfjs-dist';
import { resolveAssetUrl } from './assets';

// Dynamically resolve worker location compatible with Electron and Web
pdfjsLib.GlobalWorkerOptions.workerSrc = resolveAssetUrl('pdf.worker.min.mjs');

export { pdfjsLib };
