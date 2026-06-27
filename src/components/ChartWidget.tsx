'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { DrawingManager } from './DrawingManager';
import { Play, Pause, SkipForward, Square, Minus, TrendingUp, TrendingDown } from 'lucide-react';

interface CandleData {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  value?: number;
}

const TIMEFRAMES = [
  { label: '1m', interval: '1m', range: '7d' },
  { label: '3m', interval: '3m', range: '7d' }, // Aggregated from 1m on backend
  { label: '5m', interval: '5m', range: '60d' },
  { label: '15m', interval: '15m', range: '60d' },
  { label: '1H', interval: '1h', range: '730d' },
  { label: '4H', interval: '4h', range: '730d' }, // Aggregated from 1h on backend
  { label: '1D', interval: '1d', range: 'max' },
  { label: '1W', interval: '1wk', range: 'max' },
  { label: '1M', interval: '1mo', range: 'max' },
];

export default function ChartWidget({ symbol }: { symbol: string }) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<IChartApi | null>(null);
  const [candlestickSeries, setCandlestickSeries] = useState<ISeriesApi<'Candlestick'> | null>(null);
  const [volumeSeries, setVolumeSeries] = useState<ISeriesApi<'Histogram'> | null>(null);
  
  interface PositionOverlay {
    id: string;
    type: 'long' | 'short';
    time: Time;
    price: number;
    tp: number;
    sl: number;
  }
  
  const drawingManagerRef = useRef(new DrawingManager());
  const [previewPrice, setPreviewPrice] = useState<number | null>(null);
  const dragStateRef = useRef<{ active: boolean; drawingId: string; startPrice: number } | null>(null);

const [positions, setPositions] = useState<PositionOverlay[]>([]);
const drawingManager = drawingManagerRef.current;
  const [renderedPositions, setRenderedPositions] = useState<any[]>([]);
const [renderedDrawings, setRenderedDrawings] = useState<any[]>([]);
  
  const [historicalData, setHistoricalData] = useState<CandleData[]>([]);
  const [visibleData, setVisibleData] = useState<CandleData[]>([]);
  
  const [activeTimeframe, setActiveTimeframe] = useState(TIMEFRAMES[5]); // Default 1D
  
  // Replay State
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const replayIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Drawing State
  const [activeTool, setActiveTool] = useState<'cursor' | 'hline' | 'long' | 'short'>('cursor');
  const activeToolRef = useRef(activeTool);
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chartInstance = createChart(chartContainerRef.current, {
      layout: {
        background: { color: '#131722' },
        textColor: '#d1d4dc',
      },
      grid: {
        vertLines: { color: '#2b313f' },
        horzLines: { color: '#2b313f' },
      },
      timeScale: {
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1, // Normal crosshair
      }
    });

    const candleSeries = chartInstance.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });

    const volSeries = chartInstance.addHistogramSeries({
      color: '#26a69a',
      priceFormat: { type: 'volume' },
      priceScaleId: '', // set as an overlay
    });
    
    volSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    setChart(chartInstance);
    setCandlestickSeries(candleSeries);
    setVolumeSeries(volSeries);

    const handleResize = () => {
      chartInstance.applyOptions({
        width: chartContainerRef.current?.clientWidth,
        height: chartContainerRef.current?.clientHeight,
      });
    };
    
    window.addEventListener('resize', handleResize);
    
    // Drawing Tool - Click Handler
    const clickHandler = (param: any) => {
      if (!param.point || !candleSeries) return;
      
      const price = candleSeries.coordinateToPrice(param.point.y);
      const time = param.time as Time;
      const currentTool = activeToolRef.current;

      if (price !== null && currentTool === 'hline') {

        drawingManager.add({
          id: crypto.randomUUID(),
          type: "horizontal",
          points: [{
            time,
            price
          }],
          selected: false,
          locked: false,
          visible: true,
          style: {
            color: "#2962ff",
            width: 2
          }
        });

        console.log(drawingManager.getAll());

        setPreviewPrice(null);
        setActiveTool('cursor');
      }
      
      if (price !== null && time !== null && (currentTool === 'long' || currentTool === 'short')) {
        const defaultRisk = price * 0.01; // 1% risk default
        const tp = currentTool === 'long' ? price + (defaultRisk * 2) : price - (defaultRisk * 2);
        const sl = currentTool === 'long' ? price - defaultRisk : price + defaultRisk;
        
        setPositions(prev => [...prev, {
          id: Math.random().toString(36).substring(2, 9),
          type: currentTool,
          time: time,
          price: price,
          tp: tp,
          sl: sl
        }]);
        setActiveTool('cursor');
      }
    };
    
    chartInstance.subscribeClick(clickHandler);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.unsubscribeClick(clickHandler);
      chartInstance.remove();
      setChart(null);
      setCandlestickSeries(null);
      setVolumeSeries(null);
    };
  }, []); // Run ONCE on mount

  useEffect(() => {
    if (!chart || !candlestickSeries) return;

    const handleMouseMove = (e: PointerEvent) => {
      if (activeToolRef.current === 'hline' && chart && candlestickSeries && chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const price = candlestickSeries.coordinateToPrice(y);
        setPreviewPrice(price !== null ? price : null);
      }

      if (dragStateRef.current && dragStateRef.current.active && candlestickSeries && chart && chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const newPrice = candlestickSeries.coordinateToPrice(y);
        if (newPrice !== null) {
          drawingManager.update(dragStateRef.current.drawingId, {
            points: [{ time: 0, price: newPrice }]
          });
        }
      }
    };

    const handleMouseDown = (e: PointerEvent) => {
      if (activeToolRef.current !== 'cursor' || !candlestickSeries || !chartContainerRef.current) return;
      const rect = chartContainerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const price = candlestickSeries.coordinateToPrice(y);
      if (price === null) return;

      const hitLine = drawingManager.getAll()
        .filter(d => d.type === 'horizontal' && d.visible)
        .find(d => {
          const lineY = candlestickSeries.priceToCoordinate(d.points[0].price);
          return lineY !== null && Math.abs(y - lineY) <= 8;
        });

      if (hitLine) {
        drawingManager.select(hitLine.id);
        dragStateRef.current = { active: true, drawingId: hitLine.id, startPrice: price };
      } else {
        drawingManager.clearSelection();
      }
    };

    const handleMouseUp = () => {
      dragStateRef.current = null;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        drawingManager.removeSelected();
      }
    };

    if (chartContainerRef.current) {
      chartContainerRef.current.addEventListener('pointermove', handleMouseMove);
      chartContainerRef.current.addEventListener('pointerdown', handleMouseDown);
      window.addEventListener('pointerup', handleMouseUp);
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (chartContainerRef.current) {
        chartContainerRef.current.removeEventListener('pointermove', handleMouseMove);
        chartContainerRef.current.removeEventListener('pointerdown', handleMouseDown);
      }
      window.removeEventListener('pointerup', handleMouseUp);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [chart, candlestickSeries]);

  // Listen to drawing manager changes to trigger re-render
  useEffect(() => {
    const handleChange = () => {
      updateOverlays();
    };
    drawingManager.on('change', handleChange);
    drawingManager.on('select', handleChange);
    drawingManager.on('delete', handleChange);
    return () => {
      drawingManager.off('change', handleChange);
      drawingManager.off('select', handleChange);
      drawingManager.off('delete', handleChange);
    };
  }, []);

  // Sync Overlay Coordinates
  const updateOverlays = useCallback(() => {
    if (!chart || !candlestickSeries) return;
    const drawings = drawingManager.getAll()
      .filter(d => d.type === "horizontal")
      .map(d => ({
        id: d.id,
        y: candlestickSeries.priceToCoordinate(d.points[0].price),
        color: d.selected ? '#2962ff' : d.style.color,
        width: d.selected ? 3 : d.style.width,
        selected: d.selected
      }))
      .filter(d => d.y !== null);

    setRenderedDrawings(drawings);

    const newRendered = positions.map(pos => {
      const x = chart.timeScale().timeToCoordinate(pos.time);
      const entryY = candlestickSeries.priceToCoordinate(pos.price);
      const tpY = candlestickSeries.priceToCoordinate(pos.tp);
      const slY = candlestickSeries.priceToCoordinate(pos.sl);
      return { ...pos, x, entryY, tpY, slY };
    }).filter(p => p.x !== null && p.entryY !== null);
    setRenderedPositions(newRendered);
  }, [chart, candlestickSeries, positions]);

  useEffect(() => {
    if (!chart || !candlestickSeries) return;
    chart.timeScale().subscribeVisibleTimeRangeChange(updateOverlays);
    chart.timeScale().subscribeVisibleLogicalRangeChange(updateOverlays);
    // There is no subscribeVisiblePriceRangeChange natively, so we just run updateOverlays when scrolling/zooming
    chart.subscribeCrosshairMove(updateOverlays);
    
    updateOverlays();
    
    return () => {
      chart.timeScale().unsubscribeVisibleTimeRangeChange(updateOverlays);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(updateOverlays);
      chart.unsubscribeCrosshairMove(updateOverlays);
    };
  }, [chart, candlestickSeries, updateOverlays]);

  useEffect(() => {
    const fetchData = async () => {
      setIsDataLoaded(false);
      try {
        const res = await fetch(`/api/finance?symbol=${symbol}&interval=${activeTimeframe.interval}&range=${activeTimeframe.range}`);
        const data = await res.json();
        if (data && !data.error) {
          setHistoricalData(data);
          setVisibleData(data);
          setReplayIndex(data.length - 1);
          if (candlestickSeries && volumeSeries) {
            candlestickSeries.setData(data);
            volumeSeries.setData(data.map((d: any) => ({
              time: d.time,
              value: d.value,
              color: d.close > d.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
            })));
          }
          setIsDataLoaded(true);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
  }, [symbol, activeTimeframe, candlestickSeries, volumeSeries]);

  // Bar Replay Logic
  const startReplay = () => {
    if (replayIndex >= historicalData.length - 1) {
      // Reset to beginning if at the end
      setReplayIndex(0);
      setVisibleData([]);
    }
    setIsReplaying(true);
  };

  const pauseReplay = () => {
    setIsReplaying(false);
    if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
  };

  const stepForward = () => {
    if (replayIndex < historicalData.length - 1) {
      const nextIndex = replayIndex + 1;
      setReplayIndex(nextIndex);
      const nextCandle = historicalData[nextIndex];
      
      // OPTIMIZATION: Use update() instead of replacing the entire dataset via setData()
      if (candlestickSeries) candlestickSeries.update(nextCandle);
      if (volumeSeries) {
        volumeSeries.update({
          time: nextCandle.time,
          value: nextCandle.value,
          color: nextCandle.close > nextCandle.open ? 'rgba(38, 166, 154, 0.5)' : 'rgba(239, 83, 80, 0.5)'
        });
      }
    } else {
      pauseReplay();
    }
  };

  useEffect(() => {
    if (isReplaying) {
      replayIntervalRef.current = setInterval(() => {
        stepForward();
      }, 500); // 500ms per bar
    } else if (replayIntervalRef.current) {
      clearInterval(replayIntervalRef.current);
    }
    return () => {
      if (replayIntervalRef.current) clearInterval(replayIntervalRef.current);
    };
  }, [isReplaying, replayIndex, historicalData]);

  return (
    <div className="w-full h-full flex flex-col">
      {/* Toolbar */}
      <div className="h-12 bg-surface border-b border-gray-800 flex items-center px-4 gap-4 overflow-x-auto shrink-0 scrollbar-hide">
        
        {/* Timeframes */}
        <div className="flex items-center gap-1 border-r border-gray-700 pr-4">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.label}
              onClick={() => setActiveTimeframe(tf)}
              className={`px-2 py-1 text-sm rounded font-medium transition ${
                activeTimeframe.label === tf.label
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>

        {/* Drawing Tools */}
        <div className="flex gap-2 border-r border-gray-700 pr-4">
          <button 
            className={`p-2 rounded hover:bg-gray-700 transition ${activeTool === 'cursor' ? 'text-primary' : 'text-gray-400'}`}
            onClick={() => setActiveTool('cursor')}
            title="Cursor"
          >
            <Square className="w-4 h-4" />
          </button>
          <button 
            className={`p-2 rounded hover:bg-gray-700 transition ${activeTool === 'hline' ? 'text-primary' : 'text-gray-400'}`}
            onClick={() => setActiveTool('hline')}
            title="Horizontal Line"
          >
            <Minus className="w-4 h-4 font-bold" />
          </button>
          <button 
            className={`p-2 rounded hover:bg-gray-700 transition ${activeTool === 'long' ? 'text-success' : 'text-gray-400'}`}
            onClick={() => setActiveTool('long')}
            title="Long Position"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
          <button 
            className={`p-2 rounded hover:bg-gray-700 transition ${activeTool === 'short' ? 'text-danger' : 'text-gray-400'}`}
            onClick={() => setActiveTool('short')}
            title="Short Position"
          >
            <TrendingDown className="w-4 h-4" />
          </button>
        </div>

        {/* Bar Replay Controls */}
        <div className="flex items-center gap-2 bg-[#131722] p-1 rounded-md border border-gray-700">
          <span className="text-xs text-gray-400 font-semibold px-2 uppercase">Bar Replay</span>
          {!isReplaying ? (
            <button className="p-1.5 text-success hover:bg-gray-700 rounded transition" onClick={startReplay}>
              <Play className="w-4 h-4" />
            </button>
          ) : (
            <button className="p-1.5 text-danger hover:bg-gray-700 rounded transition" onClick={pauseReplay}>
              <Pause className="w-4 h-4" />
            </button>
          )}
          <button className="p-1.5 text-primary hover:bg-gray-700 rounded transition" onClick={() => { pauseReplay(); stepForward(); }}>
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
        
        {!isDataLoaded && <div className="text-sm text-yellow-500 animate-pulse ml-auto">Loading Data...</div>}
      </div>

      {/* Chart Area */}
      <div className="flex-1 w-full relative overflow-hidden">
        <div className="absolute inset-0 z-0" ref={chartContainerRef} />
        
        {/* Preview Ghost Line */}
        {previewPrice !== null && activeToolRef.current === 'hline' && candlestickSeries && (
          <div
            className="absolute left-0 right-0 pointer-events-none"
            style={{
              top: candlestickSeries.priceToCoordinate(previewPrice) || 0,
              height: '1px',
              background: 'rgba(41, 98, 255, 0.5)',
              borderTop: '1px dashed rgba(41, 98, 255, 0.5)'
            }}
          />
        )}

        {/* Horizontal Lines */}
        {renderedDrawings.map(line => (
          <div
            key={line.id}
            className="absolute left-0 right-0 group transition-all"
            style={{
              top: line.y,
              height: `${line.width}px`,
              background: line.color,
              pointerEvents: "auto",
              cursor: 'pointer',
              opacity: line.selected ? 1 : 0.7,
              boxShadow: line.selected ? `0 0 6px ${line.color}` : 'none'
            }}
          />
        ))}

        {/* Drawing Overlays */}
        <div className="absolute inset-0 z-10 pointer-events-none">
          {renderedPositions.map(pos => {
            if (pos.x === undefined || pos.entryY === undefined || pos.tpY === undefined || pos.slY === undefined) return null;
          
          const profitY = Math.min(pos.entryY, pos.tpY);
          const profitHeight = Math.abs(pos.entryY - pos.tpY);
          
          const lossY = Math.min(pos.entryY, pos.slY);
          const lossHeight = Math.abs(pos.entryY - pos.slY);

          // Standard TV styling for positions
          const profitColor = pos.type === 'long' ? 'rgba(38, 166, 154, 0.25)' : 'rgba(239, 83, 80, 0.25)';
          const lossColor = pos.type === 'long' ? 'rgba(239, 83, 80, 0.25)' : 'rgba(38, 166, 154, 0.25)';
          const profitBorder = pos.type === 'long' ? '#26a69a' : '#ef5350';
          const lossBorder = pos.type === 'long' ? '#ef5350' : '#26a69a';

          return (
            <div key={pos.id} className="absolute z-10 pointer-events-none flex flex-col" style={{ left: pos.x, top: 0, width: '120px' }}>
              {/* Profit Zone */}
              <div 
                className="absolute w-full border-l border-r"
                style={{ 
                  top: profitY, 
                  height: profitHeight, 
                  backgroundColor: profitColor,
                  borderColor: profitBorder,
                  borderTop: `2px solid ${profitBorder}`,
                  borderBottom: `2px solid ${profitBorder}`
                }}
              >
                <div className="text-[10px] p-1 text-white opacity-80 font-semibold drop-shadow-md">
                  Target: {pos.tp.toFixed(2)}
                </div>
              </div>
              
              {/* Loss Zone */}
              <div 
                className="absolute w-full border-l border-r"
                style={{ 
                  top: lossY, 
                  height: lossHeight, 
                  backgroundColor: lossColor,
                  borderColor: lossBorder,
                  borderBottom: `2px solid ${lossBorder}`,
                  borderTop: `2px solid ${lossBorder}`
                }}
              >
                <div className="text-[10px] p-1 text-white opacity-80 font-semibold drop-shadow-md">
                  Stop: {pos.sl.toFixed(2)}
                </div>
              </div>
              
              {/* Entry Line */}
              <div 
                className="absolute w-full h-[2px] bg-white opacity-50"
                style={{ top: pos.entryY - 1 }}
              />
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}
