module.exports = {
  apps: [
    {
      name: 'timeharbor-frontend',
      cwd: '/home/pdharamkar/TimeharborApp/timeharbourapp',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      env: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--max-old-space-size=8192',
      },
    },
    {
      name: 'timeharbor-backend',
      cwd: '/home/pdharamkar/TimeharborApp/express-api',
      script: 'npm',
      args: 'run dev',
      env: {
        NODE_ENV: 'development',
        PORT: 3001,
        NODE_OPTIONS: '--max-old-space-size=4096',
      },
    },
    {
      name: 'timeharbor-proxy',
      cwd: '/home/pdharamkar/TimeharborApp/timeharbor-proxy',
      script: 'index.js',
      env: {
        PORT: 80,
      },
    },
  ],
};
