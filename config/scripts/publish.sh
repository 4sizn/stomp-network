#!/bin/bash

# STOMP WebSocket Client Library Publishing Script
set -e

echo "=> Publishing STOMP WebSocket Client Library..."

# Check if we're on main branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "⚠️  Warning: You're not on the main branch (current: $CURRENT_BRANCH)"
  read -p "Do you want to continue? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "🚫 Publishing cancelled"
    exit 1
  fi
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo "🚫 Uncommitted changes detected. Please commit all changes before publishing."
  exit 1
fi

# Run build script
echo "🔨  Running build process..."
./config/scripts/build.sh

# Version bump (optional)
echo "=> Current version: $(node -p "require('./package.json').version")"
read -p "Bump version? (major/minor/patch/skip): " VERSION_BUMP

if [ "$VERSION_BUMP" != "skip" ] && [ "$VERSION_BUMP" != "" ]; then
  if [[ "$VERSION_BUMP" =~ ^(major|minor|patch)$ ]]; then
    npm version $VERSION_BUMP
    NEW_VERSION=$(node -p "require('./package.json').version")
    echo "🎉 Version bumped to: $NEW_VERSION"
  else
    echo "🚫 Invalid version bump type. Use: major, minor, patch, or skip"
    exit 1
  fi
fi

# Create git tag if version was bumped
if [ "$VERSION_BUMP" != "skip" ] && [ "$VERSION_BUMP" != "" ]; then
  git push origin main --tags
  echo "🏷 Git tags pushed to origin"
fi

# Publish to npm
echo "=> Publishing to npm..."
npm publish --access public

if [ $? -eq 0 ]; then
  echo "✅ Successfully published STOMP WebSocket Client Library!"
  echo "=> Package: @4sizn/stomp@$(node -p "require('./package.json').version")"
else
  echo "🚫 Publishing failed"
  exit 1
fi
