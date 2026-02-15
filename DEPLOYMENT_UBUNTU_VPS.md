# Ubuntu VPS Deployment Guide (Domain + SSL)

This project has a **React (Vite) frontend** and **Node.js/Socket.IO backend**. A simple production setup is:

- Backend runs with PM2 on `127.0.0.1:5000`
- Frontend is built to static files and served by Nginx
- Nginx reverse-proxies `/api` and `/socket.io` to backend
- Let's Encrypt provides HTTPS certificates

> In this guide, we use **`/home/classpro`** as the project root.
> If your app is in a different folder, replace paths accordingly.

## 1) Server prerequisites

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx certbot python3-certbot-nginx git ufw
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

Optional firewall:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 2) Clone app and install dependencies

```bash
cd /home
sudo git clone <YOUR_REPO_URL> classpro
sudo chown -R $USER:$USER /home/classpro
cd /home/classpro

cd backend && npm install
cd ../frontend && npm install
```

## 3) Configure environment variables

Create backend env file (`/home/classpro/backend/.env`):

```env
NODE_ENV=production
PORT=5000
MONGO_URI=mongodb+srv://<user>:<pass>@<cluster>/<db>
JWT_SECRET=replace_with_at_least_32_characters_secret
FRONTEND_URL=https://yourdomain.com
SOCKET_CORS_ORIGIN=https://yourdomain.com
```

Create frontend env file (`/home/classpro/frontend/.env.production`):

```env
VITE_API_BASE_URL=https://yourdomain.com
VITE_SOCKET_URL=https://yourdomain.com
```

## 4) Build frontend

```bash
cd /home/classpro/frontend
npm run build
```

Output will be in `/home/classpro/frontend/dist`.

## 5) Run backend with PM2

```bash
cd /home/classpro/backend
pm2 start server.js --name classpro-backend
pm2 save
pm2 startup
```

Health check:

```bash
curl http://127.0.0.1:5000/health
```

## 6) Nginx reverse proxy + static hosting

> **Important:** Step 6 is done in **Nginx system directories**, not inside `/home/classpro/backend`.
> Your backend can run from `/home/classpro/backend`, while Nginx config always lives under `/etc/nginx/...`.

Create `/etc/nginx/sites-available/classpro` (you can run this from any directory):

```bash
sudo nano /etc/nginx/sites-available/classpro
```

Then paste:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /home/classpro/frontend/dist;
    index index.html;

    # Frontend static + SPA fallback
    location / {
        try_files $uri /index.html;
    }

    # REST API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Socket.IO proxy (WebSocket upgrade)
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/classpro /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

If the symlink already exists, use:

```bash
sudo rm -f /etc/nginx/sites-enabled/classpro
sudo ln -s /etc/nginx/sites-available/classpro /etc/nginx/sites-enabled/classpro
sudo nginx -t && sudo systemctl reload nginx
```

## 7) Connect domain DNS

At your domain provider, set:

- `A` record for `@` -> `YOUR_SERVER_PUBLIC_IP`
- `A` record for `www` -> `YOUR_SERVER_PUBLIC_IP`

Wait for DNS propagation, then verify:

```bash
dig +short yourdomain.com
dig +short www.yourdomain.com
```

## 8) Install SSL certificate (Let's Encrypt)

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Choose redirect to HTTPS when prompted.

Test auto-renewal:

```bash
sudo certbot renew --dry-run
```

## 9) Updates / redeploy flow

```bash
cd /home/classpro
git pull

cd frontend
npm install
npm run build

cd ../backend
npm install
pm2 restart classpro-backend

sudo nginx -t && sudo systemctl reload nginx
```

## 10) Quick troubleshooting

- Backend logs: `pm2 logs classpro-backend`
- Nginx logs: `sudo tail -f /var/log/nginx/error.log`
- If login or sockets fail, confirm these values are HTTPS domain URLs:
  - `FRONTEND_URL`
  - `SOCKET_CORS_ORIGIN`
  - `VITE_API_BASE_URL`
  - `VITE_SOCKET_URL`
