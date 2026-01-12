#!/bin/bash

# Configuration
APP_NAME="profit-loss-dashboard"

echo "🚀 Starting deployment script..."

# 1. Install dependencies
echo "📦 Installing dependencies..."
npm install

# 2. Build the application
echo "🏗️  Building the application..."
npm run build

# Check if build succeeded
if [ $? -ne 0 ]; then
    echo "❌ Build failed! Aborting deployment."
    exit 1
fi

# 3. Start/Restart with PM2
echo "🔄 Starting application with PM2..."
if pm2 list | grep -q "$APP_NAME"; then
    echo "   Restarting existing process..."
    pm2 restart "$APP_NAME"
else
    echo "   Starting new process..."
    pm2 start ecosystem.config.js
fi

# 4. Save PM2 list
echo "💾 Saving PM2 configuration..."
pm2 save

echo "✅ Deployment complete! Application is running on port 3005."
pm2 list
