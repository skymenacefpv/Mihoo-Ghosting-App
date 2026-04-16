
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { ArrowLeft, Save, RotateCcw, Target, Clock, X, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { loadSettings, saveSettings } from '@/lib/storage';
import { toast } from 'sonner';
import LiveTrainingCamera from '@/components/LiveTrainingCamera';

const positionConfig = [
{ id: 'front-forehand', name: '前场正手', description: '前墙右侧靠近侧墙', bgColor: 'bg-blue-100', textColor: 'text-blue-800', descColor: 'text-blue-600', group: 'front' },
{ id: 'front-backhand', name: '前场反手', description: '前墙左侧靠近侧墙', bgColor: 'bg-green-100', textColor: 'text-green-800', descColor: 'text-green-600', group: 'front' },
{ id: 'mid-forehand', name: '中场正手', description: '场地中间偏右侧', bgColor: 'bg-yellow-100', textColor: 'text-yellow-800', descColor: 'text-yellow-700', group: 'mid' },
{ id: 'mid-backhand', name: '中场反手', description: '场地中间偏左侧', bgColor: 'bg-orange-100', textColor: 'text-orange-800', descColor: 'text-orange-700', group: 'mid' },
{ id: 'back-forehand', name: '后场正手', description: '后墙右侧靠近侧墙', bgColor: 'bg-purple-100', textColor: 'text-purple-800', descColor: 'text-purple-600', group: 'back' },
{ id: 'back-backhand', name: '后场反手', description: '后墙左侧靠近侧墙', bgColor: 'bg-pink-100', textColor: 'text-pink-800', descColor: 'text-pink-600', group: 'back' }];


const groupConfig = {
  front: { name: '前场', description: '前场正手 & 前场反手', color: 'bg-teal-50', textColor: 'text-teal-800', borderColor: 'border-teal-200', accentColor: 'bg-teal-500' },
  mid: { name: '中场', description: '中场正手 & 中场反手', color: 'bg-amber-50', textColor: 'text-amber-800', borderColor: 'border-amber-200', accentColor: 'bg-amber-500' },
  back: { name: '后场', description: '后场正手 & 后场反手', color: 'bg-indigo-50', textColor: 'text-indigo-800', borderColor: 'border-indigo-200', accentColor: 'bg-indigo-500' }
};

const Settings = () => {
  const [settings, setSettings] = useState({
    duration: 5,
    interval: 3,
    includeTPosition: true,
    highContrast: true,
    countdownDuration: 3,
    tPositionDuration: 2,
    calibrationDuration: 5,
    tComfortZone: 0,
    useDynamicInterval: false,
    minInterval: 3,
    maxInterval: 6,
    showReturnConfirmation: true,
    positionScalers: {
      'front-forehand': 1.0,
      'front-backhand': 1.0,
      'mid-forehand': 1.0,
      'mid-backhand': 1.0,
      'back-forehand': 1.0,
      'back-backhand': 1.0
    }
  });

  // 全屏校准模式状态
  const [isFullScreenCalibrating, setIsFullScreenCalibrating] = useState(false);
  const [calibrationComplete, setCalibrationComplete] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, []);

  const handleSave = () => {
    saveSettings(settings);
    toast.success('设置已保存');
  };

  const handleResetScalers = () => {
    setSettings((prev) => ({
      ...prev,
      positionScalers: {
        'front-forehand': 1.0,
        'front-backhand': 1.0,
        'mid-forehand': 1.0,
        'mid-backhand': 1.0,
        'back-forehand': 1.0,
        'back-backhand': 1.0
      }
    }));
    toast.success('速度比例已重置为默认值');
  };

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const updatePositionScaler = (positionId, value) => {
    setSettings((prev) => ({
      ...prev,
      positionScalers: {
        ...prev.positionScalers,
        [positionId]: value
      }
    }));
  };

  // 更新场区总控滑块
  const updateGroupScaler = (group, value) => {
    const groupPositions = positionConfig.filter((p) => p.group === group).map((p) => p.id);
    setSettings((prev) => ({
      ...prev,
      positionScalers: {
        ...prev.positionScalers,
        ...Object.fromEntries(groupPositions.map((id) => [id, value]))
      }
    }));
  };

  // 获取场区的当前比例值（取平均值）
  const getGroupScaler = (group) => {
    const groupPositions = positionConfig.filter((p) => p.group === group);
    const sum = groupPositions.reduce((acc, p) => acc + (settings.positionScalers?.[p.id] ?? 1.0), 0);
    return sum / groupPositions.length;
  };

  // 计算实际显示时间
  const getActualInterval = (scaler) => {
    const baseInterval = settings.useDynamicInterval 
      ? `${settings.minInterval}-${settings.maxInterval}秒(随机)` 
      : `${settings.interval}秒`;
    if (settings.useDynamicInterval) return baseInterval;
    return `${(settings.interval * scaler).toFixed(1)}秒`;
  };

  // 计算当前舒适区对应的容差百分比
  const getComfortTolerance = () => {
    // 0 -> 5%, 100 -> 50%
    const comfortZone = settings.tComfortZone ?? 0;
    const tolerance = 5 + (comfortZone / 100) * 45;
    return tolerance.toFixed(1);
  };

  // 按组获取位置配置
  const getPositionsByGroup = (group) => positionConfig.filter((p) => p.group === group);

  // 渲染单个位置滑块
  const renderPositionSlider = (position) =>
  <div key={position.id} className={`p-3 ${position.bgColor} rounded-lg space-y-2`}>
      <div className="flex justify-between items-start">
        <div>
          <span className={`font-bold text-sm ${position.textColor}`}>{position.name}</span>
          <p className={`text-xs ${position.descColor} mt-0.5 leading-tight`}>{position.description}</p>
        </div>
        <span className={`text-base font-bold ${position.textColor}`}>
          {getActualInterval(settings.positionScalers?.[position.id] ?? 1.0)}
        </span>
      </div>
      <div className="space-y-1">
        <Slider
        min={0.0}
        max={2.0}
        step={0.1}
        value={[settings.positionScalers?.[position.id] ?? 1.0]}
        onValueChange={([value]) => updatePositionScaler(position.id, value)}
        className="w-full" />
      
        <div className="flex justify-between text-xs text-slate-500">
          <span>0.0x</span>
          <span className={`font-medium ${position.textColor}`}>
            {(settings.positionScalers?.[position.id] ?? 1.0).toFixed(1)}x
          </span>
          <span>2.0x</span>
        </div>
      </div>
    </div>;


  // 渲染场区总控滑块（宽版）
  const renderGroupMasterSlider = (groupKey) => {
    const group = groupConfig[groupKey];
    const scaler = getGroupScaler(groupKey);

    return (
      <div className={`p-4 ${group.color} border-l-4 ${group.borderColor.replace('border-', 'border-')} rounded-r-lg space-y-2`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${group.accentColor}`}></div>
            <span className={`font-bold ${group.textColor}`}>{group.name}总控</span>
          </div>
          <span className={`text-lg font-bold ${group.textColor}`}>
            {settings.useDynamicInterval ? `${settings.minInterval}-${settings.maxInterval}秒` : `${(settings.interval * scaler).toFixed(1)}秒`}
          </span>
        </div>
        <div className="space-y-1">
          <Slider
            min={0.0}
            max={2.0}
            step={0.1}
            value={[scaler]}
            onValueChange={([value]) => updateGroupScaler(groupKey, value)}
            className="w-full" />
          
          <div className="flex justify-between text-xs text-slate-500">
            <span>0.0x (快)</span>
            <span className={`font-medium ${group.textColor}`}>
              {scaler.toFixed(1)}x
            </span>
            <span>2.0x (慢)</span>
          </div>
        </div>
      </div>);

  };

  // 渲染完整的场区控制组
  const renderCourtGroup = (groupKey) => {
    const positions = getPositionsByGroup(groupKey);

    return (
      <div key={groupKey} className="space-y-3">
        {/* 两个单个位置滑块并排 */}
        <div className="grid grid-cols-2 gap-3">
          {positions.map((position) => renderPositionSlider(position))}
        </div>
        {/* 总控滑块横跨宽度 */}
        {renderGroupMasterSlider(groupKey)}
      </div>);

  };

  // 更新范围滑块的值
  const handleRangeChange = ([min, max]) => {
    setSettings((prev) => ({
      ...prev,
      minInterval: min,
      maxInterval: max
    }));
  };

  // 开始全屏校准
  const startFullScreenCalibration = () => {
    setIsFullScreenCalibrating(true);
    setCalibrationComplete(false);
  };

  // 退出全屏校准
  const exitFullScreenCalibration = () => {
    setIsFullScreenCalibrating(false);
    setCalibrationComplete(false);
  };

  // 校准完成回调
  const handleCalibrationComplete = (reference) => {
    setCalibrationComplete(true);
    toast.success('T位校准完成！', {
      description: '参考位置已保存，可以在实时训练中使用',
    });
    // 2秒后自动关闭校准界面
    setTimeout(() => {
      setIsFullScreenCalibrating(false);
      setCalibrationComplete(false);
    }, 2000);
  };

  // 全屏校准模式渲染
  if (isFullScreenCalibrating) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        {/* 顶部控制栏 */}
        <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
          <div className="flex items-center gap-3">
            <Target className="w-6 h-6 text-purple-400" />
            <span className="text-white font-bold text-lg">T位校准模式</span>
          </div>
          <Button
            onClick={exitFullScreenCalibration}
            variant="destructive"
            size="sm"
            className="bg-red-600 hover:bg-red-700"
          >
            <X className="w-4 h-4 mr-1" />
            退出校准
          </Button>
        </div>

        {/* 全屏相机组件 */}
        <LiveTrainingCamera
          isCalibrating={true}
          onCalibrationComplete={handleCalibrationComplete}
          className="w-full h-full"
        />

        {/* 校准完成覆盖层 */}
        {calibrationComplete && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/60">
            <div className="text-center">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-green-500 flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">校准完成！</h2>
              <p className="text-white/80">正在返回设置页面...</p>
            </div>
          </div>
        )}

        {/* 底部提示 */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center z-30">
          <p className="text-white/90 text-lg font-medium bg-black/50 px-6 py-3 rounded-full backdrop-blur-sm">
            请站在T位（场地中心），面向相机，点击相机界面中的"开始校准"按钮
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-slate-900">训练设置</h1>
          <Link to="/">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回首页
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ghosting 训练参数</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="duration" className="text-base font-medium">训练总时长 (分钟)

                </Label>
                <span className="text-lg font-bold text-blue-600">{settings.duration} 分钟</span>
              </div>
              <Slider
                id="duration"
                min={1}
                max={30}
                step={1}
                value={[settings.duration]}
                onValueChange={([value]) => updateSetting('duration', value)} />
              
              <p className="text-sm text-slate-500">设置每次训练的总时长</p>
            </div>

            {/* 动态时间间隔开关 */}
            <div className="flex items-center justify-between py-4 border-t border-slate-200">
              <div className="space-y-0.5">
                <Label htmlFor="dynamic-interval" className="text-base font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  动态随机时间间隔
                </Label>
                <p className="text-sm text-slate-500">在设定范围内随机选择每个位置的显示时间</p>
              </div>
              <Switch
                id="dynamic-interval"
                checked={settings.useDynamicInterval}
                onCheckedChange={(checked) => updateSetting('useDynamicInterval', checked)}
              />
            </div>

            {/* 根据开关显示不同的设置 */}
            {settings.useDynamicInterval ? (
              // 动态时间间隔模式：使用单个范围滑块
              <div className="space-y-4 pl-4 border-l-2 border-blue-200">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label className="text-base font-medium">时间间隔范围 (秒)</Label>
                    <span className="text-lg font-bold text-blue-600">
                      {settings.minInterval} - {settings.maxInterval} 秒
                    </span>
                  </div>
                  <Slider
                    min={1}
                    max={15}
                    step={0.5}
                    value={[settings.minInterval, settings.maxInterval]}
                    onValueChange={handleRangeChange}
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>1秒</span>
                    <span>8秒</span>
                    <span>15秒</span>
                  </div>
                  <p className="text-sm text-slate-500">拖动滑块两端设置时间范围的最小值和最大值</p>
                </div>

                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <strong>当前设置：</strong>每次位置切换时，系统会在 {settings.minInterval}-{settings.maxInterval} 秒范围内随机选择一个时间。
                  </p>
                </div>
              </div>
            ) : (
              // 固定时间间隔模式
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <Label htmlFor="interval" className="text-base font-medium">每个位置来回时间</Label>
                  <span className="text-lg font-bold text-blue-600">{settings.interval} 秒</span>
                </div>
                <Slider
                  id="interval"
                  min={1}
                  max={10}
                  step={1}
                  value={[settings.interval]}
                  onValueChange={([value]) => updateSetting('interval', value)}
                />
                <p className="text-sm text-slate-500">每个位置的基础持续时间，可通过下方速度比例进行微调</p>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="countdownDuration" className="text-base font-medium">开始倒计时时长 (秒)

                </Label>
                <span className="text-lg font-bold text-blue-600">{settings.countdownDuration} 秒</span>
              </div>
              <Slider
                id="countdownDuration"
                min={1}
                max={10}
                step={1}
                value={[settings.countdownDuration]}
                onValueChange={([value]) => updateSetting('countdownDuration', value)} />
              
              <p className="text-sm text-slate-500">从首页点击开始训练后的倒计时准备时间</p>
            </div>

            <div className="flex items-center justify-between py-4 border-t border-slate-200">
              <div className="space-y-0.5">
                <Label htmlFor="t-position" className="text-base font-medium">T位回位提示</Label>
                <p className="text-sm text-slate-500">每次击球后提示返回T位中心</p>
              </div>
              <Switch
                id="t-position"
                checked={settings.includeTPosition}
                onCheckedChange={(checked) => updateSetting('includeTPosition', checked)} />
              
            </div>

            {settings.includeTPosition &&
            <div className="space-y-3 pl-4 border-l-2 border-blue-200">
                <div className="flex justify-between items-center">
                  <Label htmlFor="tPositionDuration" className="text-base font-medium">T位休息时间 (秒)

                </Label>
                  <span className="text-lg font-bold text-blue-600">{settings.tPositionDuration} 秒</span>
                </div>
                <Slider
                id="tPositionDuration"
                min={0.5}
                max={5}
                step={0.5}
                value={[settings.tPositionDuration]}
                onValueChange={([value]) => updateSetting('tPositionDuration', value)} />
              
                <p className="text-sm text-slate-500">"返回T位"提示在屏幕上显示的持续时间</p>
              </div>
            }

            <div className="flex items-center justify-between py-4 border-t border-slate-200">
              <div className="space-y-0.5">
                <Label htmlFor="contrast" className="text-base font-medium">高对比度模式</Label>
                <p className="text-sm text-slate-500">增强文字对比度，更容易看清</p>
              </div>
              <Switch
                id="contrast"
                checked={settings.highContrast}
                onCheckedChange={(checked) => updateSetting('highContrast', checked)} />
              
            </div>

            <div className="pt-4 border-t border-slate-200">
              <Button
                onClick={handleSave}
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="lg">
                
                <Save className="mr-2 h-4 w-4" />
                保存设置
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* T位校准设置卡片 */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              T位校准设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 校准倒计时设置 */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <Label htmlFor="calibrationDuration" className="text-base font-medium">
                  校准倒计时时间
                </Label>
                <span className="text-lg font-bold text-blue-600">{settings.calibrationDuration} 秒</span>
              </div>
              <Slider
                id="calibrationDuration"
                min={3}
                max={8}
                step={1}
                value={[settings.calibrationDuration]}
                onValueChange={([value]) => updateSetting('calibrationDuration', value)}
              />
              <p className="text-sm text-slate-500">
                校准时用户需要在T位保持的秒数（3-8秒）
              </p>
            </div>

            {/* T位舒适区设置 */}
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div className="flex justify-between items-center">
                <Label htmlFor="tComfortZone" className="text-base font-medium">
                  T位舒适区
                </Label>
                <span className="text-lg font-bold text-blue-600">{settings.tComfortZone ?? 0}</span>
              </div>
              <Slider
                id="tComfortZone"
                min={0}
                max={100}
                step={1}
                value={[settings.tComfortZone ?? 0]}
                onValueChange={([value]) => updateSetting('tComfortZone', value)}
              />
              <div className="flex justify-between text-xs text-slate-400">
                <span>严格 (5%容差)</span>
                <span>宽松 (50%容差)</span>
              </div>
              <p className="text-sm text-slate-500">
                当前容差: <span className="font-bold text-blue-600">{getComfortTolerance()}%</span>。
                数值越低要求越严格，越高则允许更大的偏差范围。
              </p>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <Button
                onClick={startFullScreenCalibration}
                className="w-full bg-green-600 hover:bg-green-700"
                size="lg">
                <Target className="mr-2 h-4 w-4" />
                校准T位位置
              </Button>
              <p className="text-sm text-slate-500 mt-2 text-center">
                点击立即进入全屏校准模式
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>位置速度比例</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetScalers}
              className="text-slate-600">
              
              <RotateCcw className="mr-2 h-4 w-4" />
              重置默认值
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-500 mb-6">
              调整各个位置的相对速度比例。例如：设置为0.9表示该位置的时间为基础间隔的90%（更快），1.2表示120%（更慢）。
              当前基础间隔为 <span className="font-bold text-blue-600">
                {settings.useDynamicInterval 
                  ? `${settings.minInterval}-${settings.maxInterval}秒(随机)` 
                  : `${settings.interval}秒`}
              </span>
            </p>
            
            {/* 三个场区控制组 */}
            <div className="space-y-6">
              {renderCourtGroup('front')}
              <div className="border-t border-slate-200"></div>
              {renderCourtGroup('mid')}
              <div className="border-t border-slate-200"></div>
              {renderCourtGroup('back')}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>);

};

export default Settings;

