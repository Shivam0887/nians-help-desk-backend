import { generateText, Output, type LanguageModel } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { z } from 'zod';

const triageResultSchema = z.object({
  suggestedCategory: z.enum(['bug', 'feature', 'question', 'uncategorized']),
  suggestedPriority: z.enum(['low', 'medium', 'high', 'urgent']),
  confidence: z.number().min(0).max(1),
});

export interface TriageResult {
  suggestedCategory: string;
  suggestedPriority: string;
  confidence: number;
  applied: boolean;
}

const FALLBACK: TriageResult = {
  suggestedCategory: 'uncategorized',
  suggestedPriority: 'medium',
  confidence: 0,
  applied: false,
};

function getAiModel(): LanguageModel | null {
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (geminiKey) {
    const google = createGoogleGenerativeAI({ apiKey: geminiKey });
    const modelName = process.env.GEMINI_MODEL || process.env.AI_MODEL || 'gemini-1.5-flash';
    return google(modelName);
  }

  if (process.env.OPENAI_API_KEY) {
    const modelName = process.env.OPENAI_MODEL || process.env.AI_MODEL || 'gpt-4o-mini';
    return openai(modelName);
  }

  return null;
}

/**
 * Uses Vercel AI SDK generateText with Output.object to auto-suggest
 * category and priority using Gemini (or OpenAI fallback).
 * Falls back gracefully on any failure (no API key, timeout, parse error).
 */
export async function triageTicket(title: string, description: string): Promise<TriageResult> {
  const model = getAiModel();
  if (!model) {
    return FALLBACK;
  }

  try {
    const { output } = await generateText({
      model,
      output: Output.object({
        schema: triageResultSchema,
      }),
      prompt: `You are a support ticket triage assistant. Classify this ticket.\n\nTitle: ${title}\nDescription: ${description}`,
    });

    return { ...output, applied: false };
  } catch (error) {
    console.warn('AI triage failed, using defaults:', error instanceof Error ? error.message : error);
    return FALLBACK;
  }
}
