# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.0.5] - 2025-12-02

### Bug Fixes

- **reconnect:** fix reconnection counter reset on STOMP ERROR frames
- **reconnect:** prevent connection leaks by cleaning up previous client before retry
