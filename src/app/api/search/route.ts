import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface Share {
  symbol: string;
  shortname: string;
  exchange: string;
}

let cachedShares: Share[] | null = null;

function getShares(): Share[] {
  if (cachedShares) return cachedShares;
  
  const filePath = path.join(process.cwd(), 'EQUITY_L.csv');
  try {
    const file = fs.readFileSync(filePath, 'utf8');
    const lines = file.split('\n');
    const shares: Share[] = [];
    
    // Skip header line (index 0)
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      // Split by comma, respecting quotes
      const parts = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      if (parts.length < 2) continue;
      
      const symbol = parts[0].trim();
      let name = parts[1].trim();
      if (name.startsWith('"') && name.endsWith('"')) {
        name = name.slice(1, -1);
      }
      
      shares.push({
        symbol: symbol + '.NS',
        shortname: name,
        exchange: 'NSE',
      });
    }
    
    // Add crypto and commodities
    shares.push({ symbol: 'BTC-USD', shortname: 'Bitcoin USD', exchange: 'CRYPTO' });
    shares.push({ symbol: 'ETH-USD', shortname: 'Ethereum USD', exchange: 'CRYPTO' });
    shares.push({ symbol: 'GC=F', shortname: 'Gold Futures', exchange: 'COMEX' });
    shares.push({ symbol: 'SI=F', shortname: 'Silver Futures', exchange: 'COMEX' });
    shares.push({ symbol: 'CL=F', shortname: 'Crude Oil', exchange: 'NYMEX' });
    shares.push({ symbol: '^NSEI', shortname: 'NIFTY 50', exchange: 'NSE' });
    shares.push({ symbol: '^NSEBANK', shortname: 'NIFTY BANK', exchange: 'NSE' });

    cachedShares = shares;
    return shares;
  } catch (err) {
    console.error('Error reading CSV:', err);
    return [];
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.toLowerCase();

  if (!q) {
    return NextResponse.json({ error: 'Query is required' }, { status: 400 });
  }

  try {
    const shares = getShares();
    
    const results = shares.filter(s => 
      s.symbol.toLowerCase().includes(q) || 
      s.shortname.toLowerCase().includes(q)
    ).slice(0, 15); // Limit to top 15 results for performance

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Local Search API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
