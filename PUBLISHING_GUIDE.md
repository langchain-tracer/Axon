# 📦 Publishing Guide - AXON v1.0.2

## 🎯 Overview

This guide covers publishing the fixed v1.0.2 packages to npm, which resolves all critical installation issues.

**Version:** 1.0.1 → 1.0.2  
**Date:** November 6, 2025  
**Status:** Ready to publish

---

## ✅ What Was Fixed in v1.0.2

### Backend (`agent-trace-backend`)
- ✅ **Port binding:** Changed from `0.0.0.0` to `127.0.0.1` (fixes EPERM on macOS)
- ✅ **Environment variables:** Added `HOST` configuration support

### Dashboard (`dashboard`)
- ✅ **React version:** Updated to 18.3.1 (fixes ESM compatibility)
- ✅ **Imports:** Fixed `react-dom/client` import syntax
- ✅ **Dagre:** Using namespace import for ESM compatibility
- ✅ **Vite config:** Added `optimizeDeps` and proxy configuration
- ✅ **Host binding:** Set to `127.0.0.1` for consistency

### CLI (`@agent-trace/cli`)
- ✅ **Bin aliases:** Added `axon` and `axon-ai` commands
- ✅ **Shebang:** Already present in source

### Tracers
- ✅ **LangChain tracer:** Version bumped to 1.0.2
- ✅ **OpenAI tracer:** Version bumped to 1.0.2

---

## 📋 Pre-Publishing Checklist

### 1. Verify All Fixes Are Applied

```bash
cd /Users/user/Desktop/myCodesmithFolder/agent-trace-visualizer

# Check backend
grep "HOST" backend/src/server.ts
# Should show: const HOST = process.env.HOST || '127.0.0.1';

# Check dashboard
grep "18.3.1" dashboard/package.json
# Should show: "react": "^18.3.1"

# Check versions
grep "version" backend/package.json dashboard/package.json packages/*/package.json
# All should show: "version": "1.0.2"
```

### 2. Build All Packages

```bash
# Backend
cd backend
npm install
npm run build
ls -la dist/server.js  # Verify build output

# Dashboard
cd ../dashboard
npm install
npm run build
ls -la dist/index.html  # Verify build output

# CLI
cd ../packages/cli
npm install
npm run build
ls -la dist/cli.js  # Verify build output
chmod +x dist/cli.js  # Ensure executable

# LangChain Tracer
cd ../langchain-tracer
npm install
npm run build
ls -la dist/  # Verify build output

# OpenAI Tracer
cd ../openai-tracer
npm install
npm run build
ls -la dist/  # Verify build output
```

### 3. Test Locally

```bash
# Test backend
cd backend
npm start
# Should start on 127.0.0.1:3000 without EPERM errors

# Test dashboard (in another terminal)
cd dashboard
npm run dev
# Should start without React/ESM errors

# Test CLI
cd packages/cli
npm link
axon --version  # Should show 1.0.2
axon-ai --version  # Should show 1.0.2
npm unlink
```

---

## 🚀 Publishing Steps

### Step 1: Login to npm

```bash
npm login
# Enter your npm credentials
# Username: ldwerner
# Password: ********
# Email: your-email@example.com
```

### Step 2: Publish Backend

```bash
cd /Users/user/Desktop/myCodesmithFolder/agent-trace-visualizer/backend

# Verify package contents
npm pack --dry-run

# Publish
npm publish --access public

# Verify published
npm view agent-trace-backend version
# Should show: 1.0.2
```

### Step 3: Publish Dashboard

```bash
cd ../dashboard

# Verify package contents
npm pack --dry-run

# Publish
npm publish --access public

# Verify published
npm view dashboard version
# Should show: 1.0.2
```

### Step 4: Publish CLI

```bash
cd ../packages/cli

# Verify package contents
npm pack --dry-run

# Publish
npm publish --access public

# Verify published
npm view @agent-trace/cli version
# Should show: 1.0.2
```

### Step 5: Publish LangChain Tracer

```bash
cd ../langchain-tracer

# Verify package contents
npm pack --dry-run

# Publish
npm publish --access public

# Verify published
npm view @agent-trace/langchain-tracer version
# Should show: 1.0.2
```

### Step 6: Publish OpenAI Tracer

```bash
cd ../openai-tracer

# Verify package contents
npm pack --dry-run

# Publish
npm publish --access public

# Verify published
npm view @agent-trace/openai-tracer version
# Should show: 1.0.2
```

---

## 🧪 Post-Publishing Verification

### Test Fresh Installation

```bash
# Create test directory
mkdir /tmp/axon-test
cd /tmp/axon-test
npm init -y

# Install packages
npm install agent-trace-backend@1.0.2 --save-dev
npm install dashboard@1.0.2 --save-dev
npm install @agent-trace/cli@1.0.2 --save-dev
npm install @agent-trace/langchain-tracer@1.0.2

# Test backend
node node_modules/agent-trace-backend/dist/server.js &
# Should start on 127.0.0.1:3000

# Test dashboard
cd node_modules/dashboard && npm run dev &
# Should start without errors

# Test CLI
npx axon --version
# Should show: 1.0.2

# Cleanup
pkill -f "node.*server.js"
pkill -f "vite"
cd ~
rm -rf /tmp/axon-test
```

---

## 📝 Update Customer Support Agent Project

After publishing, update the customer support agent project:

```bash
cd /path/to/customer-support-agent

# Update packages
npm update @axon-ai/backend@1.0.2
npm update @axon-ai/dashboard@1.0.2
npm update @axon-ai/cli@1.0.2
npm update @axon-ai/langchain-tracer@1.0.2

# Verify versions
npm list | grep @axon-ai
# Should show all at 1.0.2

# Test
npm run axon:backend &
npm run axon:dashboard &

# Should work without EPERM or React errors!
```

---

## 📢 Announcement Template

### npm Package Description Update

```markdown
# AXON v1.0.2 - Critical Fixes

## What's Fixed

✅ Port binding issues on macOS (EPERM errors)
✅ React 18.3 ESM compatibility
✅ Dashboard proxy configuration
✅ CLI command aliases (axon, axon-ai)
✅ Vite dependency optimization

## Breaking Changes

None! This is a patch release with bug fixes only.

## Upgrade

```bash
npm update @axon-ai/backend @axon-ai/dashboard @axon-ai/cli @axon-ai/langchain-tracer
```

## Documentation

- [Docker Setup](https://github.com/yourusername/axon/blob/main/DOCKER_SETUP.md)
- [Quick Start](https://github.com/yourusername/axon/blob/main/DOCKER_QUICKSTART.md)
- [Troubleshooting](https://github.com/yourusername/axon/blob/main/TROUBLESHOOTING.md)
```

---

## 🐛 Troubleshooting Publishing

### Issue: "You do not have permission to publish"

```bash
# Check you're logged in
npm whoami

# Check package scope
# If using @axon-ai scope, you need organization access
npm org ls axon-ai

# Or change to personal scope
# In package.json: "@yourusername/package-name"
```

### Issue: "Version already exists"

```bash
# Bump version again
npm version patch  # 1.0.2 → 1.0.3

# Or use specific version
npm version 1.0.3
```

### Issue: "Package name too similar to existing package"

```bash
# Use a unique name or scope
# Example: @agent-trace/backend instead of agent-trace-backend
```

### Issue: "Build files missing"

```bash
# Ensure prepublishOnly script runs
npm run build

# Or add to package.json:
"prepublishOnly": "npm run build"
```

---

## 📊 Package Publishing Status

| Package | Version | Status | npm Link |
|---------|---------|--------|----------|
| `agent-trace-backend` | 1.0.2 | ⏳ Ready | [npm](https://www.npmjs.com/package/agent-trace-backend) |
| `dashboard` | 1.0.2 | ⏳ Ready | [npm](https://www.npmjs.com/package/dashboard) |
| `@agent-trace/cli` | 1.0.2 | ⏳ Ready | [npm](https://www.npmjs.com/package/@agent-trace/cli) |
| `@agent-trace/langchain-tracer` | 1.0.2 | ⏳ Ready | [npm](https://www.npmjs.com/package/@agent-trace/langchain-tracer) |
| `@agent-trace/openai-tracer` | 1.0.2 | ⏳ Ready | [npm](https://www.npmjs.com/package/@agent-trace/openai-tracer) |

---

## 🔄 Version History

### v1.0.2 (November 6, 2025)
- Fixed port binding to use 127.0.0.1
- Updated React to 18.3.1
- Fixed ESM imports
- Added Vite optimizeDeps
- Added CLI aliases

### v1.0.1 (November 5, 2025)
- Initial npm release
- Known issues with port binding and React compatibility

### v1.0.0 (November 4, 2025)
- Initial release

---

## 📚 Additional Resources

- [npm Publishing Guide](https://docs.npmjs.com/packages-and-modules/contributing-packages-to-the-registry)
- [Semantic Versioning](https://semver.org/)
- [npm Scopes](https://docs.npmjs.com/cli/v9/using-npm/scope)

---

## ✅ Final Checklist

Before publishing, ensure:

- [ ] All packages built successfully
- [ ] All tests passing
- [ ] Version numbers updated to 1.0.2
- [ ] CHANGELOG.md updated
- [ ] README.md updated
- [ ] Logged into npm
- [ ] Tested locally
- [ ] Git committed and tagged
- [ ] Ready to publish!

---

**Ready to publish? Run the commands in the Publishing Steps section above!** 🚀

