# 📄 Documents Hub

Documents Hub is a powerful and intuitive application designed to streamline the management and exploration of your documents. With Documents Hub, you can effortlessly upload your documents, engage in intelligent conversations with them, and efficiently manage your document repository.

At its core, Documents Hub leverages cutting-edge technologies to provide a seamless user experience. The backend is built with FastAPI, a modern and high-performance Python web framework. For intelligent document analysis and chat capabilities, the application integrates with Ollama, a powerful large language model (LLM). Vector storage and retrieval are handled by Qdrant, a highly efficient and scalable vector database.

## Features

*   **Document Upload**: Easily upload your documents in various formats.
*   **Intelligent Chat**: Engage in natural language conversations with your documents to extract information and gain insights.
*   **Document Management**: Organize and manage your documents in a user-friendly interface.
*   **Dockerized Environment**: The entire application is containerized with Docker, ensuring easy setup and deployment.


## Running docker
    docker compose -f docker-compose.dev.yaml up --build

### Dev
    docker-compose -f docker-compose.dev.yaml --env-file .env.dev up
    
    docker-compose -f docker-compose.dev.yaml --env-file .env.dev down
    docker compose -f docker-compose.dev.yaml --env-file .env.dev build --no-cache backend

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

## Tests
docker-compose -f docker-compose.test.yaml up --build --abort-on-container-exit

## Check Qdrant Database
http://localhost:6333/dashboard