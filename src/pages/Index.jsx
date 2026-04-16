import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Play, Settings, Dumbbell, Video, CheckCircle, ArrowRight, Palette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LiveTrainingCamera from '@/components/LiveTrainingCamera';
import { toast } from 'sonner';
import { loadSettings, saveSettings, DIFFICULTY_MAP, DURATION_OPTIONS } from '@/lib/storage';

const Index = () => {
  const navigate = useNavigate();
  const [trainingMode, setTrainingMode] = useState('random');
  const [returnToTCount, setReturnToTCount] = useState(0);
  const [lastReturnTime, setLastReturnTime] = useState(null);
  
  // 快速设置状态
  const [quickSettings, setQuickSettings] = useState({
    duration: 5,
    difficulty: 'mid'
  });

  // 加载保存的设置
  useEffect(() => {
    const settings = loadSettings();
    setQuickSettings({
      duration: settings.duration || 5,
      difficulty: settings.difficulty || 'mid'
    });
  }, []);

  // 更新快速设置并同步到存储
  const updateQuickSetting = (key, value) => {
    const newSettings = { ...quickSettings, [key]: value };
    setQuickSettings(newSettings);
    
    // 同步到主设置
    const currentSettings = loadSettings();
    const updatedSettings = {
      ...currentSettings,
      [key]: value
    };
    
    // 如果修改了难度，同时更新interval
    if (key === 'difficulty' && DIFFICULTY_MAP[value]) {
      updatedSettings.interval = DIFFICULTY_MAP[value].interval;
    }
    
    saveSettings(updatedSettings);
    
    // 显示提示
    if (key === 'difficulty') {
      const diffInfo = DIFFICULTY_MAP[value];
      toast.success(`难度已切换为：${diffInfo.label}`, {
        description: `位置切换间隔：${diffInfo.interval}秒`,
        duration: 2000
      });
    } else if (key === 'duration') {
      toast.success(`训练时长已设置为：${value}分钟`, {
        duration: 2000
      });
    }
  };

  const handleStartTraining = () => {
    if (trainingMode === 'random') {
      navigate('/training', { state: { autoStart: true } });
    } else {
      navigate('/live-training');
    }
  };

  // 处理用户回到T位的回调（预览模式）
  const handleReturnToT = (data) => {
    console.log('用户已回到T位:', data);
    setReturnToTCount(prev => prev + 1);
    setLastReturnTime(new Date().toLocaleTimeString());
    
    toast.success('已回到T位！', {
      description: `中心位置: ${data.centerX.toFixed(3)}, 肩宽: ${data.shoulderWidth.toFixed(3)}`,
      duration: 1500,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-600 via-fuchsia-500 to-pink-700 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-2xl mb-4 shadow-lg shadow-black/20">
            <Dumbbell className="h-10 w-10 text-pink-600" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">壁球 Ghosting</h1>
          <p className="text-pink-100">专业脚步训练助手</p>
        </div>

        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <CardContent className="p-6 space-y-4">
            {/* 模式切换器 */}
            <div className="flex bg-black/20 rounded-lg p-1">
              <button
                onClick={() => setTrainingMode('random')}
                className={`flex-1 flex items-center justify-center py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  trainingMode === 'random'
                    ? 'bg-white text-pink-600 shadow-sm'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <Play className="w-4 h-4 mr-2" />
                随机位置
              </button>
              <button
                onClick={() => setTrainingMode('live')}
                className={`flex-1 flex items-center justify-center py-2 px-4 rounded-md text-sm font-medium transition-all ${
                  trainingMode === 'live'
                    ? 'bg-white text-pink-600 shadow-sm'
                    : 'text-white/70 hover:text-white'
                }`}
              >
                <Video className="w-4 h-4 mr-2" />
                实时训练
              </button>
            </div>

            {/* 快速设置区域 */}
            <div className="border-t border-white/20 pt-4 space-y-4">
              {/* 训练时长选择 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white/90 text-sm font-medium flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-yellow-400 rounded-full"></span>
                    训练时长
                  </span>
                  <span className="text-white/60 text-xs">{quickSettings.duration}分钟</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {DURATION_OPTIONS.map((duration) => (
                    <button
                      key={duration}
                      onClick={() => updateQuickSetting('duration', duration)}
                      className={`py-2 px-1 rounded-lg text-sm font-medium transition-all ${
                        quickSettings.duration === duration
                          ? 'bg-white text-pink-600 shadow-md'
                          : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/20'
                      }`}
                    >
                      {duration}分钟
                    </button>
                  ))}
                </div>
              </div>

              {/* 难度选择 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white/90 text-sm font-medium flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
                    训练难度
                  </span>
                  <span className="text-white/60 text-xs">
                    间隔{DIFFICULTY_MAP[quickSettings.difficulty].interval}秒
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(DIFFICULTY_MAP).map(([key, value]) => (
                    <button
                      key={key}
                      onClick={() => updateQuickSetting('difficulty', key)}
                      className={`py-2 px-1 rounded-lg text-sm font-medium transition-all ${
                        quickSettings.difficulty === key
                          ? 'bg-white text-pink-600 shadow-md'
                          : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/20'
                      }`}
                    >
                      {value.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="border-t border-white/20 pt-4">
              {trainingMode === 'random' ? (
                // 随机位置模式 - 原有功能
                <div className="space-y-4">
                  <Button 
                    onClick={handleStartTraining}
                    size="lg" 
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 text-lg font-bold"
                  >
                    <Play className="mr-3 h-5 w-5" />
                    开始训练
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline"
                      onClick={() => navigate('/settings')}
                      size="lg" 
                      className="w-full border-white/50 text-white hover:bg-white/20 h-14 text-base font-bold bg-black/20"
                    >
                      <Settings className="mr-2 h-5 w-5" />
                      训练设置
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => navigate('/court-editor')}
                      size="lg" 
                      className="w-full border-white/50 text-white hover:bg-white/20 h-14 text-base font-bold bg-black/20"
                    >
                      <Palette className="mr-2 h-5 w-5" />
                      编辑背景
                    </Button>
                  </div>
                </div>
              ) : (
                // 实时训练模式 - 相机姿态检测
                <div className="space-y-4">
                  <div className="bg-black/20 rounded-lg p-4 text-white/80 text-sm space-y-2">
                    <p className="font-medium text-white">实时训练模式</p>
                    <p>• 使用相机自动检测您的位置</p>
                    <p>• 自动识别离开T位和返回T位</p>
                    <p>• 无需手动操作，全程自动切换</p>
                    <p>• 开始前需要校准T位位置</p>
                  </div>
                  
                  <Button 
                    onClick={handleStartTraining}
                    size="lg" 
                    className="w-full bg-green-600 hover:bg-green-700 text-white h-14 text-lg font-bold"
                  >
                    <Video className="mr-3 h-5 w-5" />
                    开始实时训练
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline"
                      onClick={() => navigate('/settings')}
                      size="lg" 
                      className="w-full border-white/50 text-white hover:bg-white/20 h-14 text-base font-bold bg-black/20"
                    >
                      <Settings className="mr-2 h-5 w-5" />
                      校准设置
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => navigate('/court-editor')}
                      size="lg" 
                      className="w-full border-white/50 text-white hover:bg-white/20 h-14 text-base font-bold bg-black/20"
                    >
                      <Palette className="mr-2 h-5 w-5" />
                      编辑背景
                    </Button>
                  </div>
                  
                  {/* T位返回统计（预览） */}
                  {returnToTCount > 0 && (
                    <div className="flex items-center justify-between bg-green-500/20 border border-green-400/30 rounded-lg px-4 py-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-400" />
                        <span className="text-white font-medium">回到T位次数</span>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-bold text-green-400">{returnToTCount}</span>
                        {lastReturnTime && (
                          <p className="text-xs text-white/70">上次: {lastReturnTime}</p>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <p className="text-center text-sm text-white/60">
                    点击"开始实时训练"进入自动检测模式
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center space-y-2 text-sm text-pink-100">
          <p>Ghosting 是壁球最基础也是最重要的训练方式</p>
          <p>提升脚步移动速度和场上位置感</p>
        </div>
      </div>
    </div>
  );
};

export default Index;
