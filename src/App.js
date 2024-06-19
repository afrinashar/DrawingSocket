import React, { useRef, useEffect, useState } from 'react';
import io from 'socket.io-client';
import './App.css';

const socket = io('https://drawingsocket-backend.onrender.com', { transports : ['websocket'] });; // Ensure this URL matches your server URL

const App = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('black');
  const [lineWidth, setLineWidth] = useState(2);
  const [prevPos, setPrevPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    socket.on('drawing', ({ x0, y0, x1, y1, color, lineWidth }) => {
      drawLine(context, x0, y0, x1, y1, color, lineWidth);
    });

    return () => {
      socket.off('drawing');
    };
  }, []);

  const drawLine = (context, x0, y0, x1, y1, color, lineWidth) => {
    context.beginPath();
    context.moveTo(x0, y0);
    context.lineTo(x1, y1);
    context.strokeStyle = color;
    context.lineWidth = lineWidth;
    context.stroke();
    context.closePath();
  };

  const handleMouseDown = (event) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    setPrevPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
  };

  const handleMouseMove = (event) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x0 = prevPos.x;
    const y0 = prevPos.y;
    const x1 = event.clientX - rect.left;
    const y1 = event.clientY - rect.top;

    drawLine(canvas.getContext('2d'), x0, y0, x1, y1, color, lineWidth);
    socket.emit('drawing', { x0, y0, x1, y1, color, lineWidth });
    setPrevPos({ x: x1, y: y1 });
  };

  const handleColorChange = (event) => {
    setColor(event.target.value);
  };

  const handleEraser = () => {
    setColor('white');
    setLineWidth(10);  
  };

  return (
    <div className="App">
      <div className="toolbar">
        <input type="color" value={color} onChange={handleColorChange} />
        <button onClick={handleEraser}>Eraser</button>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      />
    </div>
  );
};

export default App;
