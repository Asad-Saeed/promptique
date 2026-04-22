#!/bin/bash
# Copy shared code from core/ into extension/ and pwa/.
# Run after editing core/core.js or core/styles.css.
set -e
cd "$(dirname "$0")"
cp core/core.js    extension/core.js
cp core/core.js    pwa/core.js
cp core/styles.css extension/styles.css
cp core/styles.css pwa/styles.css
echo "Synced core/ -> extension/ and pwa/"
