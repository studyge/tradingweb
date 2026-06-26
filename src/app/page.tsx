'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Search, Loader2 } from 'lucide-react';

const ChartWidget = dynamic(() => import('@/components/ChartWidget'), { ssr: false });

interface SearchResult {
  symbol: string;
  shortname: string;
  exchange: string;
  type?: string;
}

const POPULAR_SUGGESTIONS: SearchResult[] = [
  { symbol: 'RELIANCE.NS', shortname: 'Reliance Industries', exchange: 'NSE' },
  { symbol: 'TCS.NS', shortname: 'Tata Consultancy Services', exchange: 'NSE' },
  { symbol: 'HDFCBANK.NS', shortname: 'HDFC Bank', exchange: 'NSE' },
  { symbol: '^NSEI', shortname: 'NIFTY 50', exchange: 'NSE' },
  { symbol: 'BTC-USD', shortname: 'Bitcoin', exchange: 'CRYPTO' },
  { symbol: 'GC=F', shortname: 'Gold Futures', exchange: 'COMEX' },
];

export default function Home() {
  const [symbol, setSymbol] = useState('RELIANCE.NS');
  const [searchInput, setSearchInput] = useState('RELIANCE.NS');
  
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Click outside handler
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    
    if (value.trim().length === 0) {
      setSearchResults(POPULAR_SUGGESTIONS);
      setShowDropdown(true);
      return;
    }

    setIsSearching(true);
    setShowDropdown(true);
    
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setSearchResults(data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 300); // 300ms debounce
  };

  const handleSelectSymbol = (selectedSymbol: string) => {
    setSymbol(selectedSymbol);
    setSearchInput(selectedSymbol);
    setShowDropdown(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchResults.length > 0) {
      handleSelectSymbol(searchResults[0].symbol);
    } else if (searchInput.trim()) {
      handleSelectSymbol(searchInput.trim().toUpperCase());
    }
  };

  return (
    <main className="flex flex-col h-screen overflow-hidden">
      <header className="h-14 bg-surface border-b border-gray-800 flex items-center px-4 shrink-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center font-bold text-white shadow-lg">
            T
          </div>
          <span className="font-semibold text-lg mr-6">TradingWeb</span>
        </div>
        
        <div className="relative" ref={dropdownRef}>
          <form onSubmit={handleSearchSubmit} className="flex items-center relative">
            <Search className="w-4 h-4 text-textMuted absolute left-3" />
            <input
              type="text"
              value={searchInput}
              onChange={handleInputChange}
              onFocus={() => { 
                if (searchInput.trim().length === 0) setSearchResults(POPULAR_SUGGESTIONS);
                setShowDropdown(true); 
              }}
              className="bg-[#131722] border border-gray-700 text-sm rounded-md pl-9 pr-8 py-1.5 focus:outline-none focus:border-primary transition-colors text-white w-72"
              placeholder="Search NSE, Crypto, Gold..."
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 text-primary absolute right-3 animate-spin" />
            )}
          </form>
          
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute top-full mt-1 w-full bg-surface border border-gray-700 rounded-md shadow-xl max-h-80 overflow-y-auto">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSymbol(result.symbol)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-800 transition flex flex-col border-b border-gray-800 last:border-0"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-primary">{result.symbol}</span>
                    <span className="text-xs text-textMuted uppercase bg-gray-800 px-1.5 py-0.5 rounded">{result.exchange}</span>
                  </div>
                  <span className="text-xs text-textMain truncate">{result.shortname}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>
      
      <div className="flex-1 relative w-full h-full z-0">
        <ChartWidget symbol={symbol} />
      </div>
    </main>
  );
}
