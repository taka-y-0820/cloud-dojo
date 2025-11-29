package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	Port       string
	KubeConfig string
	CorsOrigin string
	RedisURL   string
}

func Load() *Config {
	godotenv.Load()

	return &Config{
		Port:       getEnv("WORKER_PORT", "5000"),
		KubeConfig: getEnv("KUBECONFIG", ""),
		CorsOrigin: getEnv("CORS_ORIGIN", "http://localhost:3000"),
		RedisURL:   getEnv("REDIS_URL", "redis://localhost:6379"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
