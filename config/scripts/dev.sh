#!/bin/bash

# STOMP WebSocket Client Library Development Script
set -e

echo "🚀 Starting STOMP WebSocket Client Library development..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install
fi

# Run type check in background
echo "🔍 Running type check..."
npm run type-check

# Start development server
echo "🏃 Starting development server..."
echo "📝 Example usage will be available at http://localhost:5173"
echo "🛑 Press Ctrl+C to stop the development server"

npm run dev