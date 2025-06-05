#!/bin/bash
# [NIM] [NAMA] - UAS WebGIS 2024/2425

echo "🚀 Starting WebGIS Application..."

# Generate Prisma client
echo "📦 Generating Prisma client..."
npx prisma generate

# Push database schema
echo "🗄️ Updating database schema..."
npx prisma db push

# Start the server
echo "🌐 Starting server..."
npm start
