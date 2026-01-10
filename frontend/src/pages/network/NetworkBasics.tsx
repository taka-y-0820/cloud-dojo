import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network,
  Wifi,
  Play,
  Trash2,
  Terminal,
  RefreshCw,
  Copy,
  Book,
  Zap,
  ArrowRight,
  CheckCircle,
  XCircle,
  Loader,
  BookOpen,
  FlaskConical,
  NotebookPen,
} from 'lucide-react';
import { PageLayout } from '@/layouts/PageLayout';
import { API_BASE_URL } from '@/config/constants';
import { PageHeader } from '@/layouts/PageHeader';
import { Tabs } from '@/components/ui/tabs/Tabs';
import { TabItem } from '@/components/ui/tabs/types';
import { NoteEditor } from '@/components/ui/notes/NoteEditor';

interface NetworkNode {
  id: string;
  name: string;
  status: string;
  ipAddress: string | null;
  nodeId: string;
}

interface TerminalSession {
  nodeId: string;
  nodeName: string;
  output: string;
  history: string[];
  historyIndex: number;
}

interface ConnectionTest {
  from: string;
  to: string;
  status: 'success' | 'failed' | 'testing';
  latency?: number;
}

interface CheatSheetCommand {
  cmd: string;
  description: string;
}

interface CheatSheetCategory {
  name: string;
  commands: CheatSheetCommand[];
}

type NetworkTab = 'learn' | 'lab' | 'memo';

export function NetworkBasics() {
  const [activeTab, setActiveTab] = useState<NetworkTab>('learn');
  const [nodes, setNodes] = useState<NetworkNode[]>([]);
  const [sessions, setSessions] = useState<Map<string, TerminalSession>>(new Map());
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [command, setCommand] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [nodeCount, setNodeCount] = useState(3);
  const [cheatSheet, setCheatSheet] = useState<CheatSheetCategory[]>([]);
  const [showCheatSheet, setShowCheatSheet] = useState(false);
  const [connectionTests, setConnectionTests] = useState<ConnectionTest[]>([]);
  const [testingConnections, setTestingConnections] = useState(false);
  const outputRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  useEffect(() => {
    fetchLabStatus();
    fetchCheatSheet();
  }, []);

  useEffect(() => {
    // 新しいノードが追加されたらセッションを作成
    nodes.forEach((node) => {
      if (!sessions.has(node.id)) {
        setSessions((prev) => {
          const newSessions = new Map(prev);
          newSessions.set(node.id, {
            nodeId: node.id,
            nodeName: node.name,
            output: `Welcome to ${node.name} (${node.ipAddress})\n\n`,
            history: [],
            historyIndex: -1,
          });
          return newSessions;
        });
      }
    });

    // 最初のノードを自動選択
    if (nodes.length > 0 && !activeSession) {
      setActiveSession(nodes[0].id);
    }
  }, [nodes]);

  const fetchLabStatus = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/network/lab/status`);
      const data = await response.json();
      setNodes(data.containers || []);
    } catch (error) {
      console.error('Failed to fetch lab status:', error);
    }
  };

  const fetchCheatSheet = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/network/cheatsheet`);
      const data = await response.json();
      setCheatSheet(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch cheatsheet:', error);
    }
  };

  const createLab = async () => {
    setCreating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/network/lab/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeCount }),
      });

      if (response.ok) {
        await fetchLabStatus();
        addOutputToSession(
          null,
          '✅ ネットワークラボ環境を作成しました！\n各ノードにネットワークツールがインストールされています。\n'
        );
      } else {
        const error = await response.json();
        addOutputToSession(null, `❌ エラー: ${error.message}\n`);
      }
    } catch (error) {
      addOutputToSession(
        null,
        `❌ エラー: ${error instanceof Error ? error.message : '不明なエラー'}\n`
      );
    } finally {
      setCreating(false);
    }
  };

  const cleanupLab = async () => {
    if (!confirm('ネットワークラボ環境を削除しますか？')) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/network/lab/cleanup`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setNodes([]);
        setSessions(new Map());
        setActiveSession(null);
        setConnectionTests([]);
      }
    } catch (error) {
      console.error('Failed to cleanup lab:', error);
    } finally {
      setLoading(false);
    }
  };

  const executeCommand = async (nodeId: string, cmd: string) => {
    if (!cmd.trim()) return;

    setLoading(true);
    addOutputToSession(nodeId, `$ ${cmd}\n`);

    // コマンド履歴に追加
    setSessions((prev) => {
      const newSessions = new Map(prev);
      const session = newSessions.get(nodeId);
      if (session) {
        session.history.push(cmd);
        session.historyIndex = session.history.length;
      }
      return newSessions;
    });

    try {
      const response = await fetch(`${API_BASE_URL}/api/network/exec`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          containerId: nodeId,
          command: cmd.trim(),
        }),
      });

      const data = await response.json();

      if (response.ok) {
        addOutputToSession(nodeId, `${data.output || '(出力なし)'}\n\n`);
      } else {
        addOutputToSession(nodeId, `❌ エラー: ${data.message || '不明なエラー'}\n\n`);
      }
    } catch (error) {
      addOutputToSession(
        nodeId,
        `❌ エラー: ${error instanceof Error ? error.message : '不明なエラー'}\n\n`
      );
    } finally {
      setLoading(false);
    }
  };

  const addOutputToSession = (nodeId: string | null, output: string) => {
    const targetNodeId = nodeId || activeSession;
    if (!targetNodeId) return;

    setSessions((prev) => {
      const newSessions = new Map(prev);
      const session = newSessions.get(targetNodeId);
      if (session) {
        session.output += output;
      }
      return newSessions;
    });

    // 自動スクロール
    setTimeout(() => {
      const outputElement = outputRefs.current.get(targetNodeId);
      if (outputElement) {
        outputElement.scrollTop = outputElement.scrollHeight;
      }
    }, 50);
  };

  const testConnections = async () => {
    setTestingConnections(true);
    const tests: ConnectionTest[] = [];

    for (let i = 0; i < nodes.length; i++) {
      for (let j = 0; j < nodes.length; j++) {
        if (i !== j) {
          const from = nodes[i];
          const to = nodes[j];

          tests.push({
            from: from.name,
            to: to.name,
            status: 'testing',
          });
          setConnectionTests([...tests]);

          try {
            const start = Date.now();
            const response = await fetch(`${API_BASE_URL}/api/network/exec`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                containerId: from.id,
                command: `ping -c 1 -W 2 ${to.ipAddress}`,
              }),
            });

            const data = await response.json();
            const latency = Date.now() - start;

            const testIndex = tests.findIndex((t) => t.from === from.name && t.to === to.name);
            tests[testIndex] = {
              from: from.name,
              to: to.name,
              status:
                response.ok && !data.output?.includes('100% packet loss') ? 'success' : 'failed',
              latency: response.ok ? latency : undefined,
            };
          } catch (error) {
            const testIndex = tests.findIndex((t) => t.from === from.name && t.to === to.name);
            tests[testIndex] = {
              from: from.name,
              to: to.name,
              status: 'failed',
            };
          }

          setConnectionTests([...tests]);
        }
      }
    }

    setTestingConnections(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!activeSession) return;

    const session = sessions.get(activeSession);
    if (!session) return;

    if (e.key === 'Enter') {
      executeCommand(activeSession, command);
      setCommand('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (session.historyIndex > 0) {
        const newIndex = session.historyIndex - 1;
        setSessions((prev) => {
          const newSessions = new Map(prev);
          const s = newSessions.get(activeSession);
          if (s) s.historyIndex = newIndex;
          return newSessions;
        });
        setCommand(session.history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (session.historyIndex < session.history.length - 1) {
        const newIndex = session.historyIndex + 1;
        setSessions((prev) => {
          const newSessions = new Map(prev);
          const s = newSessions.get(activeSession);
          if (s) s.historyIndex = newIndex;
          return newSessions;
        });
        setCommand(session.history[newIndex]);
      } else {
        setSessions((prev) => {
          const newSessions = new Map(prev);
          const s = newSessions.get(activeSession);
          if (s) s.historyIndex = session.history.length;
          return newSessions;
        });
        setCommand('');
      }
    }
  };

  const clearSession = (nodeId: string) => {
    setSessions((prev) => {
      const newSessions = new Map(prev);
      const session = newSessions.get(nodeId);
      if (session) {
        const node = nodes.find((n) => n.id === nodeId);
        session.output = `Welcome to ${node?.name} (${node?.ipAddress})\n\n`;
      }
      return newSessions;
    });
  };

  const renderTerminal = (nodeId: string, isActive: boolean = true) => {
    const session = sessions.get(nodeId);
    const node = nodes.find((n) => n.id === nodeId);
    if (!session || !node) return null;

    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 bg-muted/50 border-b">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4" />
            <span className="font-medium text-sm">{node.name}</span>
            <span className="text-xs text-muted-foreground">({node.ipAddress})</span>
          </div>
          <button
            onClick={() => clearSession(nodeId)}
            className="p-1 hover:bg-muted rounded transition-colors"
            title="クリア"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        <div
          ref={(el) => {
            if (el) outputRefs.current.set(nodeId, el);
          }}
          className="flex-1 bg-gray-900 p-4 overflow-auto font-mono text-sm"
        >
          <pre className="text-green-400 whitespace-pre-wrap">{session.output}</pre>
        </div>

        {isActive && (
          <div className="p-3 border-t bg-muted/30">
            <div className="flex gap-2">
              <span className="text-green-400 font-mono">$</span>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="コマンドを入力..."
                className="flex-1 bg-transparent outline-none font-mono text-sm"
                disabled={loading}
                autoFocus
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const tabs: TabItem<NetworkTab>[] = [
    {
      key: 'learn',
      label: '学習',
      icon: BookOpen,
    },
    {
      key: 'lab',
      label: '実践ラボ',
      icon: FlaskConical,
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
        title="ネットワーク基礎"
        description="実践的なネットワークコマンドを学ぶためのラボ環境です。"
        Icon={Wifi}
        bgColor="bg-gradient-to-br from-cyan-500 to-blue-500"
      />

      <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

      {activeTab === 'learn' && (
        <div className="mx-auto space-y-8">
          {/* ネットワーク基礎概要 */}
          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl border border-blue-500/20 p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg shadow-lg">
                <Network className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                ネットワークとは？
              </h2>
            </div>
            <div className="prose max-w-none">
              <p className="text-muted-foreground mb-6 text-lg leading-relaxed">
                ネットワークは、複数のコンピューターやデバイスが相互に通信するための仕組みです。
                インターネット、社内LAN、クラウドインフラなど、現代のIT基盤はすべてネットワーク技術の上に成り立っています。
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/20 hover:border-blue-500/40 transition-colors">
                  <h3 className="font-bold text-blue-400 mb-2">物理層</h3>
                  <p className="text-sm text-muted-foreground">
                    ケーブル、無線、光ファイバーなどの物理的な接続
                  </p>
                </div>
                <div className="bg-cyan-500/5 rounded-lg p-4 border border-cyan-500/20 hover:border-cyan-500/40 transition-colors">
                  <h3 className="font-bold text-cyan-400 mb-2">論理層</h3>
                  <p className="text-sm text-muted-foreground">
                    IPアドレス、ルーティング、プロトコルなどの論理的な仕組み
                  </p>
                </div>
                <div className="bg-teal-500/5 rounded-lg p-4 border border-teal-500/20 hover:border-teal-500/40 transition-colors">
                  <h3 className="font-bold text-teal-400 mb-2">アプリケーション層</h3>
                  <p className="text-sm text-muted-foreground">
                    HTTP、DNS、SSH などのアプリケーションプロトコル
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* OSI参照モデル */}
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20 p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg shadow-lg">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                OSI参照モデル
              </h2>
            </div>
            <div className="space-y-3">
              {[
                {
                  layer: 7,
                  name: 'アプリケーション層',
                  desc: 'HTTP, FTP, DNS, SMTP',
                  color: 'purple',
                },
                {
                  layer: 6,
                  name: 'プレゼンテーション層',
                  desc: 'データ形式の変換、暗号化',
                  color: 'purple',
                },
                {
                  layer: 5,
                  name: 'セッション層',
                  desc: 'セッション管理、接続の確立',
                  color: 'blue',
                },
                {
                  layer: 4,
                  name: 'トランスポート層',
                  desc: 'TCP, UDP - データの信頼性制御',
                  color: 'blue',
                },
                {
                  layer: 3,
                  name: 'ネットワーク層',
                  desc: 'IP, ルーティング - 経路制御',
                  color: 'green',
                },
                {
                  layer: 2,
                  name: 'データリンク層',
                  desc: 'Ethernet, MAC - フレーム転送',
                  color: 'green',
                },
                { layer: 1, name: '物理層', desc: 'ケーブル、信号、ビット列', color: 'gray' },
              ].map((item) => (
                <div
                  key={item.layer}
                  className={`flex items-center gap-4 p-4 bg-${item.color}-500/5 border border-${item.color}-500/20 rounded-lg hover:border-${item.color}-500/40 transition-colors`}
                >
                  <div
                    className={`flex items-center justify-center w-12 h-12 bg-${item.color}-500/20 rounded-lg font-bold text-${item.color}-500`}
                  >
                    L{item.layer}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-foreground">{item.name}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* TCP/IP基礎 */}
          <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-xl border border-green-500/20 p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg shadow-lg">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                TCP/IP プロトコル
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-bold text-foreground mb-3 text-lg">IPアドレス</h3>
                <div className="space-y-3">
                  <div className="bg-green-500/5 rounded-lg p-4 border border-green-500/20">
                    <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">IPv4</h4>
                    <code className="text-sm font-mono">192.168.1.100</code>
                    <p className="text-xs text-muted-foreground mt-2">
                      32ビット（4オクテット）で約43億のアドレス
                    </p>
                  </div>
                  <div className="bg-green-500/5 rounded-lg p-4 border border-green-500/20">
                    <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">IPv6</h4>
                    <code className="text-sm font-mono">2001:0db8::1</code>
                    <p className="text-xs text-muted-foreground mt-2">
                      128ビットで事実上無限のアドレス空間
                    </p>
                  </div>
                  <div className="bg-green-500/5 rounded-lg p-4 border border-green-500/20">
                    <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2">
                      サブネットマスク
                    </h4>
                    <code className="text-sm font-mono">255.255.255.0 (/24)</code>
                    <p className="text-xs text-muted-foreground mt-2">
                      ネットワーク部とホスト部を区別
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-bold text-foreground mb-3 text-lg">プロトコル</h3>
                <div className="space-y-3">
                  <div className="bg-blue-500/5 rounded-lg p-4 border border-blue-500/20">
                    <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2">TCP</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>✓ 接続指向（3ウェイハンドシェイク）</li>
                      <li>✓ 信頼性が高い（再送制御）</li>
                      <li>✓ 順序保証</li>
                      <li>• HTTP, SSH, FTP で使用</li>
                    </ul>
                  </div>
                  <div className="bg-purple-500/5 rounded-lg p-4 border border-purple-500/20">
                    <h4 className="font-semibold text-purple-600 dark:text-purple-400 mb-2">UDP</h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>✓ コネクションレス</li>
                      <li>✓ 高速・低遅延</li>
                      <li>✗ 信頼性保証なし</li>
                      <li>• DNS, 動画配信で使用</li>
                    </ul>
                  </div>
                  <div className="bg-orange-500/5 rounded-lg p-4 border border-orange-500/20">
                    <h4 className="font-semibold text-orange-600 dark:text-orange-400 mb-2">
                      ICMP
                    </h4>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>✓ エラー通知</li>
                      <li>✓ 診断用（ping, traceroute）</li>
                      <li>• ネットワーク到達性確認</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 重要なネットワークコマンド */}
          <div className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 rounded-xl border border-orange-500/20 p-8 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-amber-500 rounded-lg shadow-lg">
                <Terminal className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent">
                重要なLinuxネットワークコマンド
              </h2>
            </div>
            <div className="space-y-6">
              <div>
                <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                  <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded">基本</span>
                  ネットワーク情報の確認
                </h3>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto border border-gray-700">
                  <pre className="text-sm text-gray-100">
                    <code>{`# IPアドレスとインターフェース確認
ip addr show

# 特定インターフェースの確認
ip addr show eth0

# インターフェースの状態
ip link show

# ルーティングテーブル表示
ip route show

# デフォルトゲートウェイ確認
ip route | grep default`}</code>
                  </pre>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                  <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded">診断</span>
                  接続の確認
                </h3>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto border border-gray-700">
                  <pre className="text-sm text-gray-100">
                    <code>{`# 疎通確認（ICMP Echo）
ping -c 4 192.168.1.1

# 経路追跡
traceroute google.com

# DNS名前解決
nslookup google.com
dig google.com

# ポートスキャン（接続確認）
nc -zv 192.168.1.1 80`}</code>
                  </pre>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                  <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded">詳細</span>
                  パケット解析
                </h3>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto border border-gray-700">
                  <pre className="text-sm text-gray-100">
                    <code>{`# パケットキャプチャ（10パケット）
tcpdump -i any -c 10

# ICMPパケットのみキャプチャ
tcpdump -i any icmp

# ポート80の通信をキャプチャ
tcpdump -i any port 80

# 詳細表示（-vv）とASCII出力（-A）
tcpdump -i any -vv -A port 80`}</code>
                  </pre>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
                  <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded">状態</span>
                  接続とポートの確認
                </h3>
                <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto border border-gray-700">
                  <pre className="text-sm text-gray-100">
                    <code>{`# リスニングポート一覧
netstat -tuln
ss -tuln

# 確立された接続
netstat -tun
ss -tun

# プロセスとポートの対応
netstat -tulnp
ss -tulnp`}</code>
                  </pre>
                </div>
              </div>
            </div>
          </div>

          {/* 実践への誘導 */}
          <div className="bg-gradient-to-br from-indigo-500/10 to-violet-500/10 rounded-xl border border-indigo-500/20 p-8 text-center">
            <FlaskConical className="w-16 h-16 mx-auto mb-4 text-indigo-500" />
            <h3 className="text-xl font-bold mb-2">実践で学ぼう！</h3>
            <p className="text-muted-foreground mb-6">
              「実践ラボ」タブで実際にコマンドを実行して、ネットワークの動作を体験できます。
            </p>
            <button
              onClick={() => setActiveTab('lab')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-violet-600 text-white rounded-lg hover:shadow-lg transition-all"
            >
              <FlaskConical className="w-5 h-5" />
              実践ラボへ
            </button>
          </div>
        </div>
      )}

      {activeTab === 'lab' && (
        <div className="space-y-6">
          {/* コントロールパネル */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border rounded-xl p-6"
          >
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">ノード数:</label>
                <input
                  type="number"
                  min="2"
                  max="10"
                  value={nodeCount}
                  onChange={(e) => setNodeCount(parseInt(e.target.value))}
                  className="w-20 px-3 py-2 border rounded-lg bg-background"
                  disabled={nodes.length > 0}
                />
              </div>

              {nodes.length === 0 ? (
                <button
                  onClick={createLab}
                  disabled={creating}
                  className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  {creating ? '作成中...' : 'ラボ環境を作成'}
                </button>
              ) : (
                <>
                  <button
                    onClick={fetchLabStatus}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    更新
                  </button>
                  <button
                    onClick={cleanupLab}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    削除
                  </button>
                  <button
                    onClick={testConnections}
                    disabled={testingConnections}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 text-purple-500 rounded-lg hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                  >
                    {testingConnections ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <Network className="w-4 h-4" />
                    )}
                    接続テスト
                  </button>
                  <button
                    onClick={() => setShowCheatSheet(!showCheatSheet)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors"
                  >
                    <Book className="w-4 h-4" />
                    コマンド一覧
                  </button>
                  <div className="ml-auto text-sm text-muted-foreground">
                    {nodes.length} ノードが実行中
                  </div>
                </>
              )}
            </div>
          </motion.div>

          {/* 接続テスト結果 */}
          {connectionTests.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="bg-card border rounded-xl p-6"
            >
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Network className="w-5 h-5" />
                接続テスト結果
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {connectionTests.map((test, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex-1 flex items-center gap-2 text-sm">
                      <span className="font-medium">{test.from}</span>
                      <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{test.to}</span>
                    </div>
                    {test.status === 'testing' ? (
                      <Loader className="w-4 h-4 animate-spin text-blue-500" />
                    ) : test.status === 'success' ? (
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        {test.latency && (
                          <span className="text-xs text-muted-foreground">{test.latency}ms</span>
                        )}
                      </div>
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* チートシート */}
          <AnimatePresence>
            {showCheatSheet && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-card border rounded-xl p-6 overflow-hidden"
              >
                <h3 className="text-lg font-semibold mb-4">よく使うネットワークコマンド</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {cheatSheet.map((category) => (
                    <div key={category.name} className="space-y-2">
                      <h4 className="font-medium text-blue-500">{category.name}</h4>
                      {category.commands.map((cmd, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer group"
                          onClick={() => setCommand(cmd.cmd)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <code className="text-sm font-mono text-green-600 dark:text-green-400">
                              {cmd.cmd}
                            </code>
                            <Copy className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{cmd.description}</p>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ターミナルエリア */}
          {nodes.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-card border rounded-xl p-12 text-center"
            >
              <Network className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-xl font-semibold mb-2">ラボ環境がありません</h3>
              <p className="text-muted-foreground mb-6">
                ネットワークラボを作成して、実践的なネットワークコマンドを学びましょう
              </p>
            </motion.div>
          ) : (
            // タブモード
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-card border rounded-xl overflow-hidden"
            >
              {/* タブヘッダー */}
              <div className="flex border-b overflow-x-auto">
                {nodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => setActiveSession(node.id)}
                    className={`flex items-center gap-2 px-4 py-3 border-r transition-colors whitespace-nowrap ${
                      activeSession === node.id
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <Terminal className="w-4 h-4" />
                    <span className="font-medium text-sm">{node.name}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        node.status === 'running'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-gray-500/20 text-gray-500'
                      }`}
                    >
                      {node.status}
                    </span>
                  </button>
                ))}
              </div>

              {/* ターミナル本体 */}
              <div className="h-[600px]">
                {activeSession && renderTerminal(activeSession, true)}
              </div>

              {/* クイックコマンド */}
              <div className="p-4 border-t bg-muted/30">
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setCommand('ip addr show')}
                    className="px-3 py-1.5 text-xs bg-blue-500/10 text-blue-500 rounded hover:bg-blue-500/20 transition-colors"
                  >
                    IP確認
                  </button>
                  {nodes
                    .filter((n) => n.id !== activeSession)
                    .map((node) => (
                      <button
                        key={node.id}
                        onClick={() => setCommand(`ping -c 4 ${node.ipAddress}`)}
                        className="px-3 py-1.5 text-xs bg-green-500/10 text-green-500 rounded hover:bg-green-500/20 transition-colors"
                      >
                        {node.name}にPing
                      </button>
                    ))}
                  <button
                    onClick={() => setCommand('ip route show')}
                    className="px-3 py-1.5 text-xs bg-purple-500/10 text-purple-500 rounded hover:bg-purple-500/20 transition-colors"
                  >
                    ルート確認
                  </button>
                  <button
                    onClick={() => setCommand('netstat -tuln')}
                    className="px-3 py-1.5 text-xs bg-orange-500/10 text-orange-500 rounded hover:bg-orange-500/20 transition-colors"
                  >
                    ポート一覧
                  </button>
                  <button
                    onClick={() => setCommand('traceroute 8.8.8.8')}
                    className="px-3 py-1.5 text-xs bg-pink-500/10 text-pink-500 rounded hover:bg-pink-500/20 transition-colors"
                  >
                    Traceroute
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      )}

      {activeTab === 'memo' && <NoteEditor pageId="network-basics" pageTitle="Network Basics" />}
    </PageLayout>
  );
}
