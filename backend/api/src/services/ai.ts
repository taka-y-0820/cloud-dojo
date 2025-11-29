import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';

export class AIService {
  private client: any; // Type workaround for Anthropic SDK

  constructor() {
    this.client = new Anthropic({
      apiKey: config.ai.apiKey,
    });
  }

  async chat(message: string, context?: any): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(context);

    try {
      const response = await this.client.messages.create({
        model: config.ai.model,
        max_tokens: config.ai.maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: message,
          },
        ],
      });

      const textContent = response.content.find((c: any) => c.type === 'text');
      return textContent && 'text' in textContent ? textContent.text : '';
    } catch (error) {
      console.error('AI API Error:', error);
      return 'AI service is currently unavailable. Please try again later.';
    }
  }

  async explain(content: string, type: string): Promise<string> {
    const prompts: Record<string, string> = {
      dockerfile: 'このDockerfileの各ステップを初心者にもわかりやすく説明してください。',
      k8s: 'このKubernetesマニフェストの各リソースと設定を説明してください。',
      log: 'このログの内容を分析し、何が起きているか説明してください。',
      error: 'このエラーの原因と解決方法を説明してください。',
    };

    const prompt = prompts[type] || '以下の内容を説明してください。';

    return this.chat(`${prompt}\n\n${content}`);
  }

  private buildSystemPrompt(context?: any): string {
    let prompt = `あなたはDevOps/インフラストラクチャーの学習を支援するAIアシスタントです。
Docker、Kubernetes、CI/CD、クラウドインフラなどの技術について、わかりやすく丁寧に説明してください。

- 技術的に正確な情報を提供する
- 初心者にもわかりやすい言葉で説明する
- 具体例やベストプラクティスを示す
- 関連する概念や技術も紹介する`;

    if (context?.currentPage) {
      prompt += `\n\n現在のページ: ${context.currentPage}`;
    }

    if (context?.logs && context.logs.length > 0) {
      prompt += `\n\n最新のログ:\n${context.logs.slice(-10).join('\n')}`;
    }

    return prompt;
  }
}
