# Cloud Dojo Worker

Go-based high-performance worker for Docker and Kubernetes operations.

## Features

- Docker API operations (image build, container management)
- Kubernetes API operations (deployments, services, pods)
- Event streaming for real-time updates
- WebSocket support for log streaming

## Development

```bash
# Install dependencies
go mod download

# Run server
go run cmd/server/main.go

# Build
go build -o bin/worker cmd/server/main.go

# Test
go test ./...
```

## API Endpoints

### Docker
- `POST /api/docker/build` - Build Docker image
- `GET /api/docker/images` - List Docker images
- `GET /api/docker/build/:id/logs` - Stream build logs

### Kubernetes
- `POST /api/k8s/deploy` - Deploy to Kubernetes
- `GET /api/k8s/pods` - List pods
- `GET /api/k8s/services` - List services
- `GET /api/k8s/deployments` - List deployments
