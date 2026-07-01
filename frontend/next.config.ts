import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "openevals",
    "langsmith",
    "langchain",
    "@langchain/openai",
    "@langchain/core",
  ],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
