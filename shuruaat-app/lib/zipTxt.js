import JSZip from 'jszip';
import { uint8ArrayToText } from './base64Bytes';

/**
 * ZIP bytes → pehli .txt (prefer devices.txt)
 */
export async function extractTxtFromZipBytes(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const names = Object.keys(zip.files).filter(
    (n) => !zip.files[n].dir && n.toLowerCase().endsWith('.txt'),
  );
  if (names.length === 0) {
    throw new Error('ZIP mein koi .txt nahi mili');
  }
  const prefer = names.find((n) => n.toLowerCase().includes('device')) ?? names[0];
  const content = await zip.files[prefer].async('uint8array');
  return { name: prefer, text: uint8ArrayToText(content) };
}
