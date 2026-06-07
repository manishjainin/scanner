/**
 * Central OpenAI model configuration.
 * Override with the OPENAI_MODEL env var; defaults to GPT-5.
 *
 * Note: GPT-5 (and other reasoning models) on the Chat Completions API require
 * `max_completion_tokens` instead of `max_tokens`, and accept `reasoning_effort`.
 * For our short structured-output calls we use "minimal" effort so reasoning
 * tokens don't consume the output budget.
 */
export const OPENAI_MODEL = process.env.OPENAI_MODEL?.trim() || "gpt-5";

export const OPENAI_REASONING_EFFORT = "minimal";
