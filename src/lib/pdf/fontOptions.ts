export interface FontOption {
  label: string;
  value: string;
  category: 'cjk' | 'en';
}

export const AVAILABLE_FONTS: FontOption[] = [
  { label: '思源黑体 (默认)', value: 'Noto Sans SC, "PingFang SC", "Microsoft YaHei", sans-serif', category: 'cjk' },
  { label: '思源宋体 / 宋体', value: 'Noto Serif SC, "Songti SC", SimSun, serif', category: 'cjk' },
  { label: '微软雅黑', value: '"Microsoft YaHei", sans-serif', category: 'cjk' },
  { label: '楷体 (KaiTi)', value: 'KaiTi, "Kaiti SC", STKaiti, serif', category: 'cjk' },
  { label: '黑体 (SimHei)', value: 'SimHei, "Heiti SC", sans-serif', category: 'cjk' },
  { label: '仿宋 (FangSong)', value: 'FangSong, "FangSong SC", serif', category: 'cjk' },
  { label: 'Helvetica / Arial', value: 'Helvetica, Arial, sans-serif', category: 'en' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif', category: 'en' },
  { label: 'Courier New (等宽)', value: '"Courier New", Courier, monospace', category: 'en' },
  { label: 'Georgia (衬线)', value: 'Georgia, serif', category: 'en' },
];
