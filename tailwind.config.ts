import type { Config } from 'tailwindcss'
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: { extend: { colors: { 'app-bg': '#0F172A', 'app-card': '#1E293B', 'app-border': '#334155' } } },
  plugins: []
}
export default config
