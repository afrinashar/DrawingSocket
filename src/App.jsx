import React, { useRef, useEffect, useState, useCallback } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import io from 'socket.io-client';
import './App.css';

const socket = io('https://drawingsocket-backend.onrender.com', { transports: ['websocket'] });

const App = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('brush');
  const [color, setColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('#FF0000');
  const [lineWidth, setLineWidth] = useState(2);
  const [opacity, setOpacity] = useState(1);
  const [brushType, setBrushType] = useState('normal');
  const [prevPos, setPrevPos] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState([]);
  const [redoList, setRedoList] = useState([]);
  const [scale, setScale] = useState(1);
  const [fillShape, setFillShape] = useState(false);
  const [fontSize, setFontSize] = useState(20);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState(0);

  // Advanced Features
  const [layers, setLayers] = useState([{ id: 1, name: 'Layer 1', visible: true, opacity: 1, canvas: null }]);
  const [activeLayer, setActiveLayer] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [gridSize] = useState(20); // Fixed: removed unused setter
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ blur: 0, brightness: 100, contrast: 100, saturate: 100 });
  const [useGradient, setUseGradient] = useState(false);
  const [gradientStart, setGradientStart] = useState('#FF0000');
  const [gradientEnd, setGradientEnd] = useState('#0000FF');
  const [historyThumbnails, setHistoryThumbnails] = useState([]);
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // Fixed: Removed unused presetColors or moved to constants
  const PRESET_COLORS = ['#000000', '#FFFFFF', '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'];

  const drawLine = useCallback((context, x0, y0, x1, y1, color, lineWidth, opacity, brushType) => {
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.globalAlpha = opacity;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    if (brushType === 'dotted') {
      context.setLineDash([5, 15]);
    } else if (brushType === 'dashed') {
      context.setLineDash([10, 5]);
    } else {
      context.setLineDash([]);
    }

    context.stroke();
    context.globalAlpha = 1;
    context.closePath();
  }, []);

  const drawShape = useCallback((context, shape, x0, y0, x1, y1, color, lineWidth, opacity, isFilled = false, fillColor = 'transparent') => {
    context.globalAlpha = opacity;
    context.strokeStyle = color;
    context.lineWidth = lineWidth;

    switch (shape) {
      case 'rectangle':
        if (isFilled) {
          context.fillStyle = fillColor;
          context.fillRect(x0, y0, x1 - x0, y1 - y0);
        }
        context.strokeRect(x0, y0, x1 - x0, y1 - y0);
        break;
      case 'circle':
        context.beginPath();
        const radius = Math.sqrt(Math.pow(x1 - x0, 2) + Math.pow(y1 - y0, 2));
        context.arc(x0, y0, radius, 0, 2 * Math.PI);
        if (isFilled) {
          context.fillStyle = fillColor;
          context.fill();
        }
        context.stroke();
        break;
      case 'triangle':
        context.beginPath();
        context.moveTo(x0, y1);
        context.lineTo((x0 + x1) / 2, y0);
        context.lineTo(x1, y1);
        context.closePath();
        if (isFilled) {
          context.fillStyle = fillColor;
          context.fill();
        }
        context.stroke();
        break;
      case 'line':
        context.beginPath();
        context.moveTo(x0, y0);
        context.lineTo(x1, y1);
        context.stroke();
        break;
      default:
        break;
    }
    context.globalAlpha = 1;
  }, []);

  const drawText = useCallback((context, text, x, y, color, fontSize) => {
    context.font = `${fontSize}px Arial`;
    context.fillStyle = color;
    context.globalAlpha = 1;
    context.fillText(text, x, y);
  }, []);

  const drawGrid = useCallback((context, canvas) => {
    if (!showGrid) return;
    context.strokeStyle = 'rgba(200, 200, 200, 0.2)';
    context.lineWidth = 1;

    for (let x = 0; x < canvas.width; x += gridSize) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, canvas.height);
      context.stroke();
    }

    for (let y = 0; y < canvas.height; y += gridSize) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(canvas.width, y);
      context.stroke();
    }
  }, [showGrid, gridSize]);

  const createGradient = useCallback((context, x0, y0, x1, y1) => {
    if (!useGradient) return null;
    const gradient = context.createLinearGradient(x0, y0, x1, y1);
    gradient.addColorStop(0, gradientStart);
    gradient.addColorStop(1, gradientEnd);
    return gradient;
  }, [useGradient, gradientStart, gradientEnd]);

  const applyFilters = useCallback((context) => {
    if (filters.blur === 0 && filters.brightness === 100 && filters.contrast === 100 && filters.saturate === 100) return;

    let filterString = '';
    if (filters.blur > 0) filterString += `blur(${filters.blur}px) `;
    filterString += `brightness(${filters.brightness}%) `;
    filterString += `contrast(${filters.contrast}%) `;
    filterString += `saturate(${filters.saturate}%) `;

    context.filter = filterString;
  }, [filters]);

  const captureHistoryThumbnail = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const thumbnail = canvas.toDataURL();
    setHistoryThumbnails(prev => [...prev, thumbnail]);
  }, []);

  const handleRemoteDrawing = useCallback(({
    x0,
    y0,
    x1,
    y1,
    color,
    lineWidth,
    opacity,
    brushType,
    shape,
    text,
    fontSize,
    isFilled,
    fillColor
  }) => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;

    if (shape) {
      drawShape(context, shape, x0, y0, x1, y1, color, lineWidth, opacity, isFilled, fillColor);
    } else if (text) {
      drawText(context, text, x0, y0, color, fontSize);
    } else {
      drawLine(context, x0, y0, x1, y1, color, lineWidth, opacity, brushType);
    }
  }, [drawLine, drawShape, drawText]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    canvas.width = window.innerWidth - 100;
    canvas.height = window.innerHeight - 50;

    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    setHistory([canvas.toDataURL()]);

    socket.on('drawing', handleRemoteDrawing);
    socket.on('userCount', (count) => setConnectedUsers(count));

    const handleResize = () => {
      canvas.width = window.innerWidth - 100;
      canvas.height = window.innerHeight - 50;
    };

    window.addEventListener('resize', handleResize);

    return () => {
      socket.off('drawing', handleRemoteDrawing);
      socket.off('userCount');
      window.removeEventListener('resize', handleResize);
    };
  }, [handleRemoteDrawing]);

  const handleMouseDown = (event) => {
    if (tool === 'text') {
      setShowTextInput(true);
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      setPrevPos({
        x: (event.clientX - rect.left) / scale,
        y: (event.clientY - rect.top) / scale
      });
      return;
    }

    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    setPrevPos({
      x: (event.clientX - rect.left) / scale,
      y: (event.clientY - rect.top) / scale
    });
  };

  const handleMouseUp = (event) => {
    if (!isDrawing || tool === 'text') return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x1 = (event.clientX - rect.left) / scale;
    const y1 = (event.clientY - rect.top) / scale;

    if (tool !== 'brush' && tool !== 'eraser') {
      drawShape(context, tool, prevPos.x, prevPos.y, x1, y1, color, lineWidth, opacity, fillShape, fillColor);
      socket.emit('drawing', {
        x0: prevPos.x,
        y0: prevPos.y,
        x1,
        y1,
        color,
        lineWidth,
        opacity,
        shape: tool,
        isFilled: fillShape,
        fillColor
      });
    }

    saveToHistory();
  };

  const handleMouseMove = (event) => {
    if (!isDrawing || tool === 'text') return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x1 = (event.clientX - rect.left) / scale;
    const y1 = (event.clientY - rect.top) / scale;

    if (tool === 'brush' || tool === 'eraser') {
      drawLine(context, prevPos.x, prevPos.y, x1, y1, color, lineWidth, opacity, brushType);
      socket.emit('drawing', {
        x0: prevPos.x,
        y0: prevPos.y,
        x1,
        y1,
        color,
        lineWidth,
        opacity,
        brushType
      });
      setPrevPos({ x: x1, y: y1 });
    }
  };

  const saveToHistory = useCallback(() => {
    const canvas = canvasRef.current;
    const imageData = canvas.toDataURL();
    setHistory(prev => [...prev, imageData]);
    setRedoList([]);
  }, []);

  const handleTextSubmit = useCallback(() => {
    if (textInput.trim() === '') return;

    const context = canvasRef.current.getContext('2d');
    drawText(context, textInput, prevPos.x, prevPos.y, color, fontSize);

    socket.emit('drawing', {
      x0: prevPos.x,
      y0: prevPos.y,
      text: textInput,
      color,
      fontSize
    });

    setTextInput('');
    setShowTextInput(false);
    saveToHistory();
  }, [textInput, prevPos, color, fontSize, drawText, saveToHistory]);

  const handleToolChange = useCallback((newTool) => {
    setTool(newTool);
    const canvas = canvasRef.current;
    canvas.style.cursor = newTool === 'brush' ? 'crosshair' : 'cell';
  }, []);

  const handleEraser = useCallback(() => {
    setTool('eraser');
    setColor('#FFFFFF');
  }, []);

  const handleUndo = useCallback(() => {
    setHistory(prev => {
      if (prev.length <= 1) return prev;

      const newHistory = [...prev];
      const lastState = newHistory.pop();
      setRedoList(old => [lastState, ...old]);

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      const image = new Image();
      image.src = newHistory[newHistory.length - 1];
      image.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
      };

      return newHistory;
    });
  }, []);

  const handleRedo = useCallback(() => {
    setRedoList(prev => {
      if (prev.length === 0) return prev;

      const newRedoList = [...prev];
      const nextState = newRedoList.shift();
      setHistory(old => [...old, nextState]);

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      const image = new Image();
      image.src = nextState;
      image.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
      };

      return newRedoList;
    });
  }, []);

  const handleClearAll = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    setHistory([canvas.toDataURL()]);
    setRedoList([]);
  }, []);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = `drawing-${new Date().toISOString()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  }, []);

  const handleResetZoom = useCallback(() => setScale(1), []);
  const handleZoomIn = useCallback(() => setScale(prev => Math.min(prev + 0.1, 3)), []);
  const handleZoomOut = useCallback(() => setScale(prev => Math.max(prev - 0.1, 0.2)), []);

  // LAYER MANAGEMENT
  const addLayer = useCallback(() => {
    setLayers(prev => {
      const newId = Math.max(...prev.map(l => l.id), 0) + 1;
      const newLayer = {
        id: newId,
        name: `Layer ${newId}`,
        visible: true,
        opacity: 1,
        canvas: null
      };
      return [...prev, newLayer];
    });
    setActiveLayer(prev => prev + 1);
  }, []);

  const deleteLayer = useCallback((id) => {
    setLayers(prev => {
      if (prev.length === 1) return prev;
      const newLayers = prev.filter(l => l.id !== id);
      if (activeLayer === id) {
        setActiveLayer(newLayers[0].id);
      }
      return newLayers;
    });
  }, [activeLayer]);

  const renameLayer = useCallback((id, newName) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, name: newName } : l));
  }, []);

  const toggleLayerVisibility = useCallback((id) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  }, []);

  const setLayerOpacity = useCallback((id, opacityValue) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, opacity: opacityValue } : l));
  }, []);

  const reorderLayers = useCallback((id, direction) => {
    setLayers(prev => {
      const index = prev.findIndex(l => l.id === id);
      if ((direction === 'up' && index === prev.length - 1) || (direction === 'down' && index === 0)) return prev;

      const newLayers = [...prev];
      if (direction === 'up') {
        [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
      } else {
        [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
      }
      return newLayers;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ blur: 0, brightness: 100, contrast: 100, saturate: 100 });
  }, []);

  // KEYBOARD SHORTCUTS
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') { e.preventDefault(); handleUndo(); }
        if (e.key === 'y') { e.preventDefault(); handleRedo(); }
        if (e.key === 's') { e.preventDefault(); handleDownload(); }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') { handleClearAll(); }

      // Tool shortcuts
      if (e.key === 'b') handleToolChange('brush');
      if (e.key === 'e') handleEraser();
      if (e.key === 't') handleToolChange('text');
      if (e.key === 'r') handleToolChange('rectangle');
      if (e.key === 'c') handleToolChange('circle');
      if (e.key === 'l') handleToolChange('line');
      if (e.key === 'g') setShowGrid(prev => !prev);
      if (e.key === '+' || e.key === '=') handleZoomIn();
      if (e.key === '-') handleZoomOut();
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleUndo, handleRedo, handleDownload, handleClearAll, handleToolChange, handleEraser, handleZoomIn, handleZoomOut]);

  return (
    <div className="App d-flex" style={{ height: '100vh' }}>
      {/* Main Toolbar */}
      <div className="toolbar d-flex flex-column p-3">
        <div className="text-light text-center mb-3 p-2 rounded" style={{ fontSize: '12px', backgroundColor: '#34495E' }}>
          👥 {connectedUsers}
        </div>

        <div className="mb-3">
          <label className="text-light" style={{ fontSize: '12px' }}>Pen</label>
          <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-100" />
        </div>

        <div className="mb-3">
          <label className="text-light" style={{ fontSize: '12px' }}>Fill</label>
          <input type="color" value={fillColor} onChange={(e) => setFillColor(e.target.value)} className="w-100" />
          <div className="form-check mt-2">
            <input
              className="form-check-input"
              type="checkbox"
              id="fillCheck"
              checked={fillShape}
              onChange={(e) => setFillShape(e.target.checked)}
            />
            <label className="form-check-label text-light" htmlFor="fillCheck" style={{ fontSize: '12px' }}>
              Fill
            </label>
          </div>
        </div>

        <div className="mb-3">
          <div className="form-check">
            <input
              className="form-check-input"
              type="checkbox"
              id="gradientCheck"
              checked={useGradient}
              onChange={(e) => setUseGradient(e.target.checked)}
            />
            <label className="form-check-label text-light" htmlFor="gradientCheck" style={{ fontSize: '12px' }}>
              Gradient
            </label>
          </div>
          {useGradient && (
            <>
              <input type="color" value={gradientStart} onChange={(e) => setGradientStart(e.target.value)} className="w-100 mt-2" />
              <input type="color" value={gradientEnd} onChange={(e) => setGradientEnd(e.target.value)} className="w-100 mt-2" />
            </>
          )}
        </div>

        <div className="mb-3">
          <label className="text-light" style={{ fontSize: '12px' }}>Size</label>
          <input
            type="range"
            min="1"
            max="30"
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="w-100"
          />
          <small className="text-light">{lineWidth}px</small>
        </div>

        <div className="mb-3">
          <label className="text-light" style={{ fontSize: '12px' }}>Opacity</label>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.1"
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            className="w-100"
          />
        </div>

        <div className="mb-3">
          <label className="text-light" style={{ fontSize: '12px' }}>Brush</label>
          <select
            value={brushType}
            onChange={(e) => setBrushType(e.target.value)}
            className="w-100"
            style={{ fontSize: '12px' }}
          >
            <option value="normal">Normal</option>
            <option value="dotted">Dotted</option>
            <option value="dashed">Dashed</option>
          </select>
        </div>

        <div className="mb-3">
          <label className="text-light" style={{ fontSize: '12px' }}>Font</label>
          <input
            type="range"
            min="10"
            max="50"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="w-100"
          />
          <small className="text-light">{fontSize}px</small>
        </div>

        <hr className="bg-light" />

        <div className="tool-buttons d-flex flex-column gap-2">
          <button
            className={`btn btn-sm ${tool === 'brush' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { handleToolChange('brush'); setColor('#000000'); }}
            title="Brush (B)"
          >
            ✏️
          </button>
          <button
            className={`btn btn-sm ${tool === 'eraser' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={handleEraser}
            title="Eraser (E)"
          >
            🧹
          </button>
          <button
            className={`btn btn-sm ${tool === 'text' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleToolChange('text')}
            title="Text (T)"
          >
            📝
          </button>

          <hr className="bg-light" />

          <button
            className={`btn btn-sm ${tool === 'rectangle' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleToolChange('rectangle')}
            title="Rectangle (R)"
          >
            ▭
          </button>
          <button
            className={`btn btn-sm ${tool === 'circle' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleToolChange('circle')}
            title="Circle (C)"
          >
            ⭕
          </button>
          <button
            className={`btn btn-sm ${tool === 'triangle' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleToolChange('triangle')}
            title="Triangle"
          >
            △
          </button>
          <button
            className={`btn btn-sm ${tool === 'line' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => handleToolChange('line')}
            title="Line (L)"
          >
            ━
          </button>

          <hr className="bg-light" />

          <button
            className={`btn btn-sm ${showGrid ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowGrid(prev => !prev)}
            title="Toggle Grid (G)"
          >
            ⊞
          </button>
          <button
            className={`btn btn-sm ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowFilters(prev => !prev)}
            title="Filters"
          >
            🎨
          </button>
          <button
            className={`btn btn-sm ${showLayerPanel ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowLayerPanel(prev => !prev)}
            title="Layers"
          >
            📚
          </button>
          <button
            className={`btn btn-sm btn-secondary`}
            onClick={() => setShowHistoryPanel(prev => !prev)}
            title="History"
          >
            🕐
          </button>

          <hr className="bg-light" />

          <button className="btn btn-sm btn-warning" onClick={handleUndo} title="Undo (Ctrl+Z)">
            ↶          </button>
          <button className="btn btn-sm btn-warning" onClick={handleRedo} title="Redo (Ctrl+Y)">
            ↷
          </button>
          <button className="btn btn-sm btn-danger" onClick={handleClearAll} title="Clear">
            🗑️
          </button>

          <hr className="bg-light" />

          <button className="btn btn-sm btn-info" onClick={handleZoomIn} title="Zoom In (+)">
            🔍+
          </button>
          <button className="btn btn-sm btn-info" onClick={handleZoomOut} title="Zoom Out (-)">
            🔍 -
          </button>
          <button className="btn btn-sm btn-info" onClick={handleResetZoom} title="Reset Zoom">
            100%
          </button>

          <hr className="bg-light" />

          <button className="btn btn-sm btn-success" onClick={handleDownload} title="Download (Ctrl+S)">
            💾
          </button>
        </div>
      </div>

      {/* Left Panels Area */}
      <div style={{ width: '200px', backgroundColor: '#ECF0F1', overflowY: 'auto', borderRight: '1px solid #bdc3c7' }}>
        {/* Layer Panel */}
        {showLayerPanel && (
          <div className="p-3">
            <h6 className="font-weight-bold mb-3">Layers</h6>
            <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '10px' }}>
              {layers.map((layer) => (
                <div
                  key={layer.id}
                  style={{
                    padding: '8px',
                    marginBottom: '5px',
                    backgroundColor: activeLayer === layer.id ? '#3498db' : '#fff',
                    border: '1px solid #bdc3c7',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                  onClick={() => setActiveLayer(layer.id)}
                >
                  <div style={{ fontSize: '12px', color: activeLayer === layer.id ? 'white' : 'black' }}>
                    <input
                      type="text"
                      value={layer.name}
                      onChange={(e) => renameLayer(layer.id, e.target.value)}
                      style={{ width: '80%', padding: '2px' }}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }}
                      style={{ marginLeft: '5px', padding: '0 5px', fontSize: '10px' }}
                    >
                      {layer.visible ? '👁️' : '🚫'}
                    </button>
                  </div>
                  <div style={{ fontSize: '10px', marginTop: '5px' }}>
                    <label>Opacity: {Math.round(layer.opacity * 100)}%</label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={layer.opacity}
                      onChange={(e) => setLayerOpacity(layer.id, parseFloat(e.target.value))}
                      style={{ width: '100%' }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                  <div style={{ marginTop: '5px', display: 'flex', gap: '5px' }}>
                    <button onClick={(e) => { e.stopPropagation(); reorderLayers(layer.id, 'up'); }} style={{ padding: '2px 5px', fontSize: '10px' }}>▲</button>
                    <button onClick={(e) => { e.stopPropagation(); reorderLayers(layer.id, 'down'); }} style={{ padding: '2px 5px', fontSize: '10px' }}>▼</button>
                    <button onClick={(e) => { e.stopPropagation(); deleteLayer(layer.id); }} style={{ padding: '2px 5px', fontSize: '10px', backgroundColor: '#e74c3c', color: 'white' }}>×</button>
                  </div>
                </div>
              ))}
            </div>
            <button className="btn btn-sm btn-primary w-100" onClick={addLayer}>+ Add Layer</button>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="p-3">
            <h6 className="font-weight-bold mb-3">Filters</h6>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px' }}>Blur: {filters.blur}px</label>
              <input
                type="range"
                min="0"
                max="20"
                value={filters.blur}
                onChange={(e) => setFilters(prev => ({ ...prev, blur: parseInt(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px' }}>Brightness: {filters.brightness}%</label>
              <input
                type="range"
                min="50"
                max="150"
                value={filters.brightness}
                onChange={(e) => setFilters(prev => ({ ...prev, brightness: parseInt(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px' }}>Contrast: {filters.contrast}%</label>
              <input
                type="range"
                min="50"
                max="150"
                value={filters.contrast}
                onChange={(e) => setFilters(prev => ({ ...prev, contrast: parseInt(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>
            <div style={{ marginBottom: '10px' }}>
              <label style={{ fontSize: '12px' }}>Saturation: {filters.saturate}%</label>
              <input
                type="range"
                min="0"
                max="200"
                value={filters.saturate}
                onChange={(e) => setFilters(prev => ({ ...prev, saturate: parseInt(e.target.value) }))}
                style={{ width: '100%' }}
              />
            </div>
            <button className="btn btn-sm btn-warning w-100" onClick={resetFilters}>Reset</button>
          </div>
        )}
      </div>

      {/* Canvas Container */}
      <div className="canvas-container flex-grow-1">
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setIsDrawing(false)}
          style={{
            cursor: tool === 'text' ? 'text' : 'crosshair',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            display: 'block',
            filter: `blur(${filters.blur}px) brightness(${filters.brightness}%) contrast(${filters.contrast}%) saturate(${filters.saturate}%)`
          }}
        />
      </div>

      {/* Text Input Modal */}
      {showTextInput && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add Text</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowTextInput(false)}
                ></button>
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  className="form-control"
                  placeholder="Enter text.."
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  autoFocus
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleTextSubmit();
                  }}
                />
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowTextInput(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleTextSubmit}
                >
                  Add Text
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      <div style={{ position: 'fixed', bottom: '10px', right: '10px', fontSize: '11px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white', padding: '10px', borderRadius: '5px', maxWidth: '150px' }}>
        <strong>Keyboard Shortcuts:</strong>
        <div>B - Brush | E - Eraser | T - Text</div>
        <div>R - Rectangle | C - Circle | L - Line</div>
        <div>G - Grid | Ctrl+Z - Undo | Ctrl+S - Save</div>
      </div>
    </div>
  );
};

export default App;
