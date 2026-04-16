const STORAGE_KEY = 'squash-ghosting-settings';

// 难度映射到时间间隔（秒）
export const DIFFICULTY_MAP = {
  easy: { label: '简单', interval: 6, color: 'bg-green-500' },
  mid: { label: '中等', interval: 3.5, color: 'bg-yellow-500' },
  hard: { label: '困难', interval: 2, color: 'bg-orange-500' },
  veryHard: { label: '极难', interval: 1, color: 'bg-red-500' }
};

// 训练时长选项（分钟）
export const DURATION_OPTIONS = [1, 3, 5, 10];

const defaultSettings = {
  duration: 5,
  interval: 3,
  includeTPosition: true,
  highContrast: true,
  countdownDuration: 3,
  tPositionDuration: 2,
  // 新增：校准倒计时时间（秒）
  calibrationDuration: 5,
  // 新增：T位舒适区（0-100）
  tComfortZone: 0,
  // 新增：动态时间间隔设置
  useDynamicInterval: false,
  minInterval: 3,
  maxInterval: 6,
  // 新增：难度预设
  difficulty: 'mid', // easy, mid, hard, veryHard
  // 新增：显示回位确认提示
  showReturnConfirmation: true,
  // 移除 tPositionDelay ，添加位置速度比例
  positionScalers: {
    'front-forehand': 1.0,   // 前场正手
    'front-backhand': 1.0,   // 前场反手
    'mid-forehand': 1.0,     // 中场正手
    'mid-backhand': 1.0,     // 中场反手
    'back-forehand': 1.0,    // 后场正手
    'back-backhand': 1.0,    // 后场反手
  },
};

export const loadSettings = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // 合并默认比例设置（处理旧数据）
      const merged = { 
        ...defaultSettings, 
        ...parsed,
        positionScalers: {
          ...defaultSettings.positionScalers,
          ...(parsed.positionScalers || {})
        }
      };
      
      // 如果有难度设置，同步对应的interval
      if (merged.difficulty && DIFFICULTY_MAP[merged.difficulty]) {
        merged.interval = DIFFICULTY_MAP[merged.difficulty].interval;
      }
      
      return merged;
    }
  } catch (error) {
    console.error('加载设置失败:', error);
  }
  return defaultSettings;
};

export const saveSettings = (settings) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('保存设置失败:', error);
  }
};

// 根据难度获取间隔时间
export const getIntervalByDifficulty = (difficulty) => {
  return DIFFICULTY_MAP[difficulty]?.interval || 3;
};

// 根据间隔时间反推难度
export const getDifficultyByInterval = (interval) => {
  for (const [key, value] of Object.entries(DIFFICULTY_MAP)) {
    if (value.interval === interval) return key;
  }
  return 'mid';
};
