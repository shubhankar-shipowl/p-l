
module.exports = {
  apps: [
    {
      name: "profit-loss-dashboard",
      script: "npm",
      args: "start -- -p 3005",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
