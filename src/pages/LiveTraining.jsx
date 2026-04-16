
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  X, 
  RotateCcw, 
  Target, 
  ArrowDownRight, 
  ArrowDownLeft, 
  ArrowRight, 
  ArrowLeft, 
  ArrowUpRight, 
  ArrowUpLeft,
  Play,
  Pause,
  CheckCircle,
  AlertTriangle,
  Shield
} from 'lucide-react';
import { useLiveTraining } from '@/hooks/useLiveTraining';
import LiveTrainingCamera from '@/components/LiveTrainingCamera';
import { toast } from 'sonner';
import { loadSettings } from '@/lib/storage';

// 箭头图标映射
const arrowIcons = {
  ArrowDownRight,
  ArrowDownLeft,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  ArrowUpLeft
};

// 获取箭头定位类名 - 箭头尾部固定在画布中心，头部指向目标方向
// 所有箭头使用相同的尺寸：50vw x 50vh
const getArrowPositionClasses = (arrowName) => {
  switch (arrowName) {
    case 'ArrowUpRight': // 前场正手 - 右上
      return 'left-1/2 bottom-1/2 w-[50vw] h-[50vh]';
    case 'ArrowUpLeft': // 前场反手 - 左上
      return 'right-1/2 bottom-1/2 w-[50vw] h-[50vh]';
    case 'ArrowRight': // 中场正手 - 右
      return 'left-1/2 top-1/2 -translate-y-1/2 w-[50vw] h-[50vh]';
    case 'ArrowLeft': // 中场反手 - 左
      return 'right-1/2 top-1/2 -translate-y-1/2 w-[50vw] h-[50vh]';
    case 'ArrowDownRight': // 后场正手 - 右下
      return 'left-1/2 top-1/2 w-[50vw] h-[50vh]';
    case 'ArrowDownLeft': // 后场反手 - 左下
      return 'right-1/2 top-1/2 w-[50vw] h-[50vh]';
    default:
      return '';
  }
};

// 加载场地配置
const loadCourtConfig = () => {
  try {
    const saved = localStorage.getItem('squash-court-config-v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...parsed,
        customLines: parsed.customLines || [],
        uploadedImage: parsed.uploadedImage || null,
      };
    }
  } catch (error) {
    console.error('加载场地配置失败:', error);
  }
  return null;
};

// 生成场地背景
const generateCourtBackground = (config) => {
  if (!config) return '/squash-court-floor.svg';
  
  // 如果有上传的图片且启用了显示
  if (config.uploadedImage?.dataUrl && config.showUploadedImage !== false) {
    return config.uploadedImage.dataUrl;
  }
  
  // 否则使用SVG生成
  const {
    backgroundColor = '#2d2d2d',
    lineColor = '#FFD700',
    lineWidth = 16,
    courtWidth = 640,
    courtHeight = 480,
    showServiceBoxes = true,
    showCenterLine = true,
    showBaseCourt = true,
    opacity = 1,
    customLines = [],
  } = config;

  // 归一化坐标转换为像素
  const shortLineY = courtHeight * 0.50;
  const centerX = courtWidth * 0.50;
  const leftServiceBoxX = courtWidth * 0.25;
  const rightServiceBoxX = courtWidth * 0.75;
  const serviceBoxBottomY = courtHeight * 0.75;

  // 如果没有基础场地线条且没有自定义线条，返回默认背景
  if (!showBaseCourt && customLines.length === 0) {
    return '/squash-court-floor.svg';
  }

  let paths = '';
  
  // 基础场地线条
  if (showBaseCourt) {
    // 1. 短线 (Short line)
    paths += `<line x1="0" y1="${shortLineY}" x2="${courtWidth}" y2="${shortLineY}" stroke="${lineColor}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
    
    // 2. 中线 (Center line)
    if (showCenterLine) {
      paths += `<line x1="${centerX}" y1="${shortLineY}" x2="${centerX}" y2="${courtHeight}" stroke="${lineColor}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
    }
    
    // 3. 发球区线条
    if (showServiceBoxes) {
      // 左发球区底线
      paths += `<line x1="0" y1="${serviceBoxBottomY}" x2="${leftServiceBoxX}" y2="${serviceBoxBottomY}" stroke="${lineColor}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
      
      // 右发球区底线
      paths += `<line x1="${rightServiceBoxX}" y1="${serviceBoxBottomY}" x2="${courtWidth}" y2="${serviceBoxBottomY}" stroke="${lineColor}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
      
      // 左发球区右侧边线
      paths += `<line x1="${leftServiceBoxX}" y1="${shortLineY}" x2="${leftServiceBoxX}" y2="${serviceBoxBottomY}" stroke="${lineColor}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
      
      // 右发球区左侧边线
      paths += `<line x1="${rightServiceBoxX}" y1="${shortLineY}" x2="${rightServiceBoxX}" y2="${serviceBoxBottomY}" stroke="${lineColor}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
    }
  }
  
  // 用户自定义线条
  customLines.forEach(line => {
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

  const svgString = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${courtWidth}" height="${courtHeight}" viewBox="0 0 ${courtWidth} ${courtHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="${backgroundColor}" />
  ${paths}
</svg>`;

  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  return URL.createObjectURL(blob);
};

const LiveTraining = () => {
  const navigate = useNavigate();
  const [showCamera, setShowCamera] = useState(true);
  const [courtBackgroundUrl, setCourtBackgroundUrl] = useState('/squash-court-floor.svg');
  const [showConfirmation, setShowConfirmation] = useState(true);
  const [isSecureContext, setIsSecureContext] = useState(true);
  
  // 检查是否在安全上下文
  useEffect(() => {
    setIsSecureContext(window.isSecureContext);
    if (!window.isSecureContext) {
      toast.error('安全警告：当前未使用 HTTPS，相机功能可能无法正常工作', {
        duration: 5000,
      });
    }
  }, []);
  
  const {
    trainingState,
    currentLocation,
    isActive,
    isCalibrating,
    sessionStats,
    TRAINING_STATE,
    stopTraining,
    handleCalibrationComplete,
    restartCalibration,
    handlePoseUpdate,
    getStateDisplayText,
    getStateColor,
    locations
  } = useLiveTraining();

  // 加载设置以获取确认提示开关状态
  useEffect(() => {
    const settings = loadSettings();
    setShowConfirmation(settings.showReturnConfirmation !== false);
  }, []);
  
  // 加载自定义场地背景
  useEffect(() => {
    const courtConfig = loadCourtConfig();
    if (courtConfig) {
      const url = generateCourtBackground(courtConfig);
      setCourtBackgroundUrl(url);
      return () => {
        if (url !== '/squash-court-floor.svg' && url.startsWith('blob:')) {
          URL.revokeObjectURL(url);
        }
      };
    }
  }, []);

  // 获取当前位置的箭头图标
  const getLocationArrow = (arrowName) => {
    const Icon = arrowIcons[arrowName];
    return Icon || null;
  };

  // 处理离开页面
  const handleExit = () => {
    stopTraining();
    navigate('/');
  };

  // 处理重新开始（包括重新校准）
  const handleRestart = () => {
    restartCalibration();
  };

  // 校准完成回调
  const onCalibrationComplete = (reference) => {
    handleCalibrationComplete();
    toast.success('校准完成！训练开始', {
      description: `参考位置已保存，开始自动检测`,
    });
  };

  // 处理姿态数据更新
  const onPoseUpdate = (poseData) => {
    handlePoseUpdate(poseData);
  };

  // 获取背景颜色（用于覆盖层）
  const getBackgroundColor = () => {
    if (isCalibrating) return 'bg-purple-900';
    if (!currentLocation) return 'bg-slate-900';
    return currentLocation.color;
  };

  // 所有箭头使用统一的浅蓝色
  const getArrowColor = () => {
    return 'text-blue-400';
  };

  // 渲染位置指示器 - 箭头从中心点向外延伸
  const renderLocationIndicator = () => {
    if (!currentLocation) return null;
    
    const ArrowIcon = getLocationArrow(currentLocation.arrow);
    const positionClasses = getArrowPositionClasses(currentLocation.arrow);
    const arrowColor = getArrowColor();
    
    return (
      <div className="relative w-full h-full min-h-[50vh] flex items-center justify-center">
        {/* 箭头从画布中心延伸到目标位置 */}
        <div className={`absolute ${positionClasses} ${arrowColor}`}>
          <ArrowIcon className="w-full h-full drop-shadow-2xl" strokeWidth={1.5} />
        </div>
        {/* 位置名称和描述显示在底部 */}
        <div className="absolute bottom-0 left-0 right-0 text-center">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mt-4 drop-shadow-lg text-white">
            {currentLocation.name}
          </h1>
          <p className="text-lg md:text-xl mt-2 opacity-90 text-white">{currentLocation.description}</p>
        </div>
      </div>
    );
  };

  // 渲染校准界面
  const renderCalibration = () => {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center mb-8">
          <Target className="w-20 h-20 mx-auto mb-4 text-purple-300" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">准备校准</h1>
          <p className="text-xl text-white/80 max-w-md mx-auto">
            请先站在T位（场地中心），面向相机，确保全身可见
          </p>
          <p className="text-lg text-white/60 mt-4">
            校准完成后训练将自动开始
          </p>
        </div>
      </div>
    );
  };

  // 如果不是安全上下文，显示警告
  if (!isSecureContext) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center p-8">
        <div className="max-w-md w-full text-center">
          <Shield className="w-20 h-20 mx-auto mb-6 text-yellow-500" />
          <h1 className="text-3xl font-bold mb-4">需要安全连接</h1>
          <p className="text-white/70 mb-6">
            实时训练功能需要使用相机，而浏览器要求相机必须在安全环境（HTTPS）下运行。
          </p>
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-left text-sm text-white/80">
                <p className="font-medium mb-1">可能的解决方案：</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>使用 HTTPS 访问此网站</li>
                  <li>在本地开发环境（localhost）中测试</li>
                  <li>联系管理员配置 SSL 证书</li>
                </ul>
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-center">
            <Button 
              onClick={() => navigate('/')} 
              variant="outline"
              className="border-white/50 text-white hover:bg-white/20"
            >
              返回首页
            </Button>
            <Button 
              onClick={() => window.location.reload()} 
              className="bg-blue-600 hover:bg-blue-700"
            >
              重试
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen ${getBackgroundColor()} text-white flex flex-col relative transition-colors duration-500`}>
      {/* 壁球场地板背景 */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center z-0"
        style={{ 
          backgroundImage: `url(${courtBackgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
        }}
      />
      
      {/* 半透明遮罩层 - 根据状态调整透明度 */}
      <div className={`absolute inset-0 z-0 transition-opacity duration-500 ${isCalibrating ? 'bg-purple-900/70' : 'bg-black/30'}`} />
      
      {/* 顶部控制栏 */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20">
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold font-mono bg-black/30 px-4 py-2 rounded-lg backdrop-blur-sm border border-yellow-500/30 text-yellow-400">
            实时训练
          </div>
          {!isCalibrating && (
            <div className={`text-lg font-medium bg-black/30 px-3 py-1 rounded-lg backdrop-blur-sm ${getStateColor()}`}>
              {getStateDisplayText()}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {!isCalibrating && (
            <Button
              onClick={() => setShowCamera(!showCamera)}
              variant="outline"
              size="sm"
              className="border-white/50 text-white hover:bg-white/20 bg-black/30"
            >
              {showCamera ? '隐藏相机' : '显示相机'}
            </Button>
          )}
          <Button 
            onClick={handleRestart} 
            size="sm"
            variant="outline"
            className="border-white/50 text-white hover:bg-white/20 bg-black/30"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            重新校准
          </Button>
          <Button 
            onClick={handleExit} 
            size="sm"
            variant="destructive"
          >
            <X className="mr-2 h-4 w-4" />
            退出
          </Button>
        </div>
      </div>

      {/* 主内容区 */}
      <div className="flex-1 flex items-center justify-center p-8 z-10 relative">
        {isCalibrating ? (
          renderCalibration()
        ) : (
          <div className="text-center w-full h-full">
            {renderLocationIndicator()}
            
            {/* 状态提示 - 根据设置决定是否显示确认提示 */}
            {showConfirmation && trainingState === TRAINING_STATE.RETURNED_TO_T && (
              <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <CheckCircle className="w-16 h-16 mx-auto text-green-400 mb-2" />
                <p className="text-2xl font-bold text-green-400">完美！准备下一个位置</p>
              </div>
            )}
            
            {/* 当确认提示关闭时，显示简化状态 */}
            {!showConfirmation && trainingState === TRAINING_STATE.RETURNED_TO_T && (
              <div className="mt-8 animate-in fade-in duration-200">
                <p className="text-xl text-white/80">准备中...</p>
              </div>
            )}
            
            {trainingState === TRAINING_STATE.USER_MOVED && (
              <div className="mt-8 text-white/90">
                <p className="text-xl font-medium drop-shadow-lg">移动到指定位置，完成后返回T位</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 相机视图（右下角小窗口）- 始终渲染但使用CSS控制可见性 */}
      {!isCalibrating && (
        <div 
          className={`fixed bottom-4 right-4 w-64 md:w-80 lg:w-96 z-20 rounded-lg overflow-hidden shadow-2xl border-2 border-white/20 transition-all duration-300 ${showCamera ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          aria-hidden={!showCamera}
        >
          <LiveTrainingCamera
            onPoseUpdate={onPoseUpdate}
            onCalibrationComplete={onCalibrationComplete}
            className="aspect-video"
          />
          <div className="absolute top-2 left-2 bg-black/60 px-2 py-1 rounded text-xs">
            姿态检测
          </div>
        </div>
      )}

      {/* 校准时全屏显示相机 */}
      {isCalibrating && (
        <div className="fixed inset-0 z-0">
          <LiveTrainingCamera
            isCalibrating={true}
            onCalibrationComplete={onCalibrationComplete}
            onPoseUpdate={onPoseUpdate}
          />
        </div>
      )}

      {/* 统计信息 */}
      {!isCalibrating && (
        <div className="fixed bottom-4 left-4 bg-black/40 backdrop-blur-sm rounded-lg px-4 py-2 text-sm">
          <div className="flex items-center gap-4">
            <span>移动次数: <strong>{sessionStats.totalMoves}</strong></span>
            <span>成功回位: <strong>{sessionStats.successfulReturns}</strong></span>
          </div>
        </div>
      )}

      {/* 操作说明 */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 text-center text-sm text-white/80 max-w-md z-10 drop-shadow">
        {!isCalibrating && (
          <p className="bg-black/30 px-4 py-2 rounded-full backdrop-blur-sm">
            看到指令后移动到对应位置，然后返回T位（蓝色框表示回到T位）
          </p>
        )}
      </div>
    </div>
  );
};

export default LiveTraining;

