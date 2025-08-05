# 📄 Documents Hub

## Running docker
    docker compose -f docker-compose.dev.yaml up --build

### Dev
    docker-compose -f docker-compose.dev.yaml --env-file .env.dev up
    
    docker-compose -f docker-compose.dev.yaml down
    docker compose -f docker-compose.dev.yaml build --no-cache backend

### Prod
    docker-compose -f docker-compose.yaml --env-file .env up -d

### Check what's in the Docker volume:
    docker-compose -f docker-compose.dev.yaml exec ollama ollama list
    # Should show your qwen:7b model

### Test model with curl:
    curl -X POST http://localhost:11434/api/generate \
     -H "Content-Type: application/json" \
     -d '{"model": "qwen:7b", "prompt": "Hello!", "stream": false}'


## Backend
Docs are avaiable at: http://localhost:8000/docs#/

## Check Qdrant Database
http://localhost:6333/dashboard