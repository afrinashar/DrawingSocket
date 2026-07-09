import React, { useRef, useEffect, useState } from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import io from 'socket.io-client';
import './App.css';
import { FaDownload } from "react-icons/fa";
import { FiZoomIn, FiZoomOut } from "react-icons/fi";
import { SlActionUndo } from "react-icons/sl";
import { IoArrowRedoOutline, IoRemoveOutline } from "react-icons/io5";
import { LuEraser } from "react-icons/lu";
import { FaMagic, FaPaintBrush, FaCircle } from "react-icons/fa";
import { MdRectangle } from "react-icons/md";
import { TbLineDashed } from "react-icons/tb";
import { TfiLineDotted } from "react-icons/tfi";
import { FaPencil } from "react-icons/fa6";
import { AiOutlineDelete } from "react-icons/ai";

const socket = io('https://drawingsocket-backend.onrender.com/', { transports: ['websocket'] });

const App = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('brush');
  const [color, setColor] = useState('black');
  const [lineWidth, setLineWidth] = useState(2);
  const [opacity, setOpacity] = useState(1);
  const [brushType, setBrushType] = useState('normal');
  const [prevPos, setPrevPos] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState([]);
  const [redoList, setRedoList] = useState([]);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const savedHistory = JSON.parse(localStorage.getItem('drawingHistory')) || [];
    setHistory(savedHistory);
    
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    // Load the last saved image if available
    if (savedHistory.length > 0) {
      const image = new Image();
      image.src = savedHistory[savedHistory.length - 1];
      image.onload = () => {
        context.drawImage(image, 0, 0);
      };
    }

    socket.on('drawing', ({ x0, y0, x1, y1, color, lineWidth, opacity, brushType, shape }) => {
      if (shape) {
        drawShape(context, shape, x0, y0, x1, y1, color, lineWidth, opacity);
      } else {
        drawLine(context, x0, y0, x1, y1, color, lineWidth, opacity, brushType);
      }
    });

    return () => {
      socket.off('drawing');
    };
  }, []);

  const drawLine = (context, x0, y0, x1, y1, color, lineWidth, opacity, brushType) => {
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.globalAlpha = opacity;

    if (brushType === 'dotted') {
      context.setLineDash([5, 15]);
    } else {
      context.setLineDash([]);
    }

    context.stroke();
    context.closePath();
  };

  const drawShape = (context, shape, x0, y0, x1, y1, color, lineWidth, opacity) => {
    context.beginPath();
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.globalAlpha = opacity;

    switch (shape) {
      case 'rectangle':
        context.rect(x0, y0, x1 - x0, y1 - y0);
        break;
      case 'circle':
        const radius = Math.sqrt((x1 - x0) ** 2 + (y1 - y0) ** 2);
        context.arc(x0, y0, radius, 0, 2 * Math.PI);
        break;
      case 'line':
        context.moveTo(x0, y0);
        context.lineTo(x1, y1);
        break;
      default:
        break;
    }

    context.stroke();
    context.closePath();
  };

  const handleMouseDown = (event) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    setPrevPos({ x: (event.clientX - rect.left) / scale, y: (event.clientY - rect.top) / scale });
  };

  const handleMouseUp = (event) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x1 = (event.clientX - rect.left) / scale;
    const y1 = (event.clientY - rect.top) / scale;

    if (tool !== 'brush') {
      drawShape(context, tool, prevPos.x, prevPos.y, x1, y1, color, lineWidth, opacity);
      socket.emit('drawing', { x0: prevPos.x, y0: prevPos.y, x1, y1, color, lineWidth, opacity, shape: tool });
    }

    const imageData = canvas.toDataURL();
    const newHistory = [...history, imageData];
    setHistory(newHistory);
    setRedoList([]);
    
    // Save the new history to local storage
    localStorage.setItem('drawingHistory', JSON.stringify(newHistory));
  };

  const handleMouseMove = (event) => {
    if (!isDrawing || tool !== 'brush') return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x0 = prevPos.x;
    const y0 = prevPos.y;
    const x1 = (event.clientX - rect.left) / scale;
    const y1 = (event.clientY - rect.top) / scale;

    drawLine(canvas.getContext('2d'), x0, y0, x1, y1, color, lineWidth, opacity, brushType);
    socket.emit('drawing', { x0, y0, x1, y1, color, lineWidth, opacity, brushType });
    setPrevPos({ x: x1, y: y1 });
  };

  const handleColorChange = (event) => {
    setColor(event.target.value);
  };

  const handleBrushSizeChange = (event) => {
    setLineWidth(event.target.value);
  };

  const handleOpacityChange = (event) => {
    setOpacity(event.target.value);
  };

  const handleBrushTypeChange = (event) => {
    setBrushType(event.target.value);
  };

  const handleToolChange = (tool) => {
    setTool(tool);
    setCursorForTool(tool);
  };

  const setCursorForTool = (tool) => {
    const canvas = canvasRef.current;
    switch (tool) {
      case 'brush':
        canvas.style.cursor = 'crosshair';
        break;
      case 'eraser':
        canvas.style.cursor = 'url(eraser-icon.png), auto';
        break;
      case 'rectangle':
      case 'circle':
      case 'line':
        canvas.style.cursor = 'cell';
        break;
      default:
        canvas.style.cursor = 'default';
        break;
    }
  };

  const handleEraser = () => {
    handleToolChange('eraser');
    setColor('#2B353E');
    setBrushType('normal');
  };

  const handleSmartEraser = () => {
    handleToolChange('eraser');
    setColor('rgba(255, 255, 255, 0.5)');
    setBrushType('normal');
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const newHistory = [...history];
    const lastAction = newHistory.pop();
    setRedoList([lastAction, ...redoList]);
    setHistory(newHistory);

    // Save updated history to local storage
    localStorage.setItem('drawingHistory', JSON.stringify(newHistory));

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const image = new Image();
    image.src = newHistory[newHistory.length - 1] || '';
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
    };
  };

  const handleRedo = () => {
    if (redoList.length === 0) return;
    const newRedoList = [...redoList];
    const lastUndo = newRedoList.shift();
    setHistory([...history, lastUndo]);
    setRedoList(newRedoList);

    // Save updated history to local storage
    localStorage.setItem('drawingHistory', JSON.stringify([...history, lastUndo]));

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    const image = new Image();
    image.src = lastUndo;
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
    };
  };

  const handleDelete = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    setHistory([]);
    setRedoList([]);
    localStorage.removeItem('drawingHistory');
  };
  const handleDownload = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'drawing.png';
    link.href = canvas.toDataURL();
    link.click();
  };
  const handleZoomIn = () => {
    setScale(scale + 0.1);
  };

  const handleZoomOut = () => {
    if (scale > 0.1) {
      setScale(scale - 0.1);
    }
  };

  return (
    <div className="App d-flex">
 
           <div className="toolbar d-flex flex-column">
           <p className='text-light'>Color</p>
        <input type="color" value={color} onChange={handleColorChange} className="color-picker" />
        <p  className='text-light'>size </p>
        <input
          type="range"
          min="1"
          max="20"
          value={lineWidth}
        
        className='mb-3 bg-light'  onChange={handleBrushSizeChange}
        />
        <p className='text-light'>Opacity</p>
        <input type="range" min="0.1" max="1" step="0.1" value={opacity} onChange={handleOpacityChange} className="form-range mb-3" />
        <p className='text-light'>Brush Type</p>
        <select value={brushType} onChange={handleBrushTypeChange} className="form-select mb-3">
          <option value="normal">Normal</option>
          <option value="dotted">Dotted</option>
        </select>
        <button onClick={() => handleToolChange('brush')}><FaPaintBrush /></button>
        <button onClick={handleEraser}><LuEraser /></button>
        <button onClick={() => handleToolChange('rectangle')}><MdRectangle /></button>
        <button onClick={() => handleToolChange('circle')}><FaCircle /></button>
        <button onClick={() => handleToolChange('line')}><TfiLineDotted /></button>
        <button onClick={handleUndo}><SlActionUndo /></button>
        <button onClick={handleRedo}><IoArrowRedoOutline /></button>
        <button onClick={handleDelete}><AiOutlineDelete /></button>
        <button onClick={handleZoomIn}><FiZoomIn /></button>
        <button onClick={handleZoomOut}><FiZoomOut /></button>
        <button onClick={handleDownload}><FaDownload /></button>
       </div> 
      <canvas
        ref={canvasRef}
        width={800 * scale}
        height={600 * scale}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      />
      
    </div>
  );
};

export default App;
