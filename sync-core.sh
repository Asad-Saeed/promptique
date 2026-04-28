#!/bin/bash
# Sync core/ into extension/ and pwa/.
set -e
cd "$(dirname "$0")"
cp core/core.js     extension/core.js
cp core/core.js     pwa/core.js
cp core/userKey.js  extension/userKey.js
cp core/userKey.js  pwa/userKey.js
cp core/settings.js extension/settings.js
cp core/settings.js pwa/settings.js
cp core/styles.css  extension/styles.css
cp core/styles.css  pwa/styles.css
echo "Synced core/ -> extension/ and pwa/"
