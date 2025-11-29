package docker

import (
	"context"
	"io"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/client"
)

type Service struct {
	client *client.Client
}

func NewService() (*Service, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, err
	}

	return &Service{client: cli}, nil
}

func (s *Service) BuildImage(ctx context.Context, dockerfile string, tag string) (string, error) {
	// TODO: Implement Docker image build
	// This will create a build context, send it to Docker daemon,
	// and stream the build logs
	return "", nil
}

func (s *Service) ListImages(ctx context.Context) ([]types.ImageSummary, error) {
	images, err := s.client.ImageList(ctx, types.ImageListOptions{})
	if err != nil {
		return nil, err
	}
	return images, nil
}

func (s *Service) GetBuildLogs(ctx context.Context, buildID string) (io.ReadCloser, error) {
	// TODO: Implement build log streaming
	return nil, nil
}

func (s *Service) Close() error {
	return s.client.Close()
}
