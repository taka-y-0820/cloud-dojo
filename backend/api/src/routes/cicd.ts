import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { cicdService } from '../services/cicd';
import { addCICDRunTask } from '../services/queue';

const workflowSchema = z.object({
  yaml: z.string().min(1),
});

const runWorkflowSchema = z.object({
  yaml: z.string().min(1),
  trigger: z.string().optional().default('manual'),
  branch: z.string().optional().default('main'),
  executionMode: z.enum(['simulation', 'real']).optional().default('simulation'),
});

export async function cicdRoutes(fastify: FastifyInstance) {
  // Validate workflow YAML
  fastify.post('/validate', async (request, reply) => {
    try {
      const { yaml } = workflowSchema.parse(request.body);
      
      const workflow = cicdService.parseWorkflow(yaml);
      const errors = cicdService.validateWorkflow(workflow);
      
      if (errors.length > 0) {
        return {
          valid: false,
          errors,
        };
      }
      
      return {
        valid: true,
        workflow: {
          name: workflow.name,
          jobCount: Object.keys(workflow.jobs).length,
          stepCount: Object.values(workflow.jobs).reduce((sum, job) => sum + job.steps.length, 0),
        },
      };
    } catch (error: any) {
      return reply.code(400).send({
        valid: false,
        errors: [error.message],
      });
    }
  });

  // Run workflow
  fastify.post('/run', async (request, reply) => {
    try {
      const { yaml, trigger, branch, executionMode } = runWorkflowSchema.parse(request.body);
      
      const workflow = cicdService.parseWorkflow(yaml);
      const errors = cicdService.validateWorkflow(workflow);
      
      if (errors.length > 0) {
        return reply.code(400).send({
          error: 'Invalid workflow',
          details: errors,
        });
      }
      
      // Add to queue for async execution
      const jobId = await addCICDRunTask({
        workflow,
        trigger,
        branch,
        executionMode,
      });
      
      return {
        success: true,
        jobId,
        message: `Workflow queued for execution (${executionMode} mode)`,
        executionMode,
      };
    } catch (error: any) {
      return reply.code(400).send({
        error: 'Failed to run workflow',
        message: error.message,
      });
    }
  });

  // Get workflow run details
  fastify.get('/runs/:runId', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    
    const run = cicdService.getRun(runId);
    if (!run) {
      return reply.code(404).send({ error: 'Workflow run not found' });
    }
    
    return run;
  });

  // Get all workflow runs
  fastify.get('/runs', async (request, reply) => {
    const runs = cicdService.getAllRuns();
    return { runs };
  });

  // Cancel workflow run
  fastify.post('/runs/:runId/cancel', async (request, reply) => {
    const { runId } = request.params as { runId: string };
    
    const cancelled = cicdService.cancelRun(runId);
    if (!cancelled) {
      return reply.code(400).send({
        error: 'Cannot cancel workflow run',
        message: 'Run is already completed or does not exist',
      });
    }
    
    return { success: true, message: 'Workflow run cancelled' };
  });

  // Save workflow template
  fastify.post('/workflows', async (request, reply) => {
    try {
      const { yaml } = workflowSchema.parse(request.body);
      
      const workflow = cicdService.parseWorkflow(yaml);
      const errors = cicdService.validateWorkflow(workflow);
      
      if (errors.length > 0) {
        return reply.code(400).send({
          error: 'Invalid workflow',
          details: errors,
        });
      }
      
      const workflowId = `workflow-${Date.now()}`;
      cicdService.saveWorkflow(workflowId, workflow);
      
      return {
        success: true,
        workflowId,
        name: workflow.name,
      };
    } catch (error: any) {
      return reply.code(400).send({
        error: 'Failed to save workflow',
        message: error.message,
      });
    }
  });

  // Get saved workflows
  fastify.get('/workflows', async (request, reply) => {
    const workflows = Array.from(cicdService.getAllWorkflows().entries()).map(([id, workflow]) => ({
      id,
      name: workflow.name,
      jobCount: Object.keys(workflow.jobs).length,
    }));
    
    return { workflows };
  });

  // Get workflow by ID
  fastify.get('/workflows/:workflowId', async (request, reply) => {
    const { workflowId } = request.params as { workflowId: string };
    
    const workflow = cicdService.getWorkflow(workflowId);
    if (!workflow) {
      return reply.code(404).send({ error: 'Workflow not found' });
    }
    
    return workflow;
  });

  // Get workflow templates
  fastify.get('/templates', async (request, reply) => {
    return {
      templates: [
        {
          id: 'node-ci',
          name: 'Node.js CI',
          description: 'Build and test Node.js application',
          language: 'javascript',
        },
        {
          id: 'docker-build',
          name: 'Docker Build & Push',
          description: 'Build Docker image and push to registry',
          language: 'docker',
        },
        {
          id: 'go-ci',
          name: 'Go CI',
          description: 'Build and test Go application',
          language: 'go',
        },
        {
          id: 'python-ci',
          name: 'Python CI',
          description: 'Build and test Python application',
          language: 'python',
        },
      ],
    };
  });

  // Get template content
  fastify.get('/templates/:templateId', async (request, reply) => {
    const { templateId } = request.params as { templateId: string };
    
    const templates: Record<string, string> = {
      'node-ci': `name: Node.js CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    name: Build and Test
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linter
        run: npm run lint
      
      - name: Run tests
        run: npm test
      
      - name: Build
        run: npm run build`,

      'docker-build': `name: Docker Build & Push

on:
  push:
    branches: [ main ]
    tags: [ 'v*' ]

jobs:
  build:
    name: Build Docker Image
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3
      
      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: \${{ secrets.DOCKER_USERNAME }}
          password: \${{ secrets.DOCKER_PASSWORD }}
      
      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: myapp/api
      
      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: \${{ steps.meta.outputs.tags }}`,

      'go-ci': `name: Go CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    name: Build and Test
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      
      - name: Download dependencies
        run: go mod download
      
      - name: Run tests
        run: go test -v ./...
      
      - name: Run linter
        uses: golangci/golangci-lint-action@v3
        with:
          version: latest
      
      - name: Build
        run: go build -o bin/app cmd/server/main.go`,

      'python-ci': `name: Python CI

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    name: Build and Test
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          cache: 'pip'
      
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
      
      - name: Run linter
        run: |
          pip install flake8
          flake8 . --count --select=E9,F63,F7,F82 --show-source --statistics
      
      - name: Run tests
        run: |
          pip install pytest pytest-cov
          pytest --cov=app tests/`,
    };
    
    const yaml = templates[templateId];
    if (!yaml) {
      return reply.code(404).send({ error: 'Template not found' });
    }
    
    return { yaml };
  });
}
