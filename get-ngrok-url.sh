#!/bin/bash
echo "🔍 Getting ngrok URL..."
URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"[^"]*"' | head -1 | sed 's/"public_url":"//' | sed 's/"//')
if [ -z "$URL" ]; then
    echo "❌ No ngrok tunnel found. Is ngrok running?"
else
    echo "✅ Your ngrok URL: $URL"
    echo "📋 Copy this URL to share with others!"
fi 