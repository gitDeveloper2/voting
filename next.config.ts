import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // External packages that should only run on server
  serverExternalPackages: ['mongodb', 'ioredis'],
  
  webpack: (config, { isServer }) => {
    // Exclude Node.js modules from client bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        // File system
        fs: false,
        'fs/promises': false,
        
        // Network
        net: false,
        tls: false,
        dns: false,
        http: false,
        https: false,
        
        // Process and system
        child_process: false,
        os: false,
        path: false,
        crypto: false,
        
        // Streams and utilities
        stream: false,
        url: false,
        zlib: false,
        assert: false,
        util: false,
        buffer: false,
        events: false,
        
        // Timers
        timers: false,
        'timers/promises': false,
        
        // Other Node.js modules
        querystring: false,
        punycode: false,
        constants: false,
        vm: false,
        cluster: false,
        dgram: false,
        readline: false,
        repl: false,
        string_decoder: false,
        sys: false,
        tty: false,
        v8: false,
        worker_threads: false,
      };

      // Exclude problematic packages entirely from client bundle
      config.externals = config.externals || [];
      config.externals.push({
        mongodb: 'commonjs mongodb',
        ioredis: 'commonjs ioredis',
      });
    }
    return config;
  },
};

export default nextConfig;
