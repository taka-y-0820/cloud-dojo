-- Seed data for development

-- Insert a default user
INSERT INTO users (id, email, password, role)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@cloud-dojo.local',
    '$2b$10$YourHashedPasswordHere', -- Change this in production
    'owner'
) ON CONFLICT (email) DO NOTHING;

-- Insert learning modules
INSERT INTO exercises (module_id, title, description, difficulty, success_criteria)
VALUES
    ('docker-basics', 'Dockerfileを作成する', '基本的なDockerfileを作成し、Webサーバーイメージをビルドします', 'beginner', '{"build_success": true, "image_size_mb": {"max": 100}}'),
    ('docker-multi-stage', 'マルチステージビルド', 'マルチステージビルドを使用してイメージサイズを最適化します', 'intermediate', '{"build_success": true, "image_size_reduction": {"min_percent": 50}}'),
    ('k8s-deployment', 'Kubernetesデプロイメント', 'DeploymentとServiceを作成してアプリケーションをデプロイします', 'intermediate', '{"pods_running": {"min": 3}, "service_accessible": true}'),
    ('k8s-scaling', 'オートスケーリング', 'HorizontalPodAutoscalerを設定してスケーリングを実装します', 'advanced', '{"hpa_created": true, "scale_test_passed": true}')
ON CONFLICT DO NOTHING;
