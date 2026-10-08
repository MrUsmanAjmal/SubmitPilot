import { cleanText } from './analysis';
export const MAX_FILE_BYTES=4*1024*1024;
export async function parseManuscript(file:File):Promise<string> {
  if(file.size>MAX_FILE_BYTES) throw new Error('The manuscript exceeds the 4 MB upload limit.');
  if(file.size<10) throw new Error('The uploaded file is empty.');
  const name=file.name.toLowerCase();
  const bytes=Buffer.from(await file.arrayBuffer());
  let text='';
  if(name.endsWith('.txt')) text=bytes.toString('utf8');
  else if(name.endsWith('.docx')) {
    const mammoth=await import('mammoth');
    const output=await mammoth.extractRawText({buffer:bytes});text=output.value;
  } else if(name.endsWith('.pdf')) {
    // Externalized dependency runs on the Node runtime, not Edge.
    const pdfParse=(await import('pdf-parse')).default;
    const pdf=await pdfParse(bytes);text=pdf.text;
  } else throw new Error('Unsupported file. Upload DOCX, text-based PDF or TXT.');
  text=cleanText(text);
  if(text.length<120) throw new Error('Could not extract enough text. Scanned/image-only PDFs require OCR and are not currently supported.');
  return text.slice(0,170000);
}
