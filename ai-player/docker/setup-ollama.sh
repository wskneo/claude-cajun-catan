#!/bin/bash

# Setup script to pull Gemma3 270M model into Ollama

echo "Setting up Ollama with Gemma3 270M model..."

# Wait for Ollama to be ready
echo "Waiting for Ollama service to be ready..."
until curl -f http://localhost:11434/api/version > /dev/null 2>&1; do
  echo "Waiting for Ollama..."
  sleep 2
done

echo "Ollama is ready. Pulling gemma3:270m model..."

# Pull the lightweight Gemma3 270M model
docker exec catan-ollama ollama pull gemma3:270m

if [ $? -eq 0 ]; then
  echo "✅ Gemma3 270M model successfully pulled!"
  echo "Testing model..."
  
  # Test the model with a simple prompt
  curl -X POST http://localhost:11434/api/generate \
    -H "Content-Type: application/json" \
    -d '{
      "model": "gemma3:270m",
      "prompt": "Hello! Can you help me play Catan?",
      "stream": false
    }' | jq .
  
  echo "🎉 AI Player Service is ready!"
else
  echo "❌ Failed to pull gemma3:270m model"
  exit 1
fi