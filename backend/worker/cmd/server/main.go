package main

import (
	"log"
	"os"

	"cloud-dojo-worker/internal/api"
	"cloud-dojo-worker/internal/config"
	"cloud-dojo-worker/internal/docker"
	"cloud-dojo-worker/internal/k8s"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize services
	dockerService, err := docker.NewService()
	if err != nil {
		log.Fatalf("Failed to initialize Docker service: %v", err)
	}

	k8sService, err := k8s.NewService(cfg.KubeConfig)
	if err != nil {
		log.Fatalf("Failed to initialize K8s service: %v", err)
	}

	// Create Fiber app
	app := fiber.New(fiber.Config{
		AppName: "Cloud Dojo Worker",
	})

	// Middleware
	app.Use(logger.New())
	app.Use(cors.New(cors.Config{
		AllowOrigins: cfg.CorsOrigin,
		AllowHeaders: "Origin, Content-Type, Accept",
	}))

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status": "ok",
			"service": "worker",
		})
	})

	// Setup routes
	api.SetupRoutes(app, dockerService, k8sService)

	// Start server
	port := os.Getenv("WORKER_PORT")
	if port == "" {
		port = "5000"
	}

	log.Printf("🚀 Worker server starting on port %s", port)
	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
