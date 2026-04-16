import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Square, RotateCcw, X, Pause, Ban, ArrowDownLeft, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpLeft, ArrowUpRight } from 'lucide-react';
import { useGhosting } from '@/hooks/useGhosting';
import { loadSettings } from '@/lib/storage';
import { useNavigate, useLocation } from 'react-router-dom';

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

// 生成场地背景 - 更新为符合用户规格的精确坐标，修复发球区底线连接问题
const generateCourtBackground = (config) => {
  if (!config) return '/squash-court-floor.svg';
  
  // 如果有上传的图片且启用了显示
  if (config.uploadedImage?.dataUrl && config.showUploadedImage !== false) {
    return config.uploadedImage.dataUrl;
  }
  
  // 否则使用SVG生成 - 使用用户指定的精确归一化坐标
  const {
    backgroundColor = '#2d2d2d', // 深灰色/炭灰色
    lineColor = '#FFD700', // 亮黄色
    lineWidth = 16, // 约 2.5% 的 640px
    courtWidth = 640,
    courtHeight = 480,
    showServiceBoxes = true,
    showCenterLine = true,
    showBaseCourt = true,
    opacity = 1,
    customLines = [],
  } = config;

  // 归一化坐标转换为像素
  const shortLineY = courtHeight * 0.50; // y = 0.50
  const centerX = courtWidth * 0.50; // x = 0.50
  const leftServiceBoxX = courtWidth * 0.25; // x = 0.25
  const rightServiceBoxX = courtWidth * 0.75; // x = 0.75
  const serviceBoxBottomY = courtHeight * 0.75; // y = 0.75 (0.50 + 0.25)

  // 如果没有基础场地线条且没有自定义线条，返回默认背景
  if (!showBaseCourt && customLines.length === 0) {
    return '/squash-court-floor.svg';
  }

  let paths = '';
  
  // 基础场地线条
  if (showBaseCourt) {
    // 1. 短线 (Short line) - y = 0.50, x: 0.00 -> 1.00
    paths += `<line x1="0" y1="${shortLineY}" x2="${courtWidth}" y2="${shortLineY}" stroke="${lineColor}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
    
    // 2. 中线 (Center line) - x = 0.50, y: 0.50 -> 1.00
    if (showCenterLine) {
      paths += `<line x1="${centerX}" y1="${shortLineY}" x2="${centerX}" y2="${courtHeight}" stroke="${lineColor}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
    }
    
    // 3. 发球区线条
    if (showServiceBoxes) {
      // 左发球区底线 - 从 x=0 到 x=0.25（不连接到右侧）
      paths += `<line x1="0" y1="${serviceBoxBottomY}" x2="${leftServiceBoxX}" y2="${serviceBoxBottomY}" stroke="${lineColor}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
      
      // 右发球区底线 - 从 x=0.75 到 x=1.00（不连接到左侧）
      paths += `<line x1="${rightServiceBoxX}" y1="${serviceBoxBottomY}" x2="${courtWidth}" y2="${serviceBoxBottomY}" stroke="${lineColor}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
      
      // 左发球区右侧边线 - x = 0.25, y: 0.50 -> 0.75
      paths += `<line x1="${leftServiceBoxX}" y1="${shortLineY}" x2="${leftServiceBoxX}" y2="${serviceBoxBottomY}" stroke="${lineColor}" stroke-width="${lineWidth}" opacity="${opacity}" stroke-linecap="round" />`;
      
      // 右发球区左侧边线 - x = 0.75, y: 0.50 -> 0.75
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

// 根据位置ID获取对应的箭头图标 - 更新：前场箭头向上，后场箭头向下
const getLocationArrow = (locationId) => {
  switch (locationId) {
    case 'front-forehand':
      return ArrowUpRight;
    case 'front-backhand':
      return ArrowUpLeft;
    case 'mid-forehand':
      return ArrowRight;
    case 'mid-backhand':
      return ArrowLeft;
    case 'back-forehand':
      return ArrowDownRight;
    case 'back-backhand':
      return ArrowDownLeft;
    default:
      return null;
  }
};

// 获取箭头定位类名 - 箭头尾部固定在画布中心，头部指向目标方向
// 所有箭头使用相同的尺寸：50vw x 50vh
const getArrowPositionClasses = (locationId) => {
  switch (locationId) {
    case 'front-forehand': // 前场正手 - 右上
      return 'left-1/2 bottom-1/2 w-[50vw] h-[50vh]';
    case 'front-backhand': // 前场反手 - 左上
      return 'right-1/2 bottom-1/2 w-[50vw] h-[50vh]';
    case 'mid-forehand': // 中场正手 - 右（水平居中）
      return 'left-1/2 top-1/2 -translate-y-1/2 w-[50vw] h-[50vh]';
    case 'mid-backhand': // 中场反手 - 左（水平居中）
      return 'right-1/2 top-1/2 -translate-y-1/2 w-[50vw] h-[50vh]';
    case 'back-forehand': // 后场正手 - 右下
      return 'left-1/2 top-1/2 w-[50vw] h-[50vh]';
    case 'back-backhand': // 后场反手 - 左下
      return 'right-1/2 top-1/2 w-[50vw] h-[50vh]';
    default:
      return '';
  }
};

const Training = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [settings, setSettings] = useState(() => loadSettings());
  const [countdown, setCountdown] = useState(0);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const countdownStartedRef = useRef(false);
  const [courtBackgroundUrl, setCourtBackgroundUrl] = useState('/squash-court-floor.svg');
  
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
  
  useEffect(() => {
    setSettings(loadSettings());
  }, []);
  
  const { 
    isActive, 
    isPaused,
    timeLeft, 
    currentLocation, 
    sessionComplete,
    isDelay,
    startSession, 
    stopSession, 
    pauseSession,
    resumeSession,
    formatTime 
  } = useGhosting(settings);

  // 从首页自动开始训练时的倒计时逻辑
  useEffect(() => {
    if (location.state?.autoStart && !isActive && !sessionComplete && !countdownStartedRef.current) {
      countdownStartedRef.current = true;
      const countdownDuration = settings.countdownDuration || 3;
      setCountdown(countdownDuration);
      setIsCountingDown(true);
      
      const countdownTimer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimer);
            setIsCountingDown(false);
            startSession();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(countdownTimer);
    }
  }, [location.state?.autoStart, isActive, sessionComplete, settings.countdownDuration, startSession]);

  // 训练完成后自动返回首页
  useEffect(() => {
    if (sessionComplete) {
      const timer = setTimeout(() => {
        navigate('/');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [sessionComplete, navigate]);

  const handleStart = () => {
    startSession();
  };

  const handlePauseResume = () => {
    if (isPaused) {
      resumeSession();
    } else {
      pauseSession();
    }
  };

  const handleCancel = () => {
    stopSession();
  };

  const handleExit = () => {
    stopSession();
    navigate('/');
  };

  const handleRestart = () => {
    stopSession();
    setTimeout(() => startSession(), 100);
  };

  const textColor = settings.highContrast ? 'text-white' : 'text-slate-100';

  // 所有箭头使用统一的浅蓝色
  const getArrowColor = () => {
    return 'text-blue-400';
  };

  // 渲染位置指示器（箭头从中心点向外延伸）
  const renderLocationIndicator = () => {
    if (!currentLocation) return null;
    
    if (currentLocation.id === 't-position') {
      return (
        <div className="flex flex-col items-center">
          <h1 className="text-8xl md:text-9xl lg:text-[12rem] font-bold tracking-tight drop-shadow-2xl leading-none text-yellow-400">
            T
          </h1>
          <p className="text-lg md:text-xl font-medium mt-4 text-white/90 drop-shadow-lg">返回T位</p>
        </div>
      );
    }
    
    const ArrowIcon = getLocationArrow(currentLocation.id);
    const arrowColor = getArrowColor();
    
    if (ArrowIcon) {
      const positionClasses = getArrowPositionClasses(currentLocation.id);
      
      return (
        <div className="relative w-full h-full min-h-[60vh] flex items-center justify-center">
          {/* 箭头从画布中心延伸到目标位置 */}
          <div className={`absolute ${positionClasses} ${arrowColor}`}>
            <ArrowIcon className="w-full h-full drop-shadow-2xl" strokeWidth={1.5} />
          </div>
          {/* 位置名称显示在底部 */}
          <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
            <p className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">{currentLocation.name}</p>
          </div>
        </div>
      );
    }
    
    return (
      <h1 className="text-6xl md:text-8xl lg:text-9xl font-bold tracking-tight drop-shadow-2xl text-white">
        {currentLocation.name}
      </h1>
    );
  };

  // 倒计时状态显示
  if (isCountingDown) {
    return (
      <div className="min-h-screen w-full bg-[#2d2d2d] flex flex-col items-center justify-center relative overflow-hidden">
        <div 
          className="absolute inset-0 w-full h-full bg-cover bg-center bg-no-repeat"
          style={{ 
            backgroundImage: `url(${courtBackgroundUrl})`,
          }}
        />
        <div className="absolute inset-0 bg-black/40" />
        
        <div className="absolute top-4 right-4 z-20">
          <Button 
            onClick={handleExit} 
            size="lg" 
            variant="outline"
            className="border-white/50 text-white hover:bg-white/20 font-bold px-4 bg-black/20"
          >
            <X className="mr-2 h-5 w-5" />
            退出
          </Button>
        </div>
        
        <div className="text-center relative z-10">
          <p className="text-2xl text-white/80 mb-4">训练即将开始</p>
          <div className="text-8xl md:text-9xl font-bold text-white drop-shadow-2xl animate-pulse">
            {countdown}
          </div>
          <p className="text-xl text-white/60 mt-4">请做好准备...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`min-h-screen w-full ${textColor} flex flex-col relative overflow-hidden`}
    >
      {/* 壁球场地板背景 */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center"
        style={{ 
          backgroundImage: `url(${courtBackgroundUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
        }}
      />
      
      {/* 半透明遮罩层 */}
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />
      
      {/* 顶部控制栏 */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-20">
        <div className="text-3xl font-bold font-mono bg-black/50 px-4 py-2 rounded-lg backdrop-blur-sm border border-yellow-500/30 text-yellow-400">
          {formatTime(timeLeft)}
        </div>
        <div className="flex gap-2">
          {!isActive ? (
            <>
              <Button 
                onClick={handleStart} 
                size="lg" 
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 shadow-lg"
              >
                <Play className="mr-2 h-5 w-5" />
                开始训练
              </Button>
              <Button 
                onClick={handleExit} 
                size="lg" 
                variant="outline"
                className="border-white/50 text-white hover:bg-white/20 font-bold px-4 bg-black/50 backdrop-blur-sm"
              >
                <X className="mr-2 h-5 w-5" />
                退出
              </Button>
            </>
          ) : (
            <>
              <Button 
                onClick={handlePauseResume} 
                size="lg" 
                variant="outline"
                className={`font-bold px-6 shadow-lg ${isPaused ? 'bg-yellow-600/80 hover:bg-yellow-700 text-white border-yellow-500' : 'border-white/50 text-white hover:bg-white/20 bg-black/50 backdrop-blur-sm'}`}
              >
                {isPaused ? <Play className="mr-2 h-5 w-5" /> : <Pause className="mr-2 h-5 w-5" />}
                {isPaused ? '继续' : '暂停'}
              </Button>
              <Button 
                onClick={handleCancel} 
                size="lg" 
                variant="destructive"
                className="font-bold px-6 shadow-lg"
              >
                <Ban className="mr-2 h-5 w-5" />
                取消
              </Button>
              <Button 
                onClick={handleExit} 
                size="lg" 
                variant="outline"
                className="border-white/50 text-white hover:bg-white/20 font-bold px-4 bg-black/50 backdrop-blur-sm"
              >
                <X className="mr-2 h-5 w-5" />
                退出
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="text-center w-full h-full">
          {isPaused ? (
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full border-4 border-white/50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                <Pause className="h-12 w-12 text-white/80" />
              </div>
              <h1 className="text-5xl md:text-6xl font-bold mb-4 text-white/90 drop-shadow-lg">训练已暂停</h1>
              <p className="text-xl text-white/70 drop-shadow-md">点击"继续"按钮恢复训练</p>
            </div>
          ) : currentLocation ? (
            renderLocationIndicator()
          ) : sessionComplete ? (
            <div className="text-center">
              <h1 className="text-6xl md:text-7xl font-bold mb-4 text-green-400 drop-shadow-lg">训练完成!</h1>
              <p className="text-2xl text-white/80 mb-2 drop-shadow-md">做得好! 休息一下吧</p>
              <p className="text-lg text-white/60 drop-shadow-sm">2秒后自动返回首页...</p>
            </div>
          ) : (
            <div className="text-center">
              <h1 className="text-5xl md:text-6xl font-bold mb-4 text-white/90 drop-shadow-lg">准备开始</h1>
              <p className="text-xl text-white/70 drop-shadow-md">点击"开始训练"按钮开始Ghosting训练</p>
            </div>
          )}
        </div>
      </div>

      {sessionComplete && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
          <Button 
            onClick={handleRestart} 
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 shadow-lg"
          >
            <RotateCcw className="mr-2 h-5 w-5" />
            重新开始
          </Button>
        </div>
      )}

      <div className="absolute bottom-4 left-4 text-sm text-white/50 z-10 drop-shadow">
        Squash Ghosting 训练器
      </div>
    </div>
  );
};

export default Training;
