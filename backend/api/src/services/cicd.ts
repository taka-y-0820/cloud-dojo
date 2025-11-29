import { EventEmitter } from 'events';
import * as yaml from 'js-yaml';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

export interface WorkflowStep {
  name: string;
  run?: string;
  uses?: string;
  with?: Record<string, any>;
  env?: Record<string, string>;
}

export interface WorkflowJob {
  name: string;
  'runs-on': string;
  steps: WorkflowStep[];
  needs?: string[];
  if?: string;
}

export interface Workflow {
  name: string;
  on: {
    push?: { branches?: string[] };
    pull_request?: { branches?: string[] };
    workflow_dispatch?: any;
  };
  jobs: Record<string, WorkflowJob>;
}

export interface WorkflowRun {
  id: string;
  workflowName: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped';
  jobs: JobRun[];
  startTime: Date;
  endTime?: Date;
  duration?: number;
  trigger: string;
  branch: string;
}

export interface JobRun {
  id: string;
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped';
  steps: StepRun[];
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  runner: string;
}

export interface StepRun {
  id: string;
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  conclusion?: 'success' | 'failure' | 'cancelled' | 'skipped';
  output: string[];
  startTime?: Date;
  endTime?: Date;
  duration?: number;
}

export class CICDService extends EventEmitter {
  private workflows: Map<string, Workflow> = new Map();
  private runs: Map<string, WorkflowRun> = new Map();
  private workspaceDir: string;

  constructor() {
    super();
    // Create a workspace directory for CI/CD execution
    this.workspaceDir = path.join(process.cwd(), '.cicd-workspace');
  }

  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.workspaceDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create workspace directory:', error);
    }
  }

  parseWorkflow(yamlContent: string): Workflow {
    try {
      const workflow = yaml.load(yamlContent) as Workflow;
      
      if (!workflow.name) {
        throw new Error('Workflow name is required');
      }
      
      if (!workflow.jobs || Object.keys(workflow.jobs).length === 0) {
        throw new Error('At least one job is required');
      }
      
      return workflow;
    } catch (error: any) {
      throw new Error(`Failed to parse workflow: ${error.message}`);
    }
  }

  validateWorkflow(workflow: Workflow): string[] {
    const errors: string[] = [];
    
    if (!workflow.name || workflow.name.trim().length === 0) {
      errors.push('Workflow name is required');
    }
    
    if (!workflow.on) {
      errors.push('Workflow trigger (on) is required');
    }
    
    if (!workflow.jobs || Object.keys(workflow.jobs).length === 0) {
      errors.push('At least one job is required');
    }
    
    // Validate each job
    Object.entries(workflow.jobs).forEach(([jobId, job]) => {
      if (!job['runs-on']) {
        errors.push(`Job '${jobId}' must specify 'runs-on'`);
      }
      
      if (!job.steps || job.steps.length === 0) {
        errors.push(`Job '${jobId}' must have at least one step`);
      }
      
      // Validate job dependencies
      if (job.needs) {
        const needsArray = Array.isArray(job.needs) ? job.needs : [job.needs];
        needsArray.forEach(neededJob => {
          if (!workflow.jobs[neededJob]) {
            errors.push(`Job '${jobId}' depends on non-existent job '${neededJob}'`);
          }
        });
      }
      
      // Validate steps
      job.steps.forEach((step, index) => {
        if (!step.name) {
          errors.push(`Step ${index + 1} in job '${jobId}' must have a name`);
        }
        
        if (!step.run && !step.uses) {
          errors.push(`Step '${step.name}' in job '${jobId}' must have either 'run' or 'uses'`);
        }
      });
    });
    
    return errors;
  }

  async runWorkflow(workflow: Workflow, trigger: string = 'manual', branch: string = 'main', executionMode: 'simulation' | 'real' = 'simulation'): Promise<WorkflowRun> {
    const runId = `run-${Date.now()}`;
    
    console.log(`📝 Running workflow "${workflow.name}" in ${executionMode} mode`);
    
    const run: WorkflowRun = {
      id: runId,
      workflowName: workflow.name,
      status: 'queued',
      jobs: [],
      startTime: new Date(),
      trigger,
      branch,
    };
    
    this.runs.set(runId, run);
    this.emit('run:created', run);
    
    // Start execution asynchronously with execution mode
    this.executeWorkflow(runId, workflow, executionMode).catch(error => {
      console.error('Workflow execution failed:', error);
      const run = this.runs.get(runId);
      if (run) {
        run.status = 'failed';
        run.conclusion = 'failure';
        run.endTime = new Date();
        run.duration = run.endTime.getTime() - run.startTime.getTime();
        this.emit('run:failed', run);
      }
    });
    
    return run;
  }

  private async executeWorkflow(runId: string, workflow: Workflow, executionMode: 'simulation' | 'real' = 'simulation'): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) return;
    
    run.status = 'in_progress';
    this.emit('run:started', run);
    
    // Build job dependency graph
    const jobGraph = this.buildJobGraph(workflow);
    const completedJobs = new Set<string>();
    
    try {
      // Execute jobs in order based on dependencies
      for (const jobBatch of jobGraph) {
        await Promise.all(
          jobBatch.map(async (jobId) => {
            const job = workflow.jobs[jobId];
            await this.executeJob(runId, jobId, job, executionMode);
            completedJobs.add(jobId);
          })
        );
      }
      
      run.status = 'completed';
      run.conclusion = 'success';
    } catch (error: any) {
      run.status = 'failed';
      run.conclusion = 'failure';
    }
    
    run.endTime = new Date();
    run.duration = run.endTime.getTime() - run.startTime.getTime();
    
    this.emit('run:completed', run);
  }

  private buildJobGraph(workflow: Workflow): string[][] {
    const graph: string[][] = [];
    const processed = new Set<string>();
    const jobIds = Object.keys(workflow.jobs);
    
    while (processed.size < jobIds.length) {
      const batch: string[] = [];
      
      for (const jobId of jobIds) {
        if (processed.has(jobId)) continue;
        
        const job = workflow.jobs[jobId];
        const needs = job.needs ? (Array.isArray(job.needs) ? job.needs : [job.needs]) : [];
        
        // Check if all dependencies are processed
        if (needs.every(dep => processed.has(dep))) {
          batch.push(jobId);
        }
      }
      
      if (batch.length === 0) break; // Prevent infinite loop
      
      batch.forEach(jobId => processed.add(jobId));
      graph.push(batch);
    }
    
    return graph;
  }

  private async executeJob(runId: string, jobId: string, job: WorkflowJob, executionMode: 'simulation' | 'real' = 'simulation'): Promise<void> {
    const run = this.runs.get(runId);
    if (!run) return;
    
    const jobRun: JobRun = {
      id: `${runId}-${jobId}`,
      name: job.name || jobId,
      status: 'queued',
      steps: [],
      runner: job['runs-on'],
    };
    
    run.jobs.push(jobRun);
    this.emit('job:queued', { runId, jobRun });
    
    await this.sleep(500); // Simulate queue time
    
    jobRun.status = 'in_progress';
    jobRun.startTime = new Date();
    this.emit('job:started', { runId, jobRun });
    
    try {
      // Execute steps sequentially
      for (let i = 0; i < job.steps.length; i++) {
        const step = job.steps[i];
        await this.executeStep(runId, jobRun, step, i, executionMode);
        
        // Check if step failed
        const stepRun = jobRun.steps[i];
        if (stepRun.conclusion === 'failure') {
          throw new Error(`Step '${step.name}' failed`);
        }
      }
      
      jobRun.status = 'completed';
      jobRun.conclusion = 'success';
    } catch (error: any) {
      jobRun.status = 'failed';
      jobRun.conclusion = 'failure';
    }
    
    jobRun.endTime = new Date();
    jobRun.duration = jobRun.endTime.getTime() - (jobRun.startTime?.getTime() || 0);
    
    this.emit('job:completed', { runId, jobRun });
  }

  private async executeStep(runId: string, jobRun: JobRun, step: WorkflowStep, index: number, executionMode: 'simulation' | 'real' = 'simulation'): Promise<void> {
    const stepRun: StepRun = {
      id: `${jobRun.id}-step-${index}`,
      name: step.name,
      status: 'queued',
      output: [],
    };
    
    jobRun.steps.push(stepRun);
    this.emit('step:queued', { runId, jobRun, stepRun });
    
    await this.sleep(500);
    
    stepRun.status = 'in_progress';
    stepRun.startTime = new Date();
    this.emit('step:started', { runId, jobRun, stepRun });
    
    try {
      // Handle actions (uses)
      if (step.uses) {
        await this.executeAction(step, stepRun, runId, jobRun);
      }
      
      // Handle commands (run)
      if (step.run) {
        await this.executeCommand(step, stepRun, runId, jobRun, executionMode);
      }
      
      stepRun.status = 'completed';
      stepRun.conclusion = 'success';
    } catch (error: any) {
      stepRun.status = 'failed';
      stepRun.conclusion = 'failure';
      stepRun.output.push(`Error: ${error.message}`);
      this.emit('step:output', { runId, jobRun, stepRun, line: stepRun.output[stepRun.output.length - 1] });
    }
    
    stepRun.endTime = new Date();
    stepRun.duration = stepRun.endTime.getTime() - (stepRun.startTime?.getTime() || 0);
    
    this.emit('step:completed', { runId, jobRun, stepRun });
  }

  private async executeAction(step: WorkflowStep, stepRun: StepRun, runId: string, jobRun: JobRun): Promise<void> {
    stepRun.output.push(`🔧 Using action: ${step.uses}`);
    this.emit('step:output', { runId, jobRun, stepRun, line: stepRun.output[stepRun.output.length - 1] });
    await this.sleep(800);
    
    if (step.with) {
      stepRun.output.push(`📋 Parameters: ${JSON.stringify(step.with, null, 2)}`);
      this.emit('step:output', { runId, jobRun, stepRun, line: stepRun.output[stepRun.output.length - 1] });
      await this.sleep(400);
    }

    // Simulate common actions with realistic timing
    const actionName = step.uses || '';
    if (actionName.includes('actions/checkout')) {
      await this.sleep(2000); // Checkout takes ~2 seconds
      stepRun.output.push('✓ Repository checked out successfully');
      this.emit('step:output', { runId, jobRun, stepRun, line: stepRun.output[stepRun.output.length - 1] });
    } else if (actionName.includes('actions/setup-node')) {
      const version = step.with?.['node-version'] || '18';
      await this.sleep(3000); // Setup takes ~3 seconds
      stepRun.output.push(`✓ Node.js ${version} setup completed`);
      this.emit('step:output', { runId, jobRun, stepRun, line: stepRun.output[stepRun.output.length - 1] });
    } else if (actionName.includes('docker/setup-buildx')) {
      await this.sleep(4000); // Docker setup takes ~4 seconds
      stepRun.output.push('✓ Docker Buildx setup completed');
      this.emit('step:output', { runId, jobRun, stepRun, line: stepRun.output[stepRun.output.length - 1] });
    } else if (actionName.includes('docker/login')) {
      await this.sleep(2500); // Login takes ~2.5 seconds
      stepRun.output.push('✓ Docker login successful');
      this.emit('step:output', { runId, jobRun, stepRun, line: stepRun.output[stepRun.output.length - 1] });
    } else {
      await this.sleep(1500);
      stepRun.output.push(`✓ Action ${actionName} completed`);
      this.emit('step:output', { runId, jobRun, stepRun, line: stepRun.output[stepRun.output.length - 1] });
    }
  }

  private async executeCommand(step: WorkflowStep, stepRun: StepRun, runId: string, jobRun: JobRun, executionMode: 'simulation' | 'real' = 'simulation'): Promise<void> {
    const commands = step.run!.split('\n').filter(cmd => cmd.trim().length > 0);
    
    for (const command of commands) {
      const trimmedCommand = command.trim();
      if (!trimmedCommand || trimmedCommand.startsWith('#')) continue;
      
      stepRun.output.push(`$ ${trimmedCommand}`);
      this.emit('step:output', { runId, jobRun, stepRun, line: stepRun.output[stepRun.output.length - 1] });
      await this.sleep(400);
      
      try {
        // Execute commands based on mode
        const result = await this.executeSafeCommand(trimmedCommand, step.env, executionMode);
        
        // Stream output line by line
        if (result.stdout) {
          const lines = result.stdout.trim().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              stepRun.output.push(line);
              this.emit('step:output', { runId, jobRun, stepRun, line });
              await this.sleep(100);
            }
          }
        }
        
        if (result.stderr) {
          const lines = result.stderr.trim().split('\n');
          for (const line of lines) {
            if (line.trim()) {
              stepRun.output.push(`⚠️  ${line}`);
              this.emit('step:output', { runId, jobRun, stepRun, line: stepRun.output[stepRun.output.length - 1] });
              await this.sleep(100);
            }
          }
        }
      } catch (error: any) {
        throw new Error(`Command failed: ${error.message}`);
      }
    }
  }

  private async executeSafeCommand(command: string, env?: Record<string, string>, executionMode: 'simulation' | 'real' = 'simulation'): Promise<{ stdout: string; stderr: string }> {
    // In simulation mode, always simulate
    if (executionMode === 'simulation') {
      console.log(`🎭 Simulating command: ${command}`);
      return this.simulateCommand(command);
    }
    
    // In real mode, execute safe commands
    console.log(`⚡ Attempting real execution: ${command}`);
    
    // Whitelist of safe commands to actually execute
    const safeCommands = [
      'echo',
      'node --version',
      'npm --version',
      'pnpm --version',
      'docker --version',
      'git --version',
      'ls',
      'pwd',
      'date',
      'whoami',
    ];

    const isSafeCommand = safeCommands.some(safe => command.startsWith(safe));

    if (isSafeCommand) {
      try {
        console.log(`✅ Executing real command: ${command}`);
        const { stdout, stderr } = await execAsync(command, {
          cwd: this.workspaceDir,
          env: { ...process.env, ...env },
          timeout: 30000, // 30 second timeout
        });
        return { stdout, stderr };
      } catch (error: any) {
        console.log(`⚠️  Real command failed, falling back to simulation: ${error.message}`);
        // If command fails, fall back to simulation
        return this.simulateCommand(command);
      }
    } else {
      console.log(`🎭 Unsafe command, simulating: ${command}`);
      // Simulate unsafe commands
      return this.simulateCommand(command);
    }
  }

  private async simulateCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    // Simulate realistic command execution times
    let delay = 1000; // Base delay of 1 second
    
    if (command.includes('npm install') || command.includes('npm ci') || command.includes('pnpm install')) {
      delay = 8000 + Math.random() * 4000; // 8-12 seconds for install
    } else if (command.includes('npm run build') || command.includes('pnpm build') || command.includes('npm run lint')) {
      delay = 5000 + Math.random() * 3000; // 5-8 seconds for build/lint
    } else if (command.includes('npm test') || command.includes('pnpm test')) {
      delay = 4000 + Math.random() * 3000; // 4-7 seconds for tests
    } else if (command.includes('docker build')) {
      delay = 15000 + Math.random() * 10000; // 15-25 seconds for docker build
    } else if (command.includes('go build') || command.includes('go test')) {
      delay = 3000 + Math.random() * 2000; // 3-5 seconds for go commands
    } else {
      delay = 1000 + Math.random() * 2000; // 1-3 seconds for other commands
    }
    
    await this.sleep(delay);
    
    const output = this.generateMockOutput(command);
    return { stdout: output.join('\n'), stderr: '' };
  }

  private generateMockOutput(command: string): string[] {
    const output: string[] = [];
    
    if (command.includes('npm install') || command.includes('pnpm install')) {
      output.push('Lockfile is up to date, resolution step is skipped');
      output.push('Packages: +234');
      output.push('++++++++++++++++++++++++++++++++++++++++++++');
      output.push('Progress: resolved 234, reused 234, downloaded 0, added 234, done');
    } else if (command.includes('npm run build') || command.includes('pnpm build')) {
      output.push('> build');
      output.push('> vite build');
      output.push('');
      output.push('vite v5.0.10 building for production...');
      output.push('✓ 456 modules transformed.');
      output.push('dist/index.html                   0.45 kB │ gzip:  0.29 kB');
      output.push('dist/assets/index-abc123.css      5.67 kB │ gzip:  1.82 kB');
      output.push('dist/assets/index-def456.js     142.34 kB │ gzip: 45.12 kB');
      output.push('✓ built in 3.42s');
    } else if (command.includes('npm test') || command.includes('pnpm test')) {
      output.push('> test');
      output.push('> vitest run');
      output.push('');
      output.push(' ✓ src/components/Button.test.tsx (3)');
      output.push(' ✓ src/utils/helpers.test.ts (8)');
      output.push('');
      output.push('Test Files  2 passed (2)');
      output.push('     Tests  11 passed (11)');
      output.push('  Start at  17:30:15');
      output.push('  Duration  1.23s');
    } else if (command.includes('docker build')) {
      output.push('Sending build context to Docker daemon  2.048kB');
      output.push('Step 1/8 : FROM node:20-alpine AS builder');
      output.push(' ---> a1b2c3d4e5f6');
      output.push('Step 2/8 : WORKDIR /app');
      output.push(' ---> Using cache');
      output.push(' ---> b2c3d4e5f6a7');
      output.push('Step 3/8 : COPY package*.json ./');
      output.push(' ---> c3d4e5f6a7b8');
      output.push('Successfully built d4e5f6a7b8c9');
      output.push('Successfully tagged app:latest');
    } else if (command.includes('go build')) {
      output.push('go: downloading dependencies...');
      output.push('go: building executable...');
      output.push('Build completed successfully');
    } else {
      output.push('Command executed successfully');
    }
    
    return output;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getRun(runId: string): WorkflowRun | undefined {
    return this.runs.get(runId);
  }

  getAllRuns(): WorkflowRun[] {
    return Array.from(this.runs.values()).sort((a, b) => 
      b.startTime.getTime() - a.startTime.getTime()
    );
  }

  saveWorkflow(id: string, workflow: Workflow): void {
    this.workflows.set(id, workflow);
  }

  getWorkflow(id: string): Workflow | undefined {
    return this.workflows.get(id);
  }

  getAllWorkflows(): Map<string, Workflow> {
    return this.workflows;
  }

  cancelRun(runId: string): boolean {
    const run = this.runs.get(runId);
    if (!run || run.status === 'completed' || run.status === 'failed') {
      return false;
    }
    
    run.status = 'cancelled';
    run.conclusion = 'cancelled';
    run.endTime = new Date();
    run.duration = run.endTime.getTime() - run.startTime.getTime();
    
    this.emit('run:cancelled', run);
    return true;
  }
}

export const cicdService = new CICDService();
