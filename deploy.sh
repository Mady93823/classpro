#!/bin/bash

# Ensure the script exits on failure commented out to allow continuing if one part fails, 
# but for deployment usually we want to know. 
# However, user said "check npm install ... and npm start", so we will proceed.

echo "--------------------------------------------------"
echo "Starting Deployment Script"
echo "--------------------------------------------------"

# 1. Git Pull
echo "Pulling latest changes from git..."
git pull

# 2. Frontend Setup
echo "--------------------------------------------------"
echo "Setting up Frontend..."
cd frontend

echo "Installing frontend dependencies..."
npm install

# Ensure .env is set for production (Manual step reminder)
if [ ! -f .env ]; then
    echo "⚠️  WARNING: .env file not found! Don't forget to add the env manually."
fi

echo "Building frontend for production..."
npm run build

echo "Managing Frontend PM2 process..."
# Check if frontend process is running
if pm2 list | grep -q "frontend"; then
    echo "Frontend is running. Delete old process to update serve..."
    pm2 delete frontend
fi

echo "Starting Frontend as Static Server..."
# Serve the 'dist' folder on port 5173 as a Single Page Application
pm2 serve dist 5173 --name "frontend" --spa

echo "Frontend Last 10 Logs:"
pm2 logs frontend --lines 10 --nostream

cd ..

# 3. Backend Setup
echo "--------------------------------------------------"
echo "Setting up Backend..."
cd backend

echo "Installing backend dependencies..."
npm install

echo "Managing Backend PM2 process..."
# Check if backend process is running
if pm2 list | grep -q "backend"; then
    echo "Backend is running. Restarting..."
    pm2 restart backend
else
    echo "Backend is not running. Starting..."
    pm2 start npm --name "backend" -- start
fi

echo "--------------------------------------------------"
echo "Deployment Finished. Streaming Backend Logs..."
echo "--------------------------------------------------"

# Print backend live logs
pm2 logs backend
