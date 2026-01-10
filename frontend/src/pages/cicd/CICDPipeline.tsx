import { useState, useEffect } from 'react';
import {
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Code,
  BookOpen,
  History,
  Settings,
  FileCode,
  Lightbulb,
  Zap,
  Activity,
  Package,
  Lock,
  Target,
  RefreshCw,
  GitBranch,
  NotebookPen,
} from 'lucide-react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { API_BASE_URL, WS_URL } from '@/config/constants';
import { PageLayout } from '@/layouts/PageLayout';
import { PageHeader } from '@/layouts/PageHeader';
import { Tabs } from '@/components/ui/tabs/Tabs';
import { TabItem } from '@/components/ui/tabs/types';
import { NoteEditor } from '@/components/ui/notes/NoteEditor';

interface WorkflowRun {
  id: string;
  workflowName: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  conclusion?: 'success' | 'failure' | 'cancelled';
  jobs: JobRun[];
  startTime: string;
  endTime?: string;
  duration?: number;
  trigger: string;
  branch: string;
}

interface JobRun {
  id: string;
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  conclusion?: 'success' | 'failure' | 'cancelled';
  steps: StepRun[];
  startTime?: string;
  endTime?: string;
  duration?: number;
  runner: string;
}

interface StepRun {
  id: string;
  name: string;
  status: 'queued' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  conclusion?: 'success' | 'failure' | 'cancelled';
  output: string[];
  startTime?: string;
  endTime?: string;
  duration?: number;
}

interface Template {
  id: string;
  name: string;
  description: string;
  language: string;
}

type CICDTab = 'learn' | 'create' | 'run' | 'history' | 'memo';

export function CICDPipeline() {
  const [activeTab, setActiveTab] = useState<CICDTab>('learn');
  const [yaml, setYaml] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentRun, setCurrentRun] = useState<WorkflowRun | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [executionMode, setExecutionMode] = useState<'simulation' | 'real'>('simulation');

  const { lastMessage } = useWebSocket(WS_URL);

  useEffect(() => {
    loadTemplates();
    loadRuns();
    // Load default template
    loadTemplateContent('node-ci');
  }, []);

  useEffect(() => {
    if (!lastMessage) return;

    console.log('Received WebSocket message:', lastMessage);

    if (lastMessage.type === 'cicd:run:created' || lastMessage.type === 'cicd:run:started') {
      setCurrentRun(lastMessage.data);
      setIsRunning(true);
    } else if (lastMessage.type === 'cicd:run:completed') {
      setCurrentRun(lastMessage.data);
      setIsRunning(false);
      loadRuns();
    } else if (lastMessage.type?.startsWith('cicd:')) {
      // Update current run with real-time updates directly from WebSocket data
      // Don't fetch again - use the data from the WebSocket message
      setCurrentRun((prev) => {
        if (!prev) return lastMessage.data;
        if (lastMessage.data?.id === prev.id) {
          return lastMessage.data;
        }
        return prev;
      });
    }
  }, [lastMessage]);

  const loadTemplates = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/cicd/templates`);
      const data = await response.json();
      setTemplates(data.templates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadTemplateContent = async (templateId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/cicd/templates/${templateId}`);
      const data = await response.json();
      setYaml(data.yaml);
      setSelectedTemplate(templateId);
    } catch (error) {
      console.error('Failed to load template content:', error);
    }
  };

  const loadRuns = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/cicd/runs`);
      const data = await response.json();
      setRuns(data.runs);
    } catch (error) {
      console.error('Failed to load runs:', error);
    }
  };

  const validateWorkflow = async () => {
    if (!yaml.trim()) return;

    setIsValidating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/cicd/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ yaml }),
      });

      const data = await response.json();
      setValidationResult(data);
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const runWorkflow = async () => {
    if (!yaml.trim()) return;

    setIsRunning(true);
    setCurrentRun(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/cicd/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          yaml,
          trigger: 'manual',
          branch: 'main',
          executionMode, // Add execution mode
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to run workflow');
      }

      const data = await response.json();
      console.log('Workflow queued:', data, 'mode:', executionMode);

      setActiveTab('run');

      // Wait a moment for the workflow to start, then poll for updates
      setTimeout(() => {
        loadRuns();
      }, 1000);
    } catch (error: any) {
      console.error('Failed to run workflow:', error);
      setIsRunning(false);
      alert(`Failed to run workflow: ${error.message}`);
    }
  };

  const getStatusIcon = (status: string, conclusion?: string) => {
    if (status === 'in_progress') {
      return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
    }
    if (status === 'completed') {
      if (conclusion === 'success') {
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      }
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    if (status === 'failed') {
      return <XCircle className="w-4 h-4 text-red-500" />;
    }
    return <Clock className="w-4 h-4 text-gray-400" />;
  };

  const getStatusColor = (status: string, conclusion?: string) => {
    if (status === 'in_progress') return 'text-blue-600 bg-blue-50';
    if (status === 'completed' && conclusion === 'success') return 'text-green-600 bg-green-50';
    if (status === 'failed' || conclusion === 'failure') return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return minutes > 0 ? `${minutes}m ${remainingSeconds}s` : `${seconds}s`;
  };

  const tabs: TabItem<CICDTab>[] = [
    {
      key: 'learn',
      label: '学習',
      icon: BookOpen,
    },
    {
      key: 'create',
      label: 'ワークフロー作成',
      icon: Code,
    },
    {
      key: 'run',
      label: '実行中',
      icon: Play,
    },
    {
      key: 'history',
      label: '実行履歴',
      icon: History,
    },
    {
      key: 'memo',
      label: 'メモ',
      icon: NotebookPen,
    },
  ];

  return (
    <PageLayout>
      <PageHeader
        title="CI/CDパイプライン"
        description="GitHub Actionsスタイルのワークフロー実行シミュレーション"
        Icon={GitBranch}
        bgColor="bg-gradient-to-br from-orange-500 to-red-500"
      />

      {/* Tabs */}
      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      <div className="flex-1 overflow-auto rounded-b-lg bg-card border-x border-b">
        {activeTab === 'learn' && (
          <div className="max-w-5xl mx-auto p-6 space-y-8">
            {/* CI/CD Overview */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20 p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg shadow-lg">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                  CI/CDとは？
                </h2>
              </div>
              <div className="prose max-w-none">
                <p className="text-muted-foreground mb-6 text-lg leading-relaxed">
                  CI/CD（Continuous Integration / Continuous
                  Delivery）は、ソフトウェア開発における自動化されたワークフローです。
                  コードの変更を自動的にビルド・テスト・デプロイすることで、開発速度と品質を向上させます。
                </p>
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/20 hover:border-blue-500/40 transition-colors">
                    <h3 className="font-bold text-blue-400 mb-2">Continuous Integration</h3>
                    <p className="text-sm text-muted-foreground">
                      コードの変更を自動的にビルド・テストし、問題を早期発見
                    </p>
                  </div>
                  <div className="bg-cyan-500/5 rounded-lg p-4 border border-cyan-500/20 hover:border-cyan-500/40 transition-colors">
                    <h3 className="font-bold text-cyan-400 mb-2">Continuous Delivery</h3>
                    <p className="text-sm text-muted-foreground">
                      テスト済みのコードを自動的にデプロイ可能な状態に
                    </p>
                  </div>
                  <div className="bg-teal-500/5 rounded-lg p-4 border border-teal-500/20 hover:border-teal-500/40 transition-colors">
                    <h3 className="font-bold text-teal-400 mb-2">Continuous Deployment</h3>
                    <p className="text-sm text-muted-foreground">
                      本番環境への自動デプロイまで実施
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* GitHub Actions Basics */}
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20 p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg shadow-lg">
                  <Code className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  GitHub Actionsの基本
                </h2>
              </div>
              <div className="prose max-w-none">
                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="font-bold text-foreground mb-3 text-lg">
                      ワークフローの構成要素
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 bg-purple-500/5 rounded-lg p-3 border border-purple-500/20 hover:border-purple-500/40 transition-colors">
                        <CheckCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-foreground">Workflow</strong>
                          <p className="text-sm text-muted-foreground">
                            自動化されたプロセス全体を定義
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 bg-purple-500/5 rounded-lg p-3 border border-purple-500/20 hover:border-purple-500/40 transition-colors">
                        <CheckCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-foreground">Job</strong>
                          <p className="text-sm text-muted-foreground">
                            ワークフロー内の実行単位（並列実行可能）
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 bg-purple-500/5 rounded-lg p-3 border border-purple-500/20 hover:border-purple-500/40 transition-colors">
                        <CheckCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-foreground">Step</strong>
                          <p className="text-sm text-muted-foreground">
                            ジョブ内の個別タスク（順次実行）
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 bg-purple-500/5 rounded-lg p-3 border border-purple-500/20 hover:border-purple-500/40 transition-colors">
                        <CheckCircle className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-foreground">Action</strong>
                          <p className="text-sm text-muted-foreground">
                            再利用可能なステップのコンポーネント
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-bold text-foreground mb-3 text-lg">トリガーイベント</h3>
                    <div className="space-y-3">
                      <div className="flex items-start gap-3 bg-pink-500/5 rounded-lg p-3 border border-pink-500/20 hover:border-pink-500/40 transition-colors">
                        <Play className="w-5 h-5 text-pink-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <code className="text-sm font-semibold text-foreground">push</code>
                          <p className="text-sm text-muted-foreground">コードのプッシュ時に実行</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 bg-pink-500/5 rounded-lg p-3 border border-pink-500/20 hover:border-pink-500/40 transition-colors">
                        <Play className="w-5 h-5 text-pink-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <code className="text-sm font-semibold text-foreground">
                            pull_request
                          </code>
                          <p className="text-sm text-muted-foreground">プルリクエスト時に実行</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 bg-pink-500/5 rounded-lg p-3 border border-pink-500/20 hover:border-pink-500/40 transition-colors">
                        <Play className="w-5 h-5 text-pink-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <code className="text-sm font-semibold text-foreground">
                            workflow_dispatch
                          </code>
                          <p className="text-sm text-muted-foreground">手動実行を許可</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 bg-pink-500/5 rounded-lg p-3 border border-pink-500/20 hover:border-pink-500/40 transition-colors">
                        <Play className="w-5 h-5 text-pink-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <code className="text-sm font-semibold text-foreground">schedule</code>
                          <p className="text-sm text-muted-foreground">定期実行（cron形式）</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* YAML Syntax Guide */}
            <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-xl border border-orange-500/20 p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg shadow-lg">
                  <FileCode className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                  ワークフローYAMLの書き方
                </h2>
              </div>

              <div className="space-y-6">
                <div>
                  <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded">
                      基本構造
                    </span>
                    基本的なワークフロー
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto border border-gray-700">
                    <pre className="text-sm text-gray-100">
                      <code>{`name: CI Workflow
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Run tests
        run: npm test`}</code>
                    </pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded">
                      並列実行
                    </span>
                    複数ジョブの並列実行
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto border border-gray-700">
                    <pre className="text-sm text-gray-100">
                      <code>{`jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm test

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm run lint

  deploy:
    needs: [test, lint]  # test と lint が成功後に実行
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying..."`}</code>
                    </pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded">
                      環境変数
                    </span>
                    環境変数とシークレット
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto border border-gray-700">
                    <pre className="text-sm text-gray-100">
                      <code>{`jobs:
  deploy:
    runs-on: ubuntu-latest
    env:
      NODE_ENV: production
      API_URL: https://api.example.com
    steps:
      - name: Deploy
        env:
          API_KEY: \${{ secrets.API_KEY }}  # リポジトリシークレット
          DB_PASSWORD: \${{ secrets.DB_PASSWORD }}
        run: |
          echo "Deploying to \${NODE_ENV}"
          ./deploy.sh`}</code>
                    </pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded">
                      マトリックス
                    </span>
                    マトリックスビルド
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto border border-gray-700">
                    <pre className="text-sm text-gray-100">
                      <code>{`jobs:
  test:
    runs-on: \${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [16, 18, 20]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: \${{ matrix.node-version }}
      - run: npm test`}</code>
                    </pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                    <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded">
                      条件分岐
                    </span>
                    条件付き実行
                  </h3>
                  <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto border border-gray-700">
                    <pre className="text-sm text-gray-100">
                      <code>{`jobs:
  deploy:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        if: success()  # 前のステップが成功した場合のみ
        run: ./deploy.sh
      
      - name: Notify failure
        if: failure()  # 失敗した場合のみ
        run: ./notify-failure.sh`}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Best Practices */}
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20 p-8 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg shadow-lg">
                  <Lightbulb className="w-6 h-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                  ベストプラクティス
                </h2>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-green-500/5 rounded-lg border-l-4 border-green-500 p-5 shadow-sm hover:shadow-md hover:bg-green-500/10 transition-all">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-green-400" />
                    高速なフィードバックループ
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    テストを早い段階で実行し、問題を素早く発見。軽量なテストから実行して早期に失敗させる。
                  </p>
                </div>
                <div className="bg-blue-500/5 rounded-lg border-l-4 border-blue-500 p-5 shadow-sm hover:shadow-md hover:bg-blue-500/10 transition-all">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-blue-400" />
                    並列実行の活用
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    独立したジョブは並列実行してビルド時間を短縮。マトリックス戦略で複数環境を同時テスト。
                  </p>
                </div>
                <div className="bg-purple-500/5 rounded-lg border-l-4 border-purple-500 p-5 shadow-sm hover:shadow-md hover:bg-purple-500/10 transition-all">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                    <Package className="w-5 h-5 text-purple-400" />
                    キャッシュの活用
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    依存関係をキャッシュして実行時間を削減。actions/cache
                    を使用してnode_modules等を保存。
                  </p>
                </div>
                <div className="bg-orange-500/5 rounded-lg border-l-4 border-orange-500 p-5 shadow-sm hover:shadow-md hover:bg-orange-500/10 transition-all">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-orange-400" />
                    シークレット管理
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    APIキーなどの機密情報は環境変数で管理。リポジトリシークレットやEnvironment
                    secretsを活用。
                  </p>
                </div>
                <div className="bg-cyan-500/5 rounded-lg border-l-4 border-cyan-500 p-5 shadow-sm hover:shadow-md hover:bg-cyan-500/10 transition-all">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                    <Target className="w-5 h-5 text-cyan-400" />
                    ジョブの粒度
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    ジョブは単一責任に。テスト、ビルド、デプロイは別々のジョブに分離して管理しやすく。
                  </p>
                </div>
                <div className="bg-pink-500/5 rounded-lg border-l-4 border-pink-500 p-5 shadow-sm hover:shadow-md hover:bg-pink-500/10 transition-all">
                  <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                    <RefreshCw className="w-5 h-5 text-pink-400" />
                    再利用可能なワークフロー
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    共通処理は再利用可能なワークフローやコンポジットアクションとして切り出す。
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="h-full flex flex-col">
            <div className="bg-gradient-to-r from-blue-500/5 to-purple-500/5 border-b p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <h2 className="text-lg font-semibold">ワークフローYAML</h2>
                  <div className="flex items-center gap-2 bg-card border rounded-lg p-1">
                    <button
                      onClick={() => setExecutionMode('simulation')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        executionMode === 'simulation'
                          ? 'bg-blue-500 text-white'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      シミュレーション
                    </button>
                    <button
                      onClick={() => setExecutionMode('real')}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        executionMode === 'real'
                          ? 'bg-green-500 text-white'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      実際に実行
                    </button>
                  </div>
                  {executionMode === 'real' && (
                    <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-500/10 px-3 py-1 rounded-lg border border-amber-500/30">
                      <span className="animate-pulse">⚡</span>
                      <span>実際のコマンドを実行します</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center space-x-2">
                  <select
                    value={selectedTemplate}
                    onChange={(e) => loadTemplateContent(e.target.value)}
                    className="bg-card border border-border rounded px-4 py-2 text-sm text-foreground hover:bg-accent transition-colors min-w-[300px] cursor-pointer"
                  >
                    <option value="">テンプレートを選択...</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} - {template.description}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={validateWorkflow}
                    disabled={isValidating || !yaml.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                  >
                    {isValidating ? '検証中...' : '検証'}
                  </button>
                  <button
                    onClick={runWorkflow}
                    disabled={isRunning || !yaml.trim()}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 text-sm flex items-center"
                  >
                    <Play className="w-4 h-4 mr-1" />
                    {isRunning ? '実行中...' : '実行'}
                  </button>
                </div>
              </div>

              {validationResult && (
                <div
                  className={`p-3 rounded text-sm border ${validationResult.valid ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-red-500/10 text-red-400 border-red-500/30'}`}
                >
                  {validationResult.valid ? (
                    <div>
                      <CheckCircle className="w-4 h-4 inline mr-2" />
                      ワークフローは有効です（ジョブ: {validationResult.workflow.jobCount}
                      、ステップ: {validationResult.workflow.stepCount}）
                    </div>
                  ) : (
                    <div>
                      <XCircle className="w-4 h-4 inline mr-2" />
                      <div className="mt-2">
                        {validationResult.errors.map((error: string, index: number) => (
                          <div key={index}>• {error}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex-1 p-4">
              <textarea
                value={yaml}
                onChange={(e) => setYaml(e.target.value)}
                className="w-full h-full font-mono text-sm bg-gray-900 text-gray-100 border border-gray-700 rounded p-4 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500"
                placeholder="ワークフローYAMLを入力..."
                spellCheck={false}
              />
            </div>
          </div>
        )}

        {activeTab === 'run' && (
          <div className="p-6">
            {isRunning && !currentRun && (
              <div className="max-w-2xl mx-auto text-center py-12">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <div className="flex gap-1">
                    <div
                      className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    ></div>
                    <div
                      className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    ></div>
                    <div
                      className="w-3 h-3 bg-blue-400 rounded-full animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    ></div>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  ワークフローを準備中...
                </h3>
                <p className="text-muted-foreground">
                  実行キューに追加されました。まもなく開始します。
                </p>
              </div>
            )}
            {currentRun ? (
              <div className="max-w-6xl mx-auto space-y-4">
                <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-xl font-bold">{currentRun.workflowName}</h2>
                        {currentRun.status === 'in_progress' && (
                          <div className="flex items-center gap-2">
                            <div className="flex gap-1">
                              <div
                                className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                                style={{ animationDelay: '0ms' }}
                              ></div>
                              <div
                                className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                                style={{ animationDelay: '150ms' }}
                              ></div>
                              <div
                                className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                                style={{ animationDelay: '300ms' }}
                              ></div>
                            </div>
                            <span className="text-sm text-blue-400 font-medium">実行中...</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        トリガー: {currentRun.trigger} • ブランチ: {currentRun.branch}
                      </p>
                    </div>
                    <div className="flex items-center space-x-4">
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(currentRun.status, currentRun.conclusion)}`}
                      >
                        {currentRun.status === 'in_progress'
                          ? '実行中'
                          : currentRun.status === 'completed'
                            ? '完了'
                            : currentRun.status}
                      </span>
                      {currentRun.duration && (
                        <span className="text-sm text-muted-foreground">
                          実行時間: {formatDuration(currentRun.duration)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {currentRun.jobs.map((job) => (
                  <div
                    key={job.id}
                    className="bg-card rounded-lg border hover:shadow-lg transition-all"
                  >
                    <button
                      onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                      className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          {getStatusIcon(job.status, job.conclusion)}
                          {job.status === 'in_progress' && (
                            <div className="absolute -inset-1 bg-blue-400 rounded-full opacity-25 animate-ping"></div>
                          )}
                        </div>
                        <div className="text-left">
                          <div className="font-semibold flex items-center gap-2">
                            {job.name}
                            {job.status === 'in_progress' && (
                              <span className="text-xs text-blue-400">処理中...</span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">Runner: {job.runner}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        {job.duration && (
                          <span className="text-sm text-muted-foreground">
                            {formatDuration(job.duration)}
                          </span>
                        )}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status, job.conclusion)}`}
                        >
                          {job.status}
                        </span>
                      </div>
                    </button>

                    {expandedJob === job.id && (
                      <div className="border-t">
                        {job.steps.map((step) => (
                          <div key={step.id} className="border-b last:border-b-0">
                            <button
                              onClick={() =>
                                setExpandedStep(expandedStep === step.id ? null : step.id)
                              }
                              className="w-full px-8 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                            >
                              <div className="flex items-center space-x-3">
                                <div className="relative">
                                  {getStatusIcon(step.status, step.conclusion)}
                                  {step.status === 'in_progress' && (
                                    <div className="absolute -inset-1 bg-blue-400 rounded-full opacity-25 animate-ping"></div>
                                  )}
                                </div>
                                <span className="font-medium text-sm flex items-center gap-2">
                                  {step.name}
                                  {step.status === 'in_progress' && (
                                    <span className="flex items-center gap-1">
                                      <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"></div>
                                      <div
                                        className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"
                                        style={{ animationDelay: '200ms' }}
                                      ></div>
                                      <div
                                        className="w-1 h-1 bg-blue-400 rounded-full animate-pulse"
                                        style={{ animationDelay: '400ms' }}
                                      ></div>
                                    </span>
                                  )}
                                </span>
                              </div>
                              {step.duration && (
                                <span className="text-sm text-muted-foreground">
                                  {formatDuration(step.duration)}
                                </span>
                              )}
                            </button>

                            {expandedStep === step.id && step.output.length > 0 && (
                              <div className="bg-gray-900 text-gray-100 px-8 py-4 font-mono text-xs overflow-x-auto relative border-t border-gray-700">
                                {step.status === 'in_progress' && (
                                  <div className="absolute top-2 right-2 flex items-center gap-2 bg-blue-500/20 px-2 py-1 rounded border border-blue-500/30">
                                    <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
                                    <span className="text-blue-300 text-xs">実行中</span>
                                  </div>
                                )}
                                {step.output.map((line, index) => (
                                  <div
                                    key={index}
                                    className={`whitespace-pre-wrap ${
                                      line.startsWith('$')
                                        ? 'text-green-400 font-semibold'
                                        : line.startsWith('Error') || line.includes('failed')
                                          ? 'text-red-400'
                                          : line.startsWith('✓')
                                            ? 'text-green-400'
                                            : line.startsWith('⚠️')
                                              ? 'text-yellow-400'
                                              : line.startsWith('🔧') || line.startsWith('📋')
                                                ? 'text-blue-400'
                                                : 'text-gray-300'
                                    }`}
                                  >
                                    {line}
                                  </div>
                                ))}
                                {step.status === 'in_progress' && (
                                  <div className="flex items-center gap-2 mt-2 text-blue-300">
                                    <div className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"></div>
                                    <div
                                      className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"
                                      style={{ animationDelay: '100ms' }}
                                    ></div>
                                    <div
                                      className="w-1 h-1 bg-blue-400 rounded-full animate-bounce"
                                      style={{ animationDelay: '200ms' }}
                                    ></div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="max-w-2xl mx-auto text-center py-12">
                <Settings className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  実行中のワークフローはありません
                </h3>
                <p className="text-gray-600">
                  「ワークフロー作成」タブでワークフローを実行してください
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="p-6">
            <div className="max-w-6xl mx-auto">
              {runs.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">実行履歴がありません</h3>
                  <p className="text-gray-600">
                    ワークフローを実行すると、ここに履歴が表示されます
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {runs.map((run) => (
                    <div
                      key={run.id}
                      className="bg-card rounded-lg border p-4 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3 flex-1">
                          {getStatusIcon(run.status, run.conclusion)}
                          <div>
                            <div className="font-semibold">{run.workflowName}</div>
                            <div className="text-sm text-gray-600">
                              {new Date(run.startTime).toLocaleString('ja-JP')} • {run.trigger} •{' '}
                              {run.branch}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          {run.duration && (
                            <span className="text-sm text-gray-600">
                              {formatDuration(run.duration)}
                            </span>
                          )}
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(run.status, run.conclusion)}`}
                          >
                            {run.conclusion || run.status}
                          </span>
                          <button
                            onClick={() => {
                              setCurrentRun(run);
                              setActiveTab('run');
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            詳細
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {activeTab === 'memo' && <NoteEditor pageId="cicd-pipeline" pageTitle="CI/CD Pipeline" />}
    </PageLayout>
  );
}
