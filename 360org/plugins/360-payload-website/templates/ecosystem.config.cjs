// PM2 cluster config — production CloudPanel (native Node.js, KHÔNG Docker)
// Đặt tại root repo trên server: /home/<site>/htdocs/<domain>/ecosystem.config.cjs
// Dùng: pm2 start ecosystem.config.cjs && pm2 save
// Thay <site>, <appname>, <domain> cho từng site trong hệ sinh thái 360 CORP.
module.exports = {
  apps: [
    {
      name: 'payload-site', // <appname> — đổi theo site (vd: 'vuaai', 'vuahethong')
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      cwd: '/home/payload-site/htdocs/payload-site.net', // đổi path theo site
      instances: 2, // cluster 2 workers (tận dụng multi-core)
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: '3000',
        NODE_OPTIONS: '--no-deprecation',
      },
      error_file: '/home/payload-site/logs/payload-site-error.log',
      out_file: '/home/payload-site/logs/payload-site-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
    },
  ],
}
