
import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  ArrowLeft, 
  RotateCcw, 
  Download, 
  Eye, 
  Save, 
  Check, 
  Upload,
  Pencil,
  Minus,
  Eraser,
  Trash2,
  Move,
  Image as ImageIcon,
  Grid3X3,
  Undo
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { toPng, toSvg } from 'html-to-image';

// 默认配置 - 更新为符合用户规格的精确值
const defaultConfig = {
  backgroundColor: '#2d2d2d', // 深灰色/炭灰色
  lineColor: '#FFD700', // 亮黄色
  lineWidth: 16, // 约 2.5% 的 640px 宽度
  courtWidth: 640,
  courtHeight: 480,
  serviceBoxHeight: 120, // 0.25 * 480
  horizontalLineY: 240, // 0.50 * 480
  showServiceBoxes: true,
  showCenterLine: true,
  opacity: 1,
  cornerRadius: 0,
  showGrid: false,
  gridSize: 40,
};

// 加载保存的配置
const loadConfig = () => {
  try {
    const saved = localStorage.getItem('squash-court-config-v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      return { 
        ...defaultConfig, 
        ...parsed,
        customLines: parsed.customLines || [],
        uploadedImage: parsed.uploadedImage || null,
      };
    }
  } catch (error) {
    console.error('加载配置失败:', error);
  }
  return { ...defaultConfig, customLines: [], uploadedImage: null };
};

// 保存配置
const saveConfig = (config) => {
  try {
    localStorage.setItem('squash-court-config-v2', JSON.stringify(config));
    return true;
  } catch (error) {
    console.error('保存配置失败:', error);
    return false;
  }
};

// 绘制网格
const drawGrid = (ctx, width, height, gridSize, color) => {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  
  for (let x = 0; x <= width; x += gridSize) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  
  for (let y = 0; y <= height; y += gridSize) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  
  ctx.globalAlpha = 1;
};

const CourtEditor = () => {
  const [config, setConfig] = useState(loadConfig);
  const canvasRef = useRef(null);
  const previewRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawMode, setDrawMode] = useState('freehand'); // freehand, straight, erase
  const [currentLine, setCurrentLine] = useState(null);
  const [selectedColor, setSelectedColor] = useState('#FF6B6B');
  const [brushSize, setBrushSize] = useState(4);
  const [showPreview, setShowPreview] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [uploadedImageElement, setUploadedImageElement] = useState(null);
  const [imageScale, setImageScale] = useState(1);
  const [imageOffset, setImageOffset] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // 颜色预设
  const backgroundPresets = ['#2d2d2d', '#1a1a1a', '#1e293b', '#0f172a', '#000000', '#1f2937', '#ffffff', '#f0f0f0'];
  const linePresets = ['#FFD700', '#FFFFFF', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#FF6B9D', '#C44569'];
  const drawColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#FF6B9D', '#FFFFFF', '#000000', '#FFD700'];

  // 加载上传的图片
  useEffect(() => {
    if (config.uploadedImage?.dataUrl) {
      const img = new Image();
      img.onload = () => {
        setUploadedImageElement(img);
        if (config.uploadedImage.scale) {
          setImageScale(config.uploadedImage.scale);
        }
        if (config.uploadedImage.offset) {
          setImageOffset(config.uploadedImage.offset);
        }
      };
      img.src = config.uploadedImage.dataUrl;
    }
  }, [config.uploadedImage]);

  // 绘制函数
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 绘制上传的图片（如果启用）
    if (uploadedImageElement && config.showUploadedImage !== false) {
      ctx.save();
      const scaledWidth = uploadedImageElement.width * imageScale;
      const scaledHeight = uploadedImageElement.height * imageScale;
      ctx.drawImage(
        uploadedImageElement, 
        imageOffset.x, 
        imageOffset.y, 
        scaledWidth, 
        scaledHeight
      );
      ctx.restore();
    }
    
    // 绘制基础场地线条（如果启用）
    if (config.showBaseCourt !== false) {
      drawBaseCourt(ctx);
    }
    
    // 绘制网格（如果启用）
    if (config.showGrid) {
      drawGrid(ctx, config.courtWidth, config.courtHeight, config.gridSize, config.lineColor);
    }
    
    // 绘制用户自定义线条
    config.customLines?.forEach(line => {
      ctx.beginPath();
      ctx.strokeStyle = line.color;
      ctx.lineWidth = line.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (line.type === 'freehand') {
        if (line.points.length > 0) {
          ctx.moveTo(line.points[0].x, line.points[0].y);
          for (let i = 1; i < line.points.length; i++) {
            ctx.lineTo(line.points[i].x, line.points[i].y);
          }
        }
      } else if (line.type === 'straight') {
        ctx.moveTo(line.start.x, line.start.y);
        ctx.lineTo(line.end.x, line.end.y);
      }
      
      ctx.stroke();
    });
    
    // 绘制当前正在画的线
    if (currentLine) {
      ctx.beginPath();
      ctx.strokeStyle = currentLine.color;
      ctx.lineWidth = currentLine.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      if (currentLine.type === 'freehand') {
        if (currentLine.points.length > 0) {
          ctx.moveTo(currentLine.points[0].x, currentLine.points[0].y);
          for (let i = 1; i < currentLine.points.length; i++) {
            ctx.lineTo(currentLine.points[i].x, currentLine.points[i].y);
          }
        }
      } else if (currentLine.type === 'straight' && currentLine.end) {
        ctx.moveTo(currentLine.start.x, currentLine.start.y);
        ctx.lineTo(currentLine.end.x, currentLine.end.y);
      }
      
      ctx.stroke();
    }
  }, [config, uploadedImageElement, imageScale, imageOffset, currentLine]);

  // 绘制基础场地 - 更新为符合用户精确规格，修复发球区底线连接问题
  const drawBaseCourt = (ctx) => {
    const {
      lineColor,
      lineWidth,
      courtWidth,
      courtHeight,
      serviceBoxHeight,
      horizontalLineY,
      showServiceBoxes,
      showCenterLine,
      opacity,
    } = config;

    const centerX = courtWidth / 2;
    const leftServiceBoxX = courtWidth * 0.25; // x = 0.25
    const rightServiceBoxX = courtWidth * 0.75; // x = 0.75
    const serviceBoxBottomY = horizontalLineY + serviceBoxHeight; // y = 0.75
    
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = lineWidth;
    ctx.globalAlpha = opacity;
    ctx.lineCap = 'round';
    
    // 1. 短线 (Short line) - y = 0.50
    ctx.beginPath();
    ctx.moveTo(0, horizontalLineY);
    ctx.lineTo(courtWidth, horizontalLineY);
    ctx.stroke();
    
    // 2. 中线 (Center line) - x = 0.50, y = 0.50 到 1.00
    if (showCenterLine) {
      ctx.beginPath();
      ctx.moveTo(centerX, horizontalLineY);
      ctx.lineTo(centerX, courtHeight);
      ctx.stroke();
    }
    
    // 3. 发球区线条
    if (showServiceBoxes) {
      // 左发球区底线 - 从 x=0 到 x=0.25（不连接到右侧）
      ctx.beginPath();
      ctx.moveTo(0, serviceBoxBottomY);
      ctx.lineTo(leftServiceBoxX, serviceBoxBottomY);
      ctx.stroke();
      
      // 右发球区底线 - 从 x=0.75 到 x=1.00（不连接到左侧）
      ctx.beginPath();
      ctx.moveTo(rightServiceBoxX, serviceBoxBottomY);
      ctx.lineTo(courtWidth, serviceBoxBottomY);
      ctx.stroke();
      
      // 左发球区右侧边线 - x = 0.25, y = 0.50 到 0.75
      ctx.beginPath();
      ctx.moveTo(leftServiceBoxX, horizontalLineY);
      ctx.lineTo(leftServiceBoxX, serviceBoxBottomY);
      ctx.stroke();
      
      // 右发球区左侧边线 - x = 0.75, y = 0.50 到 0.75
      ctx.beginPath();
      ctx.moveTo(rightServiceBoxX, horizontalLineY);
      ctx.lineTo(rightServiceBoxX, serviceBoxBottomY);
      ctx.stroke();
    }
    
    ctx.globalAlpha = 1;
  };

  // 更新画布
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // 获取鼠标/触摸在画布上的坐标
  const getCanvasCoordinates = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  // 开始绘制
  const startDrawing = (e) => {
    if (drawMode === 'move') {
      setIsDraggingImage(true);
      dragStartRef.current = getCanvasCoordinates(e);
      return;
    }
    
    if (drawMode === 'erase') {
      setIsDrawing(true);
      const coords = getCanvasCoordinates(e);
      eraseLines(coords);
      return;
    }
    
    setIsDrawing(true);
    const coords = getCanvasCoordinates(e);
    
    if (drawMode === 'freehand') {
      setCurrentLine({
        type: 'freehand',
        points: [coords],
        color: selectedColor,
        width: brushSize
      });
    } else if (drawMode === 'straight') {
      setCurrentLine({
        type: 'straight',
        start: coords,
        end: null,
        color: selectedColor,
        width: brushSize
      });
    }
  };

  // 绘制中
  const draw = (e) => {
    if (!isDrawing) return;
    
    if (drawMode === 'move' && isDraggingImage) {
      const coords = getCanvasCoordinates(e);
      const dx = coords.x - dragStartRef.current.x;
      const dy = coords.y - dragStartRef.current.y;
      setImageOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      dragStartRef.current = coords;
      return;
    }
    
    if (drawMode === 'erase') {
      const coords = getCanvasCoordinates(e);
      eraseLines(coords);
      return;
    }
    
    const coords = getCanvasCoordinates(e);
    
    if (drawMode === 'freehand' && currentLine) {
      setCurrentLine(prev => ({
        ...prev,
        points: [...prev.points, coords]
      }));
    } else if (drawMode === 'straight' && currentLine) {
      setCurrentLine(prev => ({
        ...prev,
        end: coords
      }));
    }
  };

  // 结束绘制
  const stopDrawing = () => {
    if (isDraggingImage) {
      setIsDraggingImage(false);
      // 保存偏移量
      setConfig(prev => ({
        ...prev,
        uploadedImage: {
          ...prev.uploadedImage,
          offset: imageOffset
        }
      }));
      return;
    }
    
    if (!isDrawing) return;
    setIsDrawing(false);
    
    if (currentLine) {
      if (drawMode === 'freehand' && currentLine.points.length > 1) {
        setConfig(prev => ({
          ...prev,
          customLines: [...(prev.customLines || []), currentLine]
        }));
      } else if (drawMode === 'straight' && currentLine.end) {
        setConfig(prev => ({
          ...prev,
          customLines: [...(prev.customLines || []), currentLine]
        }));
      }
      setCurrentLine(null);
    }
  };

  // 擦除线条
  const eraseLines = (coords) => {
    const eraseRadius = 20;
    setConfig(prev => ({
      ...prev,
      customLines: prev.customLines?.filter(line => {
        if (line.type === 'freehand') {
          return !line.points.some(p => 
            Math.hypot(p.x - coords.x, p.y - coords.y) < eraseRadius
          );
        } else if (line.type === 'straight') {
          // 简单的点到线段距离检查
          const dist = pointToLineDistance(
            coords, 
            line.start, 
            line.end
          );
          return dist > eraseRadius;
        }
        return true;
      }) || []
    }));
  };

  // 计算点到线段的距离
  const pointToLineDistance = (p, v, w) => {
    const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
    if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
  };

  // 清空所有线条
  const clearAllLines = () => {
    if (confirm('确定要清空所有手绘线条吗？')) {
      setConfig(prev => ({ ...prev, customLines: [] }));
      toast.success('已清空所有线条');
    }
  };

  // 撤销上一步
  const undoLastLine = () => {
    setConfig(prev => ({
      ...prev,
      customLines: prev.customLines?.slice(0, -1) || []
    }));
    toast.success('已撤销');
  };

  // 处理图片上传
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!file.type.match(/image\/(jpeg|png|svg\+xml)/)) {
      toast.error('请上传 JPG、PNG 或 SVG 格式的图片');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setConfig(prev => ({
        ...prev,
        uploadedImage: {
          dataUrl,
          name: file.name,
          scale: 1,
          offset: { x: 0, y: 0 }
        }
      }));
      setImageScale(1);
      setImageOffset({ x: 0, y: 0 });
      toast.success('图片上传成功');
    };
    reader.readAsDataURL(file);
  };

  // 移除上传的图片
  const removeUploadedImage = () => {
    setConfig(prev => ({ ...prev, uploadedImage: null }));
    setUploadedImageElement(null);
    setImageScale(1);
    setImageOffset({ x: 0, y: 0 });
    toast.success('已移除图片');
  };

  // 更新配置
  const updateConfig = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // 重置为默认
  const handleReset = () => {
    if (confirm('确定要重置所有设置吗？这将清空所有手绘线条和上传的图片。')) {
      setConfig({ ...defaultConfig, customLines: [], uploadedImage: null });
      setUploadedImageElement(null);
      setImageScale(1);
      setImageOffset({ x: 0, y: 0 });
      toast.success('已重置为默认设置');
    }
  };

  // 保存配置
  const handleSave = () => {
    if (saveConfig(config)) {
      toast.success('设置已保存', {
        description: '训练页面将使用新的背景配置',
      });
    } else {
      toast.error('保存失败');
    }
  };

  // 导出为PNG
  const handleExportPng = async () => {
    if (!previewRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(previewRef.current, {
        pixelRatio: 2,
        backgroundColor: config.backgroundColor
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `squash-court-${Date.now()}.png`;
      link.click();
      toast.success('PNG图片已导出');
    } catch (error) {
      console.error('导出失败:', error);
      toast.error('导出失败');
    } finally {
      setIsExporting(false);
    }
  };

  // 生成SVG字符串 - 修复发球区底线连接问题
  const generateSVG = () => {
    const {
      backgroundColor,
      lineColor,
      lineWidth,
      courtWidth,
      courtHeight,
      serviceBoxHeight,
      horizontalLineY,
      showServiceBoxes,
      showCenterLine,
      showBaseCourt,
      opacity,
      customLines,
    } = config;

    const centerX = courtWidth / 2;
    const leftServiceBoxX = courtWidth * 0.25;
    const rightServiceBoxX = courtWidth * 0.75;
    const serviceBoxBottomY = horizontalLineY + serviceBoxHeight;
    
    let paths = '';
    
    // 基础场地线条
    if (showBaseCourt) {
      // 1. 短线 (y = 0.50)
      paths += `<line x1="0" y1="${horizontalLineY}" x2="${courtWidth}" y2="${horizontalLineY}" stroke="${lineColor}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
      
      // 2. 中线 (x = 0.50, y: 0.50 -> 1.00)
      if (showCenterLine) {
        paths += `<line x1="${centerX}" y1="${horizontalLineY}" x2="${centerX}" y2="${courtHeight}" stroke="${lineColor}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
      }
      
      // 3. 发球区线条
      if (showServiceBoxes) {
        // 左发球区底线 - 从 x=0 到 x=0.25（不连接到右侧）
        paths += `<line x1="0" y1="${serviceBoxBottomY}" x2="${leftServiceBoxX}" y2="${serviceBoxBottomY}" stroke="${lineColor}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
        
        // 右发球区底线 - 从 x=0.75 到 x=1.00（不连接到左侧）
        paths += `<line x1="${rightServiceBoxX}" y1="${serviceBoxBottomY}" x2="${courtWidth}" y2="${serviceBoxBottomY}" stroke="${lineColor}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
        
        // 左发球区右侧边线 - x = 0.25, y: 0.50 -> 0.75
        paths += `<line x1="${leftServiceBoxX}" y1="${horizontalLineY}" x2="${leftServiceBoxX}" y2="${serviceBoxBottomY}" stroke="${lineColor}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
        
        // 右发球区左侧边线 - x = 0.75, y: 0.50 -> 0.75
        paths += `<line x1="${rightServiceBoxX}" y1="${horizontalLineY}" x2="${rightServiceBoxX}" y2="${serviceBoxBottomY}" stroke="${lineColor}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
      }
    }
    
    // 用户自定义线条
    customLines?.forEach(line => {
      if (line.type === 'freehand' && line.points.length > 1) {
        let pathData = `M ${line.points[0].x} ${line.points[0].y}`;
        for (let i = 1; i < line.points.length; i++) {
          pathData += ` L ${line.points[i].x} ${line.points[i].y}`;
        }
        paths += `<path d="${pathData}" stroke="${line.color}" stroke-width="${line.width}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
      } else if (line.type === 'straight' && line.end) {
        paths += `<line x1="${line.start.x}" y1="${line.start.y}" x2="${line.end.x}" y2="${line.end.y}" stroke="${line.color}" stroke-width="${line.width}" stroke-linecap="round" />`;
      }
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${courtWidth}" height="${courtHeight}" viewBox="0 0 ${courtWidth} ${courtHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${backgroundColor}" />
  ${paths}
</svg>`;
  };

  // 导出为SVG
  const handleExportSvg = () => {
    setIsExporting(true);
    const svgString = generateSVG();
    const blob = new Blob([svgString], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `squash-court-${Date.now()}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setTimeout(() => {
      setIsExporting(false);
      toast.success('SVG文件已导出');
    }, 500);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowLeft className="mr-2 h-4 w-4" />
                返回首页
              </Button>
            </Link>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">场地背景编辑器</h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              onClick={handleReset}
              className="text-slate-600"
              size="sm"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              重置
            </Button>
            <Button
              onClick={handleSave}
              className="bg-blue-600 hover:bg-blue-700"
              size="sm"
            >
              <Save className="mr-2 h-4 w-4" />
              保存设置
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* 左侧：编辑面板 */}
          <div className="xl:col-span-1 space-y-4 max-h-[calc(100vh-140px)] overflow-y-auto pr-2">
            
            {/* 绘图工具 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Pencil className="h-5 w-5" />
                  绘图工具
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 绘图模式 */}
                <div className="grid grid-cols-4 gap-2">
                  <Button
                    variant={drawMode === 'freehand' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDrawMode('freehand')}
                    className="flex flex-col items-center py-2 h-auto"
                  >
                    <Pencil className="h-4 w-4 mb-1" />
                    <span className="text-xs">手绘</span>
                  </Button>
                  <Button
                    variant={drawMode === 'straight' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDrawMode('straight')}
                    className="flex flex-col items-center py-2 h-auto"
                  >
                    <Minus className="h-4 w-4 mb-1" />
                    <span className="text-xs">直线</span>
                  </Button>
                  <Button
                    variant={drawMode === 'erase' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDrawMode('erase')}
                    className="flex flex-col items-center py-2 h-auto"
                  >
                    <Eraser className="h-4 w-4 mb-1" />
                    <span className="text-xs">橡皮</span>
                  </Button>
                  <Button
                    variant={drawMode === 'move' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDrawMode('move')}
                    className="flex flex-col items-center py-2 h-auto"
                  >
                    <Move className="h-4 w-4 mb-1" />
                    <span className="text-xs">移动</span>
                  </Button>
                </div>

                {/* 画笔颜色 */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">画笔颜色</Label>
                  <div className="flex gap-1 flex-wrap">
                    {drawColors.map(color => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`w-6 h-6 rounded border-2 transition-all ${
                          selectedColor === color 
                            ? 'border-blue-500 scale-110' 
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <Input
                    type="color"
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="w-full h-8"
                  />
                </div>

                {/* 画笔粗细 */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs font-medium">画笔粗细</Label>
                    <span className="text-xs text-slate-500">{brushSize}px</span>
                  </div>
                  <Slider
                    min={1}
                    max={20}
                    step={1}
                    value={[brushSize]}
                    onValueChange={([value]) => setBrushSize(value)}
                  />
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={undoLastLine}
                    disabled={!config.customLines?.length}
                    className="flex-1"
                  >
                    <Undo className="mr-1 h-4 w-4" />
                    撤销
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={clearAllLines}
                    disabled={!config.customLines?.length}
                    className="flex-1"
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    清空
                  </Button>
                </div>

                <p className="text-xs text-slate-500">
                  已绘制 {config.customLines?.length || 0} 条线条
                </p>
              </CardContent>
            </Card>

            {/* 图片上传 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <ImageIcon className="h-5 w-5" />
                  背景图片
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!config.uploadedImage ? (
                  <div 
                    className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                    <p className="text-sm text-slate-600 font-medium">点击上传图片</p>
                    <p className="text-xs text-slate-400 mt-1">支持 JPG、PNG、SVG</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.svg"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between bg-slate-100 rounded-lg p-3">
                      <span className="text-sm font-medium truncate flex-1 mr-2">
                        {config.uploadedImage.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={removeUploadedImage}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {/* 图片缩放 */}
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label className="text-xs font-medium">图片缩放</Label>
                        <span className="text-xs text-slate-500">{imageScale.toFixed(2)}x</span>
                      </div>
                      <Slider
                        min={0.1}
                        max={3}
                        step={0.1}
                        value={[imageScale]}
                        onValueChange={([value]) => {
                          setImageScale(value);
                          setConfig(prev => ({
                            ...prev,
                            uploadedImage: {
                              ...prev.uploadedImage,
                              scale: value
                            }
                          }));
                        }}
                      />
                    </div>

                    {/* 显示选项 */}
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={config.showUploadedImage !== false}
                        onChange={(e) => updateConfig('showUploadedImage', e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600"
                      />
                      <span className="text-sm">显示上传的图片</span>
                    </label>

                    <p className="text-xs text-slate-500">
                      提示：选择"移动"工具可以拖动图片位置
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 颜色设置 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">颜色设置</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 背景颜色 */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">场地背景色</Label>
                  <div className="flex gap-1 flex-wrap">
                    {backgroundPresets.map(color => (
                      <button
                        key={color}
                        onClick={() => updateConfig('backgroundColor', color)}
                        className={`w-6 h-6 rounded border-2 transition-all ${
                          config.backgroundColor === color 
                            ? 'border-blue-500 scale-110' 
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={config.backgroundColor}
                      onChange={(e) => updateConfig('backgroundColor', e.target.value)}
                      className="w-10 h-8 p-1"
                    />
                    <Input
                      type="text"
                      value={config.backgroundColor}
                      onChange={(e) => updateConfig('backgroundColor', e.target.value)}
                      className="flex-1 h-8 text-sm"
                    />
                  </div>
                </div>

                {/* 线条颜色 */}
                <div className="space-y-2 pt-3 border-t">
                  <Label className="text-xs font-medium">标线颜色</Label>
                  <div className="flex gap-1 flex-wrap">
                    {linePresets.map(color => (
                      <button
                        key={color}
                        onClick={() => updateConfig('lineColor', color)}
                        className={`w-6 h-6 rounded border-2 transition-all ${
                          config.lineColor === color 
                            ? 'border-blue-500 scale-110' 
                            : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      type="color"
                      value={config.lineColor}
                      onChange={(e) => updateConfig('lineColor', e.target.value)}
                      className="w-10 h-8 p-1"
                    />
                    <Input
                      type="text"
                      value={config.lineColor}
                      onChange={(e) => updateConfig('lineColor', e.target.value)}
                      className="flex-1 h-8 text-sm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 线条样式 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">线条样式</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 线宽 */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs font-medium">基础线宽</Label>
                    <span className="text-xs text-slate-500">{config.lineWidth}px</span>
                  </div>
                  <Slider
                    min={1}
                    max={30}
                    step={1}
                    value={[config.lineWidth]}
                    onValueChange={([value]) => updateConfig('lineWidth', value)}
                  />
                </div>

                {/* 透明度 */}
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-xs font-medium">线条透明度</Label>
                    <span className="text-xs text-slate-500">{Math.round(config.opacity * 100)}%</span>
                  </div>
                  <Slider
                    min={0.1}
                    max={1}
                    step={0.1}
                    value={[config.opacity]}
                    onValueChange={([value]) => updateConfig('opacity', value)}
                  />
                </div>

                {/* 显示选项 */}
                <div className="space-y-2 pt-2 border-t">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showBaseCourt !== false}
                      onChange={(e) => updateConfig('showBaseCourt', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600"
                    />
                    <span className="text-sm">显示基础场地线条</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showServiceBoxes}
                      onChange={(e) => updateConfig('showServiceBoxes', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600"
                    />
                    <span className="text-sm">显示发球区</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showCenterLine}
                      onChange={(e) => updateConfig('showCenterLine', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600"
                    />
                    <span className="text-sm">显示中线</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.showGrid}
                      onChange={(e) => updateConfig('showGrid', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600"
                    />
                    <span className="text-sm">显示网格</span>
                  </label>
                </div>
              </CardContent>
            </Card>

            {/* 导出 */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">导出</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  onClick={handleExportPng}
                  disabled={isExporting}
                  variant="outline"
                  className="w-full"
                >
                  {isExporting ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <ImageIcon className="mr-2 h-4 w-4" />
                  )}
                  导出为 PNG
                </Button>
                <Button
                  onClick={handleExportSvg}
                  disabled={isExporting}
                  variant="outline"
                  className="w-full"
                >
                  {isExporting ? (
                    <Check className="mr-2 h-4 w-4" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  导出为 SVG
                </Button>
                <p className="text-xs text-slate-500">
                  PNG包含手绘线条和背景图片，SVG仅包含矢量线条
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 右侧：预览区域 */}
          <div className="xl:col-span-2">
            <Card className="sticky top-8">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="h-5 w-5" />
                    实时预览
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowPreview(!showPreview)}
                    >
                      {showPreview ? '隐藏' : '显示'}
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {showPreview && (
                  <>
                    <div 
                      ref={previewRef}
                      className="rounded-lg overflow-hidden inline-block"
                      style={{ 
                        backgroundColor: config.backgroundColor,
                        maxWidth: '100%'
                      }}
                    >
                      <canvas
                        ref={canvasRef}
                        width={config.courtWidth}
                        height={config.courtHeight}
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseLeave={stopDrawing}
                        onTouchStart={startDrawing}
                        onTouchMove={draw}
                        onTouchEnd={stopDrawing}
                        className={`max-w-full h-auto ${drawMode === 'move' ? 'cursor-move' : drawMode === 'erase' ? 'cursor-crosshair' : 'cursor-crosshair'}`}
                        style={{
                          touchAction: 'none'
                        }}
                      />
                    </div>
                    
                    {/* 当前工具提示 */}
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-4 text-sm text-slate-600">
                        <span className="flex items-center gap-1">
                          <span className="font-medium">当前工具:</span>
                          {drawMode === 'freehand' && '手绘'}
                          {drawMode === 'straight' && '直线'}
                          {drawMode === 'erase' && '橡皮擦'}
                          {drawMode === 'move' && '移动'}
                        </span>
                        <span 
                          className="inline-block w-4 h-4 rounded border"
                          style={{ backgroundColor: selectedColor }}
                        />
                      </div>
                      <p className="text-xs text-slate-400">
                        画布尺寸: {config.courtWidth} × {config.courtHeight}px
                      </p>
                    </div>
                  </>
                )}
                
                {/* 配置信息 */}
                <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                  <h4 className="text-sm font-medium text-slate-700 mb-2">当前配置</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-slate-600">
                    <div>背景: <span className="font-mono">{config.backgroundColor}</span></div>
                    <div>线条: <span className="font-mono">{config.lineColor}</span></div>
                    <div>线宽: <span className="font-mono">{config.lineWidth}px</span></div>
                    <div>透明度: <span className="font-mono">{Math.round(config.opacity * 100)}%</span></div>
                    <div>短线: <span className="font-mono">{config.horizontalLineY}px</span></div>
                    <div>发球区高度: <span className="font-mono">{config.serviceBoxHeight}px</span></div>
                    {config.uploadedImage && (
                      <div className="col-span-2 sm:col-span-3">
                        背景图片: <span className="font-mono">{config.uploadedImage.name}</span>
                        (缩放: {imageScale.toFixed(2)}x)
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CourtEditor;

