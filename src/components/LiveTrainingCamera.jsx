
import { useEffect, useRef, useState } from 'react';
import { Pose } from '@mediapipe/pose';
import { Camera } from '@mediapipe/camera_utils';
import { Camera as CameraIcon, AlertCircle, Target, Timer, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { loadSettings } from '@/lib/storage';

const LiveTrainingCamera = ({ 
  onReturnToT, 
  onLeaveT,
  onPoseUpdate,
  isCalibrating = false, 
  onCalibrationComplete,
  className = ''
}) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const cameraRef = useRef(null);
  const poseRef = useRef(null);
  const [permissionState, setPermissionState] = useState('prompt');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const smoothedBboxRef = useRef(null);
  const aspectRatioHistoryRef = useRef([]);
  
  // T位检测相关 refs
  const homeReferenceRef = useRef(null);
  const isAtTRef = useRef(false);
  const hasCalibratedRef = useRef(false);
  const settingsRef = useRef(null);
  const wasAtTRef = useRef(true); // 追踪上一次的状态，用于检测离开T位

  // 校准模式状态
  const [isInCalibrationMode, setIsInCalibrationMode] = useState(false);
  const [calibrationCountdown, setCalibrationCountdown] = useState(0);
  const [isCalibratingCountdown, setIsCalibratingCountdown] = useState(false);
  const calibrationPoseRef = useRef(null);

  // 加载设置
  useEffect(() => {
    settingsRef.current = loadSettings();
  }, []);

  // 检查是否是校准模式（通过URL参数或父组件传入）
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const shouldCalibrate = urlParams.get('calibrate') === 'true' || isCalibrating;
    if (shouldCalibrate) {
      setIsInCalibrationMode(true);
      // 清除URL参数
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isCalibrating]);

  // 检查相机权限 - 改进版本，处理不支持 permissions API 的情况
  const checkCameraPermission = async () => {
    try {
      // 首先检查是否支持 permissions API
      if (navigator.permissions && navigator.permissions.query) {
        const result = await navigator.permissions.query({ name: 'camera' });
        setPermissionState(result.state);
        
        result.addEventListener('change', () => {
          setPermissionState(result.state);
        });
      } else {
        // 如果不支持 permissions API，尝试直接获取媒体来检查权限
        setPermissionState('prompt');
      }
    } catch (err) {
      console.log('无法查询相机权限状态:', err);
      // 某些浏览器不支持查询相机权限，设为 prompt 状态让用户尝试
      setPermissionState('prompt');
    }
  };

  // 请求相机权限
  const requestCameraPermission = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const constraints = { 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // 立即停止测试流，我们只是检查权限
      stream.getTracks().forEach(track => track.stop());
      
      setPermissionState('granted');
      setError(null);
    } catch (err) {
      console.error('相机权限请求失败:', err);
      
      let errorMessage = '无法访问相机，请检查权限设置';
      
      // 根据错误类型提供更具体的错误信息
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = '相机权限被拒绝。请在浏览器设置中允许访问相机，或检查系统隐私设置。';
      } else if (err.name === 'NotFoundError') {
        errorMessage = '未找到相机设备。请确保相机已连接并正常工作。';
      } else if (err.name === 'NotReadableError') {
        errorMessage = '相机被其他应用程序占用。请关闭其他使用相机的应用后重试。';
      } else if (err.name === 'SecurityError') {
        errorMessage = '安全错误：此页面需要在安全环境（HTTPS）下运行才能访问相机。';
      } else if (err.name === 'AbortError') {
        errorMessage = '请求被中止，请重试。';
      }
      
      setPermissionState('denied');
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  // 计算移动平均
  const getMovingAverage = (value, windowSize = 10) => {
    aspectRatioHistoryRef.current.push(value);
    if (aspectRatioHistoryRef.current.length > windowSize) {
      aspectRatioHistoryRef.current.shift();
    }
    const sum = aspectRatioHistoryRef.current.reduce((a, b) => a + b, 0);
    return sum / aspectRatioHistoryRef.current.length;
  };

  // 根据舒适区计算容差阈值
  const getToleranceThresholds = () => {
    const settings = settingsRef.current || { tComfortZone: 0 };
    const comfortZone = settings.tComfortZone ?? 0;
    const baseThreshold = 0.05;
    const maxThreshold = 0.50;
    const xThreshold = baseThreshold + (comfortZone / 100) * (maxThreshold - baseThreshold);
    const widthThreshold = baseThreshold + (comfortZone / 100) * (maxThreshold - baseThreshold);
    return { xThreshold, widthThreshold };
  };

  // 检查用户是否回到T位
  const checkAtTPosition = (currentCenterX, currentShoulderWidth) => {
    if (!homeReferenceRef.current) return false;
    
    const { centerX: homeX, shoulderWidth: homeWidth } = homeReferenceRef.current;
    const xDiff = Math.abs(currentCenterX - homeX);
    const widthDiff = Math.abs(currentShoulderWidth - homeWidth);
    
    const { xThreshold, widthThreshold } = getToleranceThresholds();
    
    const isXWithinRange = xDiff <= xThreshold;
    const isWidthWithinRange = widthDiff <= widthThreshold;
    
    return isXWithinRange && isWidthWithinRange;
  };

  // 开始校准流程
  const startCalibration = () => {
    const settings = settingsRef.current || { calibrationDuration: 5 };
    const duration = settings.calibrationDuration || 5;
    
    setCalibrationCountdown(duration);
    setIsCalibratingCountdown(true);
    calibrationPoseRef.current = [];
    
    let remaining = duration;
    
    const countdownInterval = setInterval(() => {
      remaining -= 1;
      setCalibrationCountdown(remaining);
      
      if (smoothedBboxRef.current) {
        calibrationPoseRef.current.push({
          centerX: smoothedBboxRef.current.centerX,
          shoulderWidth: smoothedBboxRef.current.shoulderWidth,
          timestamp: Date.now()
        });
      }
      
      if (remaining <= 0) {
        clearInterval(countdownInterval);
        completeCalibration();
      }
    }, 1000);
  };

  // 完成校准
  const completeCalibration = () => {
    setIsCalibratingCountdown(false);
    
    const poses = calibrationPoseRef.current;
    if (poses.length > 0) {
      const avgCenterX = poses.reduce((sum, p) => sum + p.centerX, 0) / poses.length;
      const avgShoulderWidth = poses.reduce((sum, p) => sum + p.shoulderWidth, 0) / poses.length;
      
      const newReference = {
        centerX: avgCenterX,
        shoulderWidth: avgShoulderWidth
      };
      
      homeReferenceRef.current = newReference;
      hasCalibratedRef.current = true;
      
      if (onCalibrationComplete) {
        onCalibrationComplete(newReference);
      }
      
      localStorage.setItem('squash-t-position-reference', JSON.stringify(newReference));
    }
    
    setIsInCalibrationMode(false);
  };

  // 取消校准
  const cancelCalibration = () => {
    setIsInCalibrationMode(false);
    setIsCalibratingCountdown(false);
    setCalibrationCountdown(0);
  };

  // 使用多个关键点计算躯干矩形框
  const getTorsoBoundingBox = (landmarks) => {
    if (!landmarks) return null;

    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftHip = landmarks[23];
    const rightHip = landmarks[24];
    const leftKnee = landmarks[25];
    const rightKnee = landmarks[26];

    const keyPoints = [leftShoulder, rightShoulder, leftHip, rightHip];
    const minVisibility = 0.5;
    const hasValidKeyPoints = keyPoints.every(p => p && p.visibility > minVisibility);
    
    if (!hasValidKeyPoints) return null;

    const shoulderCenter = {
      x: (leftShoulder.x + rightShoulder.x) / 2,
      y: (leftShoulder.y + rightShoulder.y) / 2,
      visibility: Math.min(leftShoulder.visibility, rightShoulder.visibility)
    };

    const hipCenter = {
      x: (leftHip.x + rightHip.x) / 2,
      y: (leftHip.y + rightHip.y) / 2,
      visibility: Math.min(leftHip.visibility, rightHip.visibility)
    };

    const shoulderWidth = Math.sqrt(
      Math.pow(rightShoulder.x - leftShoulder.x, 2) + 
      Math.pow(rightShoulder.y - leftShoulder.y, 2)
    );

    const hipWidth = Math.sqrt(
      Math.pow(rightHip.x - leftHip.x, 2) + 
      Math.pow(rightHip.y - leftHip.y, 2)
    );

    const torsoHeight = Math.sqrt(
      Math.pow(hipCenter.x - shoulderCenter.x, 2) + 
      Math.pow(hipCenter.y - shoulderCenter.y, 2)
    );

    const avgWidth = (shoulderWidth + hipWidth) / 2;
    const currentAspectRatio = avgWidth / torsoHeight;
    const smoothedAspectRatio = getMovingAverage(currentAspectRatio);

    const shoulderVisibilityDiff = Math.abs(leftShoulder.visibility - rightShoulder.visibility);
    const hipVisibilityDiff = Math.abs(leftHip.visibility - rightHip.visibility);
    
    const isRotating = smoothedAspectRatio < 0.55 || shoulderVisibilityDiff > 0.3 || hipVisibilityDiff > 0.3;

    const minAspectRatio = 0.6;
    const effectiveWidth = isRotating 
      ? Math.max(avgWidth, torsoHeight * minAspectRatio * 0.8)
      : avgWidth;

    const widthPadding = 0.15;
    const rectWidth = effectiveWidth * (1 + widthPadding);

    let topY = shoulderCenter.y;
    topY = shoulderCenter.y - torsoHeight * 0.15;

    let bottomY = hipCenter.y;
    if (leftKnee && rightKnee && 
        leftKnee.visibility > minVisibility && 
        rightKnee.visibility > minVisibility) {
      const kneeCenterY = (leftKnee.y + rightKnee.y) / 2;
      bottomY = hipCenter.y + (kneeCenterY - hipCenter.y) * 0.6;
    } else {
      bottomY = hipCenter.y + torsoHeight * 0.8;
    }

    const centerX = (shoulderCenter.x + hipCenter.x) / 2;
    const centerY = (topY + bottomY) / 2;
    const rectHeight = bottomY - topY;

    const smoothingFactor = 0.7;
    const newBbox = {
      x: centerX - rectWidth / 2,
      y: topY,
      width: rectWidth,
      height: rectHeight,
      centerX: centerX,
      centerY: centerY,
      shoulderWidth: shoulderWidth,
      isRotating: isRotating,
      aspectRatio: smoothedAspectRatio
    };

    if (smoothedBboxRef.current) {
      const rotationSmoothingFactor = isRotating ? 0.85 : smoothingFactor;
      
      smoothedBboxRef.current = {
        x: smoothedBboxRef.current.x * rotationSmoothingFactor + newBbox.x * (1 - rotationSmoothingFactor),
        y: smoothedBboxRef.current.y * rotationSmoothingFactor + newBbox.y * (1 - rotationSmoothingFactor),
        width: smoothedBboxRef.current.width * rotationSmoothingFactor + newBbox.width * (1 - rotationSmoothingFactor),
        height: smoothedBboxRef.current.height * rotationSmoothingFactor + newBbox.height * (1 - rotationSmoothingFactor),
        centerX: smoothedBboxRef.current.centerX * rotationSmoothingFactor + newBbox.centerX * (1 - rotationSmoothingFactor),
        centerY: smoothedBboxRef.current.centerY * rotationSmoothingFactor + newBbox.centerY * (1 - rotationSmoothingFactor),
        shoulderWidth: smoothedBboxRef.current.shoulderWidth * rotationSmoothingFactor + newBbox.shoulderWidth * (1 - rotationSmoothingFactor),
        isRotating: newBbox.isRotating,
        aspectRatio: newBbox.aspectRatio
      };
    } else {
      smoothedBboxRef.current = newBbox;
    }

    return smoothedBboxRef.current;
  };

  // 初始化 MediaPipe Pose
  const initPose = () => {
    try {
      const pose = new Pose({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
        }
      });

      pose.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        smoothSegmentation: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      pose.onResults(onResults);
      poseRef.current = pose;
      return true;
    } catch (err) {
      console.error('初始化 MediaPipe Pose 失败:', err);
      setError('姿态检测初始化失败，请检查网络连接或刷新页面重试');
      setIsLoading(false);
      return false;
    }
  };

  // 处理姿态检测结果
  const onResults = (results) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    let poseData = {
      isDetected: false,
      isAtT: false,
      centerX: null,
      shoulderWidth: null
    };

    if (results.poseLandmarks) {
      const bbox = getTorsoBoundingBox(results.poseLandmarks);
      
      if (bbox) {
        poseData = {
          isDetected: true,
          isAtT: false,
          centerX: bbox.centerX,
          shoulderWidth: bbox.shoulderWidth
        };

        // 自动校准：只在非校准模式下且首次检测到时执行
        if (!isInCalibrationMode && !hasCalibratedRef.current) {
          homeReferenceRef.current = {
            centerX: bbox.centerX,
            shoulderWidth: bbox.shoulderWidth
          };
          hasCalibratedRef.current = true;
        }

        // 检查是否在T位
        if (!isInCalibrationMode) {
          const wasAtT = isAtTRef.current;
          const isNowAtT = checkAtTPosition(bbox.centerX, bbox.shoulderWidth);
          isAtTRef.current = isNowAtT;
          poseData.isAtT = isNowAtT;

          // 检测离开T位
          if (wasAtT && !isNowAtT && onLeaveT) {
            onLeaveT({
              centerX: bbox.centerX,
              shoulderWidth: bbox.shoulderWidth,
              timestamp: Date.now()
            });
          }

          // 检测回到T位
          if (isNowAtT && !wasAtT && onReturnToT) {
            onReturnToT({
              centerX: bbox.centerX,
              shoulderWidth: bbox.shoulderWidth,
              timestamp: Date.now()
            });
          }

          // 更新上一次状态记录
          wasAtTRef.current = isNowAtT;
        }
        
        // 绘制跟踪框
        const x = (1 - bbox.x - bbox.width) * canvas.width;
        const y = bbox.y * canvas.height;
        const width = bbox.width * canvas.width;
        const height = bbox.height * canvas.height;

        const isRotating = bbox.isRotating;
        const isAtT = isAtTRef.current && !isInCalibrationMode;
        
        let boxColor, fillColorStart, fillColorEnd, centerColor;
        
        if (isInCalibrationMode) {
          boxColor = '#9333EA';
          fillColorStart = 'rgba(147, 51, 234, 0.3)';
          fillColorEnd = 'rgba(147, 51, 234, 0.1)';
          centerColor = '#9333EA';
        } else if (isAtT) {
          boxColor = '#3B82F6';
          fillColorStart = 'rgba(59, 130, 246, 0.3)';
          fillColorEnd = 'rgba(59, 130, 246, 0.1)';
          centerColor = '#3B82F6';
        } else if (isRotating) {
          boxColor = '#FFA500';
          fillColorStart = 'rgba(255, 165, 0, 0.2)';
          fillColorEnd = 'rgba(255, 165, 0, 0.08)';
          centerColor = '#FFA500';
        } else {
          boxColor = '#00FF00';
          fillColorStart = 'rgba(0, 255, 0, 0.15)';
          fillColorEnd = 'rgba(0, 255, 0, 0.05)';
          centerColor = '#FF0000';
        }

        // 绘制圆角矩形框
        const cornerRadius = 12;
        ctx.beginPath();
        ctx.moveTo(x + cornerRadius, y);
        ctx.lineTo(x + width - cornerRadius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + cornerRadius);
        ctx.lineTo(x + width, y + height - cornerRadius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - cornerRadius, y + height);
        ctx.lineTo(x + cornerRadius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - cornerRadius);
        ctx.lineTo(x, y + cornerRadius);
        ctx.quadraticCurveTo(x, y, x + cornerRadius, y);
        ctx.closePath();

        ctx.strokeStyle = boxColor;
        ctx.lineWidth = isAtT ? 5 : (isRotating ? 4 : 3);
        ctx.stroke();

        const gradient = ctx.createLinearGradient(x, y, x, y + height);
        gradient.addColorStop(0, fillColorStart);
        gradient.addColorStop(1, fillColorEnd);
        ctx.fillStyle = gradient;
        ctx.fill();

        // 绘制中心点
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, isAtT ? 15 : 10, 0, 2 * Math.PI);
        ctx.fillStyle = isAtT ? 'rgba(59, 130, 246, 0.5)' : (isRotating ? 'rgba(255, 165, 0, 0.4)' : 'rgba(255, 0, 0, 0.3)');
        ctx.fill();

        ctx.beginPath();
        ctx.arc(centerX, centerY, isAtT ? 8 : 5, 0, 2 * Math.PI);
        ctx.fillStyle = centerColor;
        ctx.fill();

        // 绘制角落标记
        const markerLength = 15;
        ctx.strokeStyle = boxColor;
        ctx.lineWidth = 2;
        
        // 左上角
        ctx.beginPath();
        ctx.moveTo(x + 5, y + markerLength);
        ctx.lineTo(x + 5, y + 5);
        ctx.lineTo(x + markerLength, y + 5);
        ctx.stroke();

        // 右上角
        ctx.beginPath();
        ctx.moveTo(x + width - markerLength, y + 5);
        ctx.lineTo(x + width - 5, y + 5);
        ctx.lineTo(x + width - 5, y + markerLength);
        ctx.stroke();

        // 左下角
        ctx.beginPath();
        ctx.moveTo(x + 5, y + height - markerLength);
        ctx.lineTo(x + 5, y + height - 5);
        ctx.lineTo(x + markerLength, y + height - 5);
        ctx.stroke();

        // 右下角
        ctx.beginPath();
        ctx.moveTo(x + width - markerLength, y + height - 5);
        ctx.lineTo(x + width - 5, y + height - 5);
        ctx.lineTo(x + width - 5, y + height - markerLength);
        ctx.stroke();

        // 绘制状态指示器
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = boxColor;
        ctx.textAlign = 'left';
        
        if (isInCalibrationMode) {
          if (isCalibratingCountdown) {
            ctx.fillText(`校准中... ${calibrationCountdown}`, x + 10, y + 25);
          } else {
            ctx.fillText('准备校准', x + 10, y + 25);
          }
        } else if (isAtT) {
          ctx.fillText('✓ T位', x + 10, y + 25);
        } else if (isRotating) {
          ctx.fillText('↻ 旋转中', x + 10, y + 25);
        }
      }
    }

    // 向父组件报告姿态数据
    if (onPoseUpdate) {
      onPoseUpdate(poseData);
    }
  };

  // 启动相机 - 改进错误处理
  const startCamera = async () => {
    if (!videoRef.current || !poseRef.current) return;

    try {
      setIsLoading(true);
      setError(null);
      
      // 检查是否在安全上下文（HTTPS 或 localhost）
      if (!window.isSecureContext) {
        throw new Error('此功能需要在安全环境（HTTPS）下运行');
      }

      const camera = new Camera(videoRef.current, {
        onFrame: async () => {
          try {
            await poseRef.current.send({ image: videoRef.current });
          } catch (err) {
            console.error('姿态检测帧处理错误:', err);
          }
        },
        width: 1280,
        height: 720
      });

      await camera.start();
      cameraRef.current = camera;
      setIsLoading(false);
    } catch (err) {
      console.error('启动相机失败:', err);
      
      let errorMessage = '启动相机失败，请检查设备';
      
      if (err.message.includes('安全环境') || err.message.includes('HTTPS')) {
        errorMessage = '相机需要在安全环境（HTTPS）下运行。请确保网站通过 HTTPS 访问，或联系管理员配置 SSL 证书。';
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = '相机权限被拒绝。请允许相机访问权限后重试。';
      } else if (err.name === 'NotFoundError') {
        errorMessage = '未找到相机设备。请确保设备有摄像头。';
      } else if (err.name === 'NotReadableError') {
        errorMessage = '相机被占用或无法读取。请关闭其他使用相机的应用。';
      } else if (err.message.includes('network') || err.message.includes('fetch')) {
        errorMessage = '网络错误：无法加载姿态检测模型。请检查网络连接。';
      }
      
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  // 停止相机
  const stopCamera = () => {
    if (cameraRef.current) {
      try {
        cameraRef.current.stop();
      } catch (err) {
        console.error('停止相机时出错:', err);
      }
      cameraRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      try {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      } catch (err) {
        console.error('停止视频轨道时出错:', err);
      }
    }
    smoothedBboxRef.current = null;
    aspectRatioHistoryRef.current = [];
    hasCalibratedRef.current = false;
    homeReferenceRef.current = null;
    isAtTRef.current = false;
    wasAtTRef.current = true;
  };

  // 重试启动相机
  const handleRetry = () => {
    setError(null);
    setPermissionState('prompt');
    requestCameraPermission();
  };

  useEffect(() => {
    checkCameraPermission();
    initPose();

    return () => {
      stopCamera();
      if (poseRef.current) {
        try {
          poseRef.current.close();
        } catch (err) {
          console.error('关闭 Pose 时出错:', err);
        }
      }
    };
  }, []);

  useEffect(() => {
    if (permissionState === 'granted') {
      startCamera();
    } else {
      setIsLoading(false);
    }

    return () => {
      stopCamera();
    };
  }, [permissionState]);

  // 权限被拒绝
  if (permissionState === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <AlertCircle className="w-16 h-16 text-red-400 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">相机权限被拒绝</h3>
        <p className="text-white/70 mb-4 max-w-xs">
          {error || '请在浏览器设置中允许访问相机以使用实时训练功能'}
        </p>
        <div className="space-y-2">
          <Button 
            onClick={handleRetry}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            重试
          </Button>
        </div>
      </div>
    );
  }

  // 权限未授予
  if (permissionState === 'prompt') {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <CameraIcon className="w-16 h-16 text-white/60 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">需要相机权限</h3>
        <p className="text-white/70 mb-4 max-w-xs">
          实时训练需要使用相机来检测身体姿态。请确保您使用的是 HTTPS 连接或本地环境。
        </p>
        <Button 
          onClick={requestCameraPermission}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          size="lg"
        >
          <CameraIcon className="w-4 h-4 mr-2" />
          允许使用相机
        </Button>
        {error && (
          <p className="mt-4 text-sm text-red-400 max-w-xs">{error}</p>
        )}
      </div>
    );
  }

  // 错误状态
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <AlertCircle className="w-16 h-16 text-yellow-400 mb-4" />
        <h3 className="text-xl font-bold text-white mb-2">出错了</h3>
        <p className="text-white/70 mb-4 max-w-xs">{error}</p>
        <Button 
          onClick={handleRetry}
          variant="outline"
          className="border-white/50 text-white hover:bg-white/20"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          重试
        </Button>
      </div>
    );
  }

  return (
    <div className={`relative w-full aspect-video bg-black rounded-lg overflow-hidden ${className}`}>
      {/* 隐藏的视频元素 */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover hidden"
        playsInline
        muted
      />
      
      {/* 显示姿态的画布（镜像显示） */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />
      
      {/* 校准模式覆盖层 */}
      {isInCalibrationMode && (
        <div className="absolute inset-0 bg-purple-900/70 flex flex-col items-center justify-center z-20">
          <Target className="w-16 h-16 text-white mb-4" />
          <h3 className="text-2xl font-bold text-white mb-2">校准T位</h3>
          <p className="text-white/90 text-center px-4 mb-6">
            请站在T位（场地中心），面向相机，<br/>
            确保全身可见，然后点击"开始校准"
          </p>
          
          {isCalibratingCountdown ? (
            <div className="text-center">
              <div className="text-6xl font-bold text-white mb-2">
                {calibrationCountdown}
              </div>
              <p className="text-white/70">保持位置...</p>
              <div className="mt-4 flex gap-2">
                <div className="w-48 h-2 bg-white/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white transition-all duration-1000 ease-linear"
                    style={{ 
                      width: `${(calibrationCountdown / (settingsRef.current?.calibrationDuration || 5)) * 100}%` 
                    }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button 
                onClick={startCalibration}
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-6"
              >
                <Timer className="w-4 h-4 mr-2" />
                开始校准
              </Button>
              <Button 
                onClick={cancelCalibration}
                variant="outline"
                className="bg-white/20 border-2 border-white text-white hover:bg-white hover:text-purple-900 font-semibold px-6"
              >
                取消
              </Button>
            </div>
          )}
        </div>
      )}
      
      {/* 加载状态 */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center">
            <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-white">正在启动相机...</p>
          </div>
        </div>
      )}
      
      {/* 状态指示器 */}
      <div className="absolute top-2 left-2 flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
        <span className="text-xs text-white">姿态检测中</span>
      </div>
      
      {/* 校准按钮（非校准模式下显示） */}
      {!isInCalibrationMode && (
        <div className="absolute top-2 right-2">
          <Button
            onClick={() => setIsInCalibrationMode(true)}
            size="sm"
            variant="outline"
            className="bg-black/50 border-white/30 text-white hover:bg-white/20 text-xs"
          >
            <Target className="w-3 h-3 mr-1" />
            校准
          </Button>
        </div>
      )}
    </div>
  );
};

export default LiveTrainingCamera;

