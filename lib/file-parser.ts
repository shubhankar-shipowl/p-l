import Papa from 'papaparse';
import * as XLSX from 'xlsx';

export async function parseFile(file: File): Promise<any[]> {
  const fileName = file.name.toLowerCase();
  
  // Check if it's an Excel file
  if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
    return parseExcelFile(file);
  } else {
    // Parse as CSV
    return parseCSVFile(file);
  }
}

async function parseExcelFile(file: File): Promise<any[]> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  
  // Get the first sheet
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  
  // Convert to JSON with header row
  const data = XLSX.utils.sheet_to_json(worksheet, { 
    header: 1,
    defval: '',
    raw: false 
  }) as any[][];
  
  if (data.length === 0) {
    return [];
  }
  
  // First row is headers
  const headers = data[0].map((h: any) => String(h).trim());
  
  // Convert to array of objects
  const result: any[] = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.every((cell: any) => !cell || String(cell).trim() === '')) {
      continue; // Skip empty rows
    }
    
    const obj: any = {};
    headers.forEach((header: string, index: number) => {
      obj[header] = row[index] || '';
    });
    result.push(obj);
  }
  
  return result;
}

async function parseCSVFile(file: File): Promise<any[]> {
  const text = await file.text();
  
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        resolve(results.data as any[]);
      },
      error: (error: any) => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      },
    });
  });
}

