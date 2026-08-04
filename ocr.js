import Tesseract from 'tesseract.js';
import fs from 'fs';

Tesseract.recognize(
  'images/URTC_FLASHER_V1_1.png',
  'eng',
  { logger: m => console.log(m) }
).then(({ data: { text } }) => {
  console.log("OCR RESULT:", text);
})
