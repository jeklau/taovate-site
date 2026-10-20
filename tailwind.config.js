/** @type {import('tailwindcss').Config} */
module.exports = {
  // 相对路径：任何机器、任何 CI 上都能直接构建
  content: ['./public/**/*.html'],
  theme: {
    extend: {
      colors: {
        ink:   '#14201C',
        teal:  { DEFAULT: '#1D9E75', deep: '#0F6E56' },
        paper: '#F4F6F4',
        mist:  '#E7EDEA',
        muted: '#5A6B64',
      },
      fontFamily: {
        // 字体文件由 scripts/copy-vendor.mjs 复制到 public/fonts（自托管）
        serif: ['var(--font-serif)'],
        sans:  ["'Inter Variable'", 'Inter', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
