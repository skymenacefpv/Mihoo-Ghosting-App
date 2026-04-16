import { useState, useEffect, useCallback, useRef } from 'react';

const LOCATIONS = [
  { id: 'front-forehand', name: '前场正手', color: 'bg-blue-600', alternateColor: 'bg-blue-400' },
  { id: 'front-backhand', name: '前场反手', color: 'bg-green-600', alternateColor: 'bg-green-400' },
  { id: 'mid-forehand', name: '中场正手', color: 'bg-yellow-600', alternateColor: 'bg-yellow-400' },
  { id: 'mid-backhand', name: '中场反手', color: 'bg-orange-600', alternateColor: 'bg-orange-400' },
  { id: 'back-forehand', name: '后场正手', color: 'bg-purple-600', alternateColor: 'bg-purple-400' },
  { id: 'back-backhand', name: '后场反手', color: 'bg-pink-600', alternateColor: 'bg-pink-400' },
];

const T_POSITION = { id: 't-position', name: 'T', color: 'bg-black' };

// 训练阶段
const PHASE = {
  LOCATION: 'location',
  DELAY: 'delay',
  T_POSITION: 't-position',
};

export const useGhosting = (settings) => {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isTPosition, setIsTPosition] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  const [useAlternateColor, setUseAlternateColor] = useState(false);
  const [phase, setPhase] = useState(PHASE.LOCATION);
  
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);
  const lastLocationIdRef = useRef(null);
  const pausedPhaseRef = useRef(null);
  const pausedLocationRef = useRef(null);
  
  // 使用 ref 存储最新的 settings
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  // 获取随机位置，允许连续两次选择相同的位置，但切换颜色
  const getRandomLocation = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * LOCATIONS.length);
    return LOCATIONS[randomIndex];
  }, []);

  // 生成随机时间间隔（在最小值和最大值之间）
  const getRandomInterval = useCallback(() => {
    const currentSettings = settingsRef.current;
    if (currentSettings.useDynamicInterval) {
      const min = currentSettings.minInterval || 3;
      const max = currentSettings.maxInterval || 6;
      // 在 min 和 max 之间生成随机数，保留一位小数
      return Math.round((min + Math.random() * (max - min)) * 10) / 10;
    }
    return currentSettings.interval || 3;
  }, []);

  // 获取位置的实际间隔时间（应用速度比例和随机时间）
  const getLocationInterval = useCallback((locationId) => {
    const currentSettings = settingsRef.current;
    const baseInterval = getRandomInterval();
    const scalers = currentSettings.positionScalers || {};
    const scaler = scalers[locationId] ?? 1.0;
    return Math.round(baseInterval * scaler * 1000); // 转换为毫秒
  }, [getRandomInterval]);

  const clearAllTimers = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const scheduleNextPhase = useCallback(() => {
    const currentSettings = settingsRef.current;
    
    // 阶段 1: 显示位置
    setPhase(PHASE.LOCATION);
    setIsTPosition(false);
    
    const newLocation = getRandomLocation();
    
    // 检查是否与上一次位置相同，如果是则切换颜色
    if (newLocation.id === lastLocationIdRef.current) {
      setUseAlternateColor(prev => !prev);
    } else {
      setUseAlternateColor(false);
    }
    
    lastLocationIdRef.current = newLocation.id;
    setCurrentLocation(newLocation);
    
    // 计算该位置的实际间隔时间（包含随机时间）
    const locationInterval = getLocationInterval(newLocation.id);
    
    // 设置位置显示定时器（使用实际间隔时间）
    timeoutRef.current = setTimeout(() => {
      if (!currentSettings.includeTPosition) {
        // 不包含 T 位，直接显示下一个位置
        scheduleNextPhase();
        return;
      }
      
      // 直接显示 T 位（移除延迟阶段）
      setPhase(PHASE.T_POSITION);
      setIsTPosition(true);
      
      timeoutRef.current = setTimeout(() => {
        scheduleNextPhase();
      }, currentSettings.tPositionDuration * 1000);
    }, locationInterval);
  }, [getRandomLocation, getLocationInterval]);

  const startSession = useCallback(() => {
    setSessionComplete(false);
    setIsActive(true);
    setIsPaused(false);
    setTimeLeft(settingsRef.current.duration * 60);
    lastLocationIdRef.current = null;
    setUseAlternateColor(false);
    
    // 开始第一阶段
    scheduleNextPhase();
  }, [scheduleNextPhase]);

  const stopSession = useCallback(() => {
    setIsActive(false);
    setIsPaused(false);
    clearAllTimers();
    setCurrentLocation(null);
    setIsTPosition(false);
    setPhase(PHASE.LOCATION);
    lastLocationIdRef.current = null;
    setUseAlternateColor(false);
    pausedPhaseRef.current = null;
    pausedLocationRef.current = null;
  }, [clearAllTimers]);

  const pauseSession = useCallback(() => {
    setIsPaused(true);
    // 保存当前状态
    pausedPhaseRef.current = phase;
    pausedLocationRef.current = currentLocation;
    // 清除所有定时器
    clearAllTimers();
  }, [phase, currentLocation, clearAllTimers]);

  const resumeSession = useCallback(() => {
    setIsPaused(false);
    const currentSettings = settingsRef.current;
    
    // 恢复训练，继续下一个阶段
    if (pausedPhaseRef.current === PHASE.LOCATION && pausedLocationRef.current) {
      // 如果在位置显示阶段暂停，继续显示T位
      if (currentSettings.includeTPosition) {
        setPhase(PHASE.T_POSITION);
        setIsTPosition(true);
        
        timeoutRef.current = setTimeout(() => {
          scheduleNextPhase();
        }, currentSettings.tPositionDuration * 1000);
      } else {
        scheduleNextPhase();
      }
    } else {
      // 其他情况直接继续下一个循环
      scheduleNextPhase();
    }
    
    pausedPhaseRef.current = null;
    pausedLocationRef.current = null;
  }, [scheduleNextPhase]);

  // 训练总倒计时（每秒更新）
  useEffect(() => {
    if (isActive && timeLeft > 0 && !isPaused) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setIsActive(false);
            setSessionComplete(true);
            clearAllTimers();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive, timeLeft, isPaused, clearAllTimers]);

  // 清理定时器
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  const formatTime = useCallback((seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // 根据是否使用备用颜色返回当前显示的位置
  const displayLocation = isTPosition 
    ? T_POSITION 
    : (currentLocation ? {
        ...currentLocation,
        color: useAlternateColor && currentLocation.alternateColor 
          ? currentLocation.alternateColor 
          : currentLocation.color
      } : null);

  return {
    isActive,
    isPaused,
    timeLeft,
    currentLocation: displayLocation,
    sessionComplete,
    isDelay: false, // 始终返回false，因为延迟阶段已被移除
    startSession,
    stopSession,
    pauseSession,
    resumeSession,
    formatTime,
  };
};
