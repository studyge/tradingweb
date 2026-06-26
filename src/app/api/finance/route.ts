import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const reqInterval = searchParams.get('interval') || '1d';
  const range = searchParams.get('range') || 'max';

  const is3m = reqInterval === '3m';
  const is4h = reqInterval === '4h';
  const interval = is3m ? '1m' : is4h ? '1h' : reqInterval;

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol is required' }, { status: 400 });
  }

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    const json = await response.json();
    const result = json.chart?.result?.[0];

    if (!result) {
      throw new Error('No data found for symbol');
    }

    const timestamps = result.timestamp || [];
    const quote = result.indicators.quote[0];

    let data = timestamps.map((time: number, index: number) => {
      // Filter out null values
      if (quote.open[index] === null || quote.close[index] === null) return null;
      
      return {
        time: time,
        open: quote.open[index],
        high: quote.high[index],
        low: quote.low[index],
        close: quote.close[index],
        value: quote.volume[index] || 0,
      };
    }).filter(Boolean); // Remove nulls

    if (is3m || is4h) {
      const aggregated: any[] = [];
      let currentCandle: any = null;
      
      const periodSeconds = is3m ? 180 : 14400; // 3 minutes or 4 hours
      
      for (const c of data) {
        // align to boundary
        const periodTime = Math.floor(c.time / periodSeconds) * periodSeconds;
        
        if (!currentCandle || currentCandle.time !== periodTime) {
          if (currentCandle) aggregated.push(currentCandle);
          currentCandle = {
            time: periodTime,
            open: c.open,
            high: c.high,
            low: c.low,
            close: c.close,
            value: c.value
          };
        } else {
          currentCandle.high = Math.max(currentCandle.high, c.high);
          currentCandle.low = Math.min(currentCandle.low, c.low);
          currentCandle.close = c.close;
          currentCandle.value += c.value;
        }
      }
      if (currentCandle) aggregated.push(currentCandle);
      data = aggregated;
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Yahoo Finance API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
