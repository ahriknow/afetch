/**
 * afetch - Progress Tracking Example
 */

import { createInstance } from '../src/index.js';

async function downloadWithProgress() {
    const api = createInstance({
        baseURL: 'https://httpbin.org',
    });

    const response = await api.get('/bytes/10240', {
        responseType: 'blob',
        onDownloadProgress: ({ loaded, total, progress }) => {
            const percent = Math.round(progress * 100);
            console.log(`Download: ${loaded}/${total} bytes (${percent}%)`);
        },
    });

    console.log('Download complete:', response.status);
}

downloadWithProgress().catch(console.error);
