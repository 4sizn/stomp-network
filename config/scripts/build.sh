#!/bin/bash

# STOMP WebSocket Client Library Build Script
set -e

echo "<×  Building STOMP WebSocket Client Library..."

# Clean previous builds
echo ">ù Cleaning previous builds..."
rm -rf dist/

# Type check
echo "= Running type check..."
npm run type-check

# Build library
echo "=æ Building library..."
npm run build:lib

# Verify build output
if [ -d "dist" ] && [ -f "dist/index.js" ] && [ -f "dist/index.d.ts" ]; then
  echo " Library build completed successfully!"

  # Show build output size
  echo "=Ê Build output:"
  du -h dist/*

  # Verify type definitions
  if [ -f "dist/index.d.ts" ]; then
    echo " Type definitions generated successfully"
  fi

  # Verify all formats (ESM and CJS)
  if [ -f "dist/index.js" ] && [ -f "dist/index.es.js" ]; then
    echo " All formats (ESM, CJS) generated successfully"
  fi

  # Additional validation for STOMP library
  echo "= Validating STOMP library build..."

  # Check for essential exports
  if grep -q "StompClient\|useStompConnection\|StompProvider" dist/index.d.ts 2>/dev/null; then
    echo " Essential STOMP exports found in type definitions"
  else
    echo "   Warning: Could not verify STOMP exports in type definitions"
  fi

else
  echo "L Build failed - output files not found"
  exit 1
fi

echo "<‰ STOMP WebSocket Client Library build completed successfully!"