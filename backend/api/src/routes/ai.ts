import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AIService } from '../services/ai';

const chatSchema = z.object({
  message: z.string(),
  context: z.object({
    currentPage: z.string().optional(),
    logs: z.array(z.string()).optional(),
    resources: z.any().optional(),
  }).optional(),
});

const aiService = new AIService();

export async function aiRoutes(fastify: FastifyInstance) {
  fastify.post('/chat', async (request, reply) => {
    const body = chatSchema.parse(request.body);
    
    const response = await aiService.chat(body.message, body.context);
    
    return { response };
  });
  
  fastify.post('/explain', async (request, reply) => {
    const { content, type } = request.body as { content: string; type: string };
    
    const explanation = await aiService.explain(content, type);
    
    return { explanation };
  });
}
