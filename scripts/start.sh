#!/bin/bash
# Start MedGenome Hospital Finder with both Next.js and AI Server

PROJECT_DIR="/home/z/my-project"

# Kill existing processes
pkill -f "next dev" 2>/dev/null
pkill -f "ai-server.js" 2>/dev/null
sleep 2

# Start AI server (standalone, handles Z-AI SDK to prevent Next.js crashes)
echo "Starting AI Server on port 3001..."
nohup node "$PROJECT_DIR/scripts/ai-server.js" > "$PROJECT_DIR/ai-server.log" 2>&1 &
AI_PID=$!
sleep 3

# Verify AI server is running
if curl -s -o /dev/null -w "%{http_code}" -X POST http://127.0.0.1:3001 -H "Content-Type: application/json" -d '{"query":"health"}' | grep -q "200"; then
  echo "AI Server started (PID: $AI_PID)"
else
  echo "WARNING: AI Server may not be running. AI will use embedded fallback."
fi

# Start Next.js
echo "Starting Next.js on port 3000..."
cd "$PROJECT_DIR"
nohup npx next dev -p 3000 > "$PROJECT_DIR/next.log" 2>&1 &
NEXT_PID=$!
sleep 8

# Verify Next.js
if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 | grep -q "200"; then
  echo "Next.js started (PID: $NEXT_PID)"
else
  echo "WARNING: Next.js may not be ready yet."
fi

echo ""
echo "=============================================="
echo "  MedGenome Hospital Finder is running!"
echo "=============================================="
echo "  Frontend:  http://localhost:3000"
echo "  AI Server: http://localhost:3001"
echo ""
echo "  AI Server PID: $AI_PID"
echo "  Next.js PID:   $NEXT_PID"
echo ""
echo "  Logs:"
echo "    AI:    $PROJECT_DIR/ai-server.log"
echo "    Next:  $PROJECT_DIR/next.log"
echo "=============================================="

disown $AI_PID 2>/dev/null || true
disown $NEXT_PID 2>/dev/null || true
