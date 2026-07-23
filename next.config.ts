import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @libsql/client używa natywnych bindingów, których bundler Next nie może spakować.
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
