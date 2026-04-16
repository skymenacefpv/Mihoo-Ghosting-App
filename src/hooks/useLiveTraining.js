import { useState, useCallback, useRef, useEffect } from 'react';

const LOCATIONS = [
  { id: 'front-forehand', name: '前场正手', description: '前墙右侧靠近侧墙', color: 'bg-blue-600', textColor: 'text-white', arrow: 'ArrowUpRight', direction: { forward: true, right: true } },
  { id: 'front-backhand', name: '前场反手', description: '前墙左侧靠近侧墙', color: 'bg-green-600', textColor: 'text-white', arrow: 'ArrowUpLeft', direction: { forward: true, left: true } },
  { id: 'mid-forehand', name: '中场正手', description: '场地中间偏右侧', color: 'bg-yellow-600', textColor: 'text-white', arrow: 'ArrowRight', direction: { right: true } },
  { id: 'mid-backhand', name: '中场反手', description: '场地中间偏左侧', color: 'bg-orange-600', textColor: 'text-white', arrow: 'ArrowLeft', direction: { left: true } },
  { id: 'back-forehand', name: '后场正手', description: '后墙右侧靠近侧墙', color: 'bg-purple-600', textColor: 'text-white', arrow: 'ArrowDownRight', direction: { backward: true, right: true } },
  { id: 'back-backhand', name: '后场反手', description: '后墙左侧靠近侧墙', color: 'bg-pink-600', textColor: 'text-white', arrow: 'ArrowDownLeft', direction: { backward: true, left: true } },
];

const TRAINING_STATE = {
  WAITING_FOR_MOVE: 'waiting_for_move',
  USER_MOVED_IN_DIRECTION: 'user_moved_in_direction',
  USER_LEFT_FRAME: 'user_left_frame',
  RETURNED_TO_T: 'returned_to_T'
};

// 位置历史缓冲区大小
const POSITION_HISTORY_SIZE = 30; // 约1秒的历史（假设30fps）
// 用户离开画面后的宽容时间（毫秒）
const GRACE_PERIOD_MS = 3000;
// 方向检测的灵敏度阈值
const DIRECTION_THRESHOLD = 0.03; // 3% 的屏幕尺寸变化
// 前后移动检测阈值（肩宽变化）
const FORWARD_BACK_THRESHOLD = 0.02;

export const useLiveTraining = () => {
  const [trainingState, setTrainingState] = useState(TRAINING_STATE.WAITING_FOR_MOVE);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(true);
  const [sessionStats, setSessionStats] = useState({
    totalMoves: 0,
    successfulReturns: 0
  });
  
  // 使用 ref 来存储最新状态，避免闭包问题
  const lastStateRef = useRef(TRAINING_STATE.WAITING_FOR_MOVE);
  const isCalibratedRef = useRef(false);
  const hasCheckedCalibrationRef = useRef(false);
  const currentLocationRef = useRef(null);
  
  // 位置历史记录（用于检测移动方向）
  const positionHistoryRef = useRef([]);
  // T位参考位置
  const tReferenceRef = useRef(null);
  // 最后已知位置（当用户离开画面时使用）
  const lastKnownPositionRef = useRef(null);
  // 离开画面的时间戳
  const leftFrameTimeRef = useRef(null);
  // 是否已经检测到向目标方向移动
  const hasMovedInDirectionRef = useRef(false);
  // 目标方向
  const targetDirectionRef = useRef(null);

  // 加载保存的T位参考
  useEffect(() => {
    const savedReference = localStorage.getItem('squash-t-position-reference');
    if (savedReference) {
      tReferenceRef.current = JSON.parse(savedReference);
    }
  }, []);

  // 选择随机位置
  const selectRandomLocation = useCallback(() => {
    const randomIndex = Math.floor(Math.random() * LOCATIONS.length);
    return LOCATIONS[randomIndex];
  }, []);

  // 添加位置到历史记录
  const addPositionToHistory = useCallback((poseData) => {
    const timestamp = Date.now();
    positionHistoryRef.current.push({
      ...poseData,
      timestamp
    });
    
    // 保持历史记录在限制大小内
    if (positionHistoryRef.current.length > POSITION_HISTORY_SIZE) {
      positionHistoryRef.current.shift();
    }
  }, []);

  // 计算移动方向
  const calculateMovementDirection = useCallback(() => {
    const history = positionHistoryRef.current;
    if (history.length < 5) return null; // 需要足够的历史数据
    
    // 获取最近的数据和较早的数据进行比较
    const recent = history.slice(-3); // 最近3帧
    const earlier = history.slice(0, 3); // 最早的3帧
    
    const recentAvg = {
      centerX: recent.reduce((sum, p) => sum + p.centerX, 0) / recent.length,
      shoulderWidth: recent.reduce((sum, p) => sum + p.shoulderWidth, 0) / recent.length,
    };
    
    const earlierAvg = {
      centerX: earlier.reduce((sum, p) => sum + p.centerX, 0) / earlier.length,
      shoulderWidth: earlier.reduce((sum, p) => sum + p.shoulderWidth, 0) / earlier.length,
    };
    
    const direction = {
      left: false,
      right: false,
      forward: false,
      backward: false,
      centerXDelta: recentAvg.centerX - earlierAvg.centerX,
      shoulderWidthDelta: recentAvg.shoulderWidth - earlierAvg.shoulderWidth
    };
    
    // 检测左右移动（基于centerX）
    // 注意：因为画面是镜像的，所以需要反转逻辑
    if (recentAvg.centerX < earlierAvg.centerX - DIRECTION_THRESHOLD) {
      direction.right = true; // 画面左侧移动 = 实际右侧
    } else if (recentAvg.centerX > earlierAvg.centerX + DIRECTION_THRESHOLD) {
      direction.left = true; // 画面右侧移动 = 实际左侧
    }
    
    // 检测前后移动（基于shoulderWidth）
    // 肩宽增加 = 靠近相机 = 向后移动（假设相机在后墙）
    // 肩宽减少 = 远离相机 = 向前移动
    if (recentAvg.shoulderWidth > earlierAvg.shoulderWidth + FORWARD_BACK_THRESHOLD) {
      direction.backward = true;
    } else if (recentAvg.shoulderWidth < earlierAvg.shoulderWidth - FORWARD_BACK_THRESHOLD) {
      direction.forward = true;
    }
    
    return direction;
  }, []);

  // 检查移动方向是否匹配目标方向
  const checkDirectionMatch = useCallback((actualDirection, targetDirection) => {
    if (!actualDirection || !targetDirection) return false;
    
    let matches = 0;
    let requiredMatches = 0;
    
    // 检查每个需要的方向
    if (targetDirection.forward) {
      requiredMatches++;
      if (actualDirection.forward) matches++;
    }
    if (targetDirection.backward) {
      requiredMatches++;
      if (actualDirection.backward) matches++;
    }
    if (targetDirection.left) {
      requiredMatches++;
      if (actualDirection.left) matches++;
    }
    if (targetDirection.right) {
      requiredMatches++;
      if (actualDirection.right) matches++;
    }
    
    // 如果至少匹配一个主要方向，或者有明显移动
    if (requiredMatches === 0) return false;
    
    // 允许部分匹配：至少50%的方向匹配，或有显著移动
    const matchRatio = matches / requiredMatches;
    const hasSignificantMovement = Math.abs(actualDirection.centerXDelta) > DIRECTION_THRESHOLD || 
                                   Math.abs(actualDirection.shoulderWidthDelta) > FORWARD_BACK_THRESHOLD;
    
    return matchRatio >= 0.5 || (hasSignificantMovement && matches > 0);
  }, []);

  // 开始训练
  const startTraining = useCallback(() => {
    setIsActive(true);
    setTrainingState(TRAINING_STATE.WAITING_FOR_MOVE);
    lastStateRef.current = TRAINING_STATE.WAITING_FOR_MOVE;
    const location = selectRandomLocation();
    setCurrentLocation(location);
    currentLocationRef.current = location;
    targetDirectionRef.current = location.direction;
    hasMovedInDirectionRef.current = false;
    positionHistoryRef.current = [];
    setSessionStats({
      totalMoves: 0,
      successfulReturns: 0
    });
  }, [selectRandomLocation]);

  // 停止训练
  const stopTraining = useCallback(() => {
    setIsActive(false);
    setTrainingState(TRAINING_STATE.WAITING_FOR_MOVE);
    lastStateRef.current = TRAINING_STATE.WAITING_FOR_MOVE;
    setCurrentLocation(null);
    currentLocationRef.current = null;
    positionHistoryRef.current = [];
    lastKnownPositionRef.current = null;
    leftFrameTimeRef.current = null;
    hasMovedInDirectionRef.current = false;
  }, []);

  // 校准完成
  const handleCalibrationComplete = useCallback(() => {
    setIsCalibrating(false);
    isCalibratedRef.current = true;
    // 校准完成后自动开始训练
    startTraining();
  }, [startTraining]);

  // 重新开始校准
  const restartCalibration = useCallback(() => {
    setIsCalibrating(true);
    setIsActive(false);
    setCurrentLocation(null);
    currentLocationRef.current = null;
    setTrainingState(TRAINING_STATE.WAITING_FOR_MOVE);
    lastStateRef.current = TRAINING_STATE.WAITING_FOR_MOVE;
    positionHistoryRef.current = [];
    hasMovedInDirectionRef.current = false;
  }, []);

  // 检查是否已有校准数据
  useEffect(() => {
    if (hasCheckedCalibrationRef.current) return;
    hasCheckedCalibrationRef.current = true;
    
    const savedReference = localStorage.getItem('squash-t-position-reference');
    if (savedReference) {
      tReferenceRef.current = JSON.parse(savedReference);
      // 已有校准数据，跳过校准并自动开始训练
      setIsCalibrating(false);
      isCalibratedRef.current = true;
      startTraining();
    }
  }, [startTraining]);

  // 处理姿态更新 - 核心状态机逻辑（增强版）
  const handlePoseUpdate = useCallback((poseData) => {
    if (!isActive || isCalibrating) return;

    const { isDetected, isAtT, centerX, shoulderWidth } = poseData;
    const currentState = lastStateRef.current;

    // 添加位置到历史记录（如果检测到）
    if (isDetected && centerX !== null && shoulderWidth !== null) {
      addPositionToHistory({ centerX, shoulderWidth, isAtT });
      lastKnownPositionRef.current = { centerX, shoulderWidth, isAtT, timestamp: Date.now() };
      leftFrameTimeRef.current = null; // 重置离开时间
    }

    // 状态机转换逻辑
    switch (currentState) {
      case TRAINING_STATE.WAITING_FOR_MOVE:
        // 等待用户向目标方向移动
        
        if (!isDetected) {
          // 用户在等待阶段就离开画面，保持等待状态
          break;
        }

        // 如果已经在T位，等待离开T位
        if (isAtT) {
          // 清空历史，准备检测新移动
          if (positionHistoryRef.current.length > 10) {
            positionHistoryRef.current = positionHistoryRef.current.slice(-3);
          }
          break;
        }

        // 用户已离开T位，检查移动方向
        const movementDirection = calculateMovementDirection();
        
        if (movementDirection && checkDirectionMatch(movementDirection, targetDirectionRef.current)) {
          // 检测到向目标方向的移动！
          setTrainingState(TRAINING_STATE.USER_MOVED_IN_DIRECTION);
          lastStateRef.current = TRAINING_STATE.USER_MOVED_IN_DIRECTION;
          hasMovedInDirectionRef.current = true;
          
          setSessionStats(prev => ({
            ...prev,
            totalMoves: prev.totalMoves + 1
          }));
          
          // 清空历史，准备检测回位
          positionHistoryRef.current = [];
        }
        break;

      case TRAINING_STATE.USER_MOVED_IN_DIRECTION:
        // 用户已向目标方向移动，现在等待回到T位
        // 允许用户暂时离开画面
        
        if (!isDetected) {
          // 用户离开画面，记录时间
          if (!leftFrameTimeRef.current) {
            leftFrameTimeRef.current = Date.now();
            setTrainingState(TRAINING_STATE.USER_LEFT_FRAME);
            lastStateRef.current = TRAINING_STATE.USER_LEFT_FRAME;
          }
          break;
        }

        // 如果检测到回到T位
        if (isAtT) {
          setTrainingState(TRAINING_STATE.RETURNED_TO_T);
          lastStateRef.current = TRAINING_STATE.RETURNED_TO_T;
          
          setSessionStats(prev => ({
            ...prev,
            successfulReturns: prev.successfulReturns + 1
          }));

          // 短暂延迟后选择新位置并回到等待状态
          setTimeout(() => {
            const newLocation = selectRandomLocation();
            setCurrentLocation(newLocation);
            currentLocationRef.current = newLocation;
            targetDirectionRef.current = newLocation.direction;
            hasMovedInDirectionRef.current = false;
            positionHistoryRef.current = [];
            
            setTrainingState(TRAINING_STATE.WAITING_FOR_MOVE);
            lastStateRef.current = TRAINING_STATE.WAITING_FOR_MOVE;
          }, 800); // 800ms 的成功反馈时间
        }
        break;

      case TRAINING_STATE.USER_LEFT_FRAME:
        // 用户在移动后离开画面，给予宽容时间返回
        
        const now = Date.now();
        const timeSinceLeft = leftFrameTimeRef.current ? now - leftFrameTimeRef.current : 0;
        
        // 检查是否在宽容期内检测到用户
        if (isDetected) {
          // 用户回来了，检查是否在T位
          leftFrameTimeRef.current = null;
          
          if (isAtT) {
            // 用户直接回到了T位
            setTrainingState(TRAINING_STATE.RETURNED_TO_T);
            lastStateRef.current = TRAINING_STATE.RETURNED_TO_T;
            
            setSessionStats(prev => ({
              ...prev,
              successfulReturns: prev.successfulReturns + 1
            }));

            setTimeout(() => {
              const newLocation = selectRandomLocation();
              setCurrentLocation(newLocation);
              currentLocationRef.current = newLocation;
              targetDirectionRef.current = newLocation.direction;
              hasMovedInDirectionRef.current = false;
              positionHistoryRef.current = [];
              
              setTrainingState(TRAINING_STATE.WAITING_FOR_MOVE);
              lastStateRef.current = TRAINING_STATE.WAITING_FOR_MOVE;
            }, 800);
          } else {
            // 用户回来了但不在T位，回到等待回位状态
            setTrainingState(TRAINING_STATE.USER_MOVED_IN_DIRECTION);
            lastStateRef.current = TRAINING_STATE.USER_MOVED_IN_DIRECTION;
          }
        } else if (timeSinceLeft > GRACE_PERIOD_MS) {
          // 宽容期已过，用户仍未出现，视为失败，切换到下一个位置
          setTrainingState(TRAINING_STATE.WAITING_FOR_MOVE);
          lastStateRef.current = TRAINING_STATE.WAITING_FOR_MOVE;
          hasMovedInDirectionRef.current = false;
          positionHistoryRef.current = [];
          leftFrameTimeRef.current = null;
          
          // 切换到下一个位置
          setTimeout(() => {
            const newLocation = selectRandomLocation();
            setCurrentLocation(newLocation);
            currentLocationRef.current = newLocation;
            targetDirectionRef.current = newLocation.direction;
          }, 500);
        }
        break;

      case TRAINING_STATE.RETURNED_TO_T:
        // 这个状态很短暂，由上面的 setTimeout 处理转换
        break;

      default:
        break;
    }
  }, [isActive, isCalibrating, addPositionToHistory, calculateMovementDirection, checkDirectionMatch, selectRandomLocation]);

  // 获取状态显示文本
  const getStateDisplayText = useCallback(() => {
    switch (trainingState) {
      case TRAINING_STATE.WAITING_FOR_MOVE:
        return '准备移动...';
      case TRAINING_STATE.USER_MOVED_IN_DIRECTION:
        return '已检测到移动，等待回位...';
      case TRAINING_STATE.USER_LEFT_FRAME:
        return '检测中...';
      case TRAINING_STATE.RETURNED_TO_T:
        return '已回到T位！';
      default:
        return '';
    }
  }, [trainingState]);

  // 获取状态颜色
  const getStateColor = useCallback(() => {
    switch (trainingState) {
      case TRAINING_STATE.WAITING_FOR_MOVE:
        return 'text-yellow-400';
      case TRAINING_STATE.USER_MOVED_IN_DIRECTION:
        return 'text-orange-400';
      case TRAINING_STATE.USER_LEFT_FRAME:
        return 'text-blue-400';
      case TRAINING_STATE.RETURNED_TO_T:
        return 'text-green-400';
      default:
        return 'text-white';
    }
  }, [trainingState]);

  return {
    // 状态
    trainingState,
    currentLocation,
    isActive,
    isCalibrating,
    sessionStats,
    TRAINING_STATE,
    
    // 方法
    startTraining,
    stopTraining,
    handleCalibrationComplete,
    restartCalibration,
    handlePoseUpdate,
    getStateDisplayText,
    getStateColor,
    
    // 位置配置
    locations: LOCATIONS
  };
};
