import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'next-i18next';

interface SignatureCanvasProps {
  onChange: (signatureData: string) => void;
  value?: string;
  height?: number;
  width?: number;
  className?: string;
  disabled?: boolean;
}

/**
 * Digital signature component that allows drawing a signature with mouse or touch
 */
const SignatureCanvas: React.FC<SignatureCanvasProps> = ({
  onChange,
  value,
  height = 150,
  width = 400,
  className = '',
  disabled = false
}) => {
  const { t } = useTranslation('common');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  // Initialize canvas when component mounts or value changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // Set up canvas dimensions
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Scale for high DPI displays
    ctx.scale(dpr, dpr);
    
    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw signature from value if provided
    if (value && value.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
        setHasSignature(true);
      };
      img.src = value;
    } else {
      setHasSignature(false);
    }
    
    // Set line style
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000000';
  }, [value, width, height]);

  // Start drawing
  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    setIsDrawing(true);
    
    // Get mouse/touch position
    const pos = getEventPosition(e, canvas);
    setLastPos(pos);
    
    // Draw a small dot at the starting point
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 1, 0, 2 * Math.PI);
    ctx.fill();
  };

  // Draw when mouse/touch moves
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get current position
    const currentPos = getEventPosition(e, canvas);
    
    // Draw line from last position to current position
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();
    
    setLastPos(currentPos);
    setHasSignature(true);
  };

  // Stop drawing
  const stopDrawing = () => {
    if (isDrawing) {
      setIsDrawing(false);
      
      if (hasSignature) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        // Convert canvas to data URL and call onChange
        const signatureData = canvas.toDataURL('image/png');
        onChange(signatureData);
      }
    }
  };

  // Clear the signature
  const clearSignature = () => {
    if (disabled) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    setHasSignature(false);
    onChange('');
  };

  // Helper function to get mouse/touch position
  const getEventPosition = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    let clientX, clientY;
    
    // Handle both mouse and touch events
    if ('touches' in e) {
      // Touch event
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      // Mouse event
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  };

  return (
    <div className={`signature-canvas-container ${className}`}>
      <div className="relative border border-gray-300 rounded-md bg-white">
        <canvas
          ref={canvasRef}
          className="touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        
        {!hasSignature && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-gray-400 italic text-sm">
            {t('signature.sign_here', 'Sign here...')}
          </div>
        )}
        
        {disabled && hasSignature && (
          <div className="absolute top-2 right-2 rounded-full bg-green-100 text-green-800 px-2 py-1 text-xs font-medium">
            {t('signature.verified', 'Verified')}
          </div>
        )}
      </div>
      
      {!disabled && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={clearSignature}
            disabled={!hasSignature}
            className="px-3 py-1 bg-gray-100 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('signature.clear', 'Clear')}
          </button>
        </div>
      )}
    </div>
  );
};

export default SignatureCanvas;