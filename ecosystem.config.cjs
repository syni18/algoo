// ecosystem.config.cjs
module.exports = {
    apps: [
      {
        name: 'algoo',
        script: './dist/src/server.js',
        instances: 1,
        exec_mode: 'fork',
        watch: false,
        env: {
          NODE_ENV: 'development',
          PORT: 8888
        },
        env_production: {
          NODE_ENV: 'production',
          PORT: 9999
        }
      },
      {
        name: 'algoo-worker',
        script: './dist/worker.js',
        instances: 1,
        watch: false,
        env: {
          NODE_ENV: 'worker'
        }
      }
    ]
  }
  