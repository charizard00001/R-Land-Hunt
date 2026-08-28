import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  outputFileTracingExcludes: { '*': ['./legacy/**'] },
};

export default config;
