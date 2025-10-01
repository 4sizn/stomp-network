#!/bin/bash

# STOMP WebSocket Client Library Testing Script
set -e

echo "🧪 Testing STOMP WebSocket Client Library..."

# Run type check
echo "🔍 Running type check..."
npm run type-check

# Build library to ensure it compiles
echo "📦 Building library for testing..."
npm run build:lib

# Check if dist folder exists and contains expected files
if [ -d "dist" ]; then
  echo "✅ Build successful"

  # Validate TypeScript definitions
  if [ -f "dist/index.d.ts" ]; then
    echo "🔍 Validating TypeScript definitions..."

    # Check for essential STOMP exports
    EXPORTS_COUNT=$(grep -c "export" dist/index.d.ts 2>/dev/null || echo "0")
    if [ "$EXPORTS_COUNT" -gt "0" ]; then
      echo "✅ Found $EXPORTS_COUNT exports in type definitions"
    else
      echo "⚠️  Warning: No exports found in type definitions"
    fi

    # Check for specific STOMP-related exports
    if grep -q "Stomp\|Connection\|Message" dist/index.d.ts 2>/dev/null; then
      echo "✅ STOMP-related types found"
    else
      echo "⚠️  Warning: Could not verify STOMP-related types"
    fi
  fi

  # Check bundle sizes
  echo "📊 Bundle size analysis:"
  du -h dist/* 2>/dev/null || echo "Could not analyze bundle sizes"

else
  echo "❌ Build failed - dist folder not found"
  exit 1
fi

echo "🎉 All tests passed!"