package api

import (
	"cloud-dojo-worker/internal/docker"
	"cloud-dojo-worker/internal/k8s"

	"github.com/gofiber/fiber/v2"
)

func SetupRoutes(app *fiber.App, dockerSvc *docker.Service, k8sSvc *k8s.Service) {
	api := app.Group("/api")

	// Docker routes
	dockerGroup := api.Group("/docker")
	dockerGroup.Post("/build", handleDockerBuild(dockerSvc))
	dockerGroup.Get("/images", handleListImages(dockerSvc))
	dockerGroup.Get("/build/:id/logs", handleBuildLogs(dockerSvc))

	// Kubernetes routes
	k8sGroup := api.Group("/k8s")
	k8sGroup.Post("/deploy", handleK8sDeploy(k8sSvc))
	k8sGroup.Get("/pods", handleListPods(k8sSvc))
	k8sGroup.Get("/services", handleListServices(k8sSvc))
	k8sGroup.Get("/deployments", handleListDeployments(k8sSvc))
}

func handleDockerBuild(svc *docker.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			Dockerfile string `json:"dockerfile"`
			Tag        string `json:"tag"`
		}

		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		buildID, err := svc.BuildImage(c.Context(), req.Dockerfile, req.Tag)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(fiber.Map{
			"buildId": buildID,
			"status":  "started",
		})
	}
}

func handleListImages(svc *docker.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		images, err := svc.ListImages(c.Context())
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(fiber.Map{"images": images})
	}
}

func handleBuildLogs(svc *docker.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		buildID := c.Params("id")

		logs, err := svc.GetBuildLogs(c.Context(), buildID)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		defer logs.Close()

		// TODO: Stream logs via WebSocket
		return c.JSON(fiber.Map{"buildId": buildID})
	}
}

func handleK8sDeploy(svc *k8s.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			Manifest  string `json:"manifest"`
			Namespace string `json:"namespace"`
		}

		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		if req.Namespace == "" {
			req.Namespace = "default"
		}

		deployID, err := svc.Deploy(c.Context(), req.Manifest, req.Namespace)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(fiber.Map{
			"deploymentId": deployID,
			"status":       "started",
		})
	}
}

func handleListPods(svc *k8s.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		namespace := c.Query("namespace", "default")

		pods, err := svc.ListPods(c.Context(), namespace)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(fiber.Map{"pods": pods})
	}
}

func handleListServices(svc *k8s.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		namespace := c.Query("namespace", "default")

		services, err := svc.ListServices(c.Context(), namespace)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(fiber.Map{"services": services})
	}
}

func handleListDeployments(svc *k8s.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		namespace := c.Query("namespace", "default")

		deployments, err := svc.ListDeployments(c.Context(), namespace)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}

		return c.JSON(fiber.Map{"deployments": deployments})
	}
}

// ネットワーク基礎のための環境構築
func handleCreateLab(svc *network.Service) fiber.Handler {
	return func(c *fiber.Ctx) error {
		var req struct {
			NodeCount int    `json:"nodeCount"`
			NetworkName string `json:"networkName"`
		}

		if err := c.BodyParser(&req); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
		}

		if req.NodeCount <= 0 {
			req.NodeCount = 3 // デフォルトのノード数
		}
		if req.NetworkName == "" {
			req.NetworkName = "cloud-dojo-net" // デフォルトのネットワーク名
		}

		labID, err := svc.CreateLab(c.Context(), req.LabType)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
		return c.JSON(fiber.Map{
			"labId":  labID,
			"status": "created",
		})
	}
}

