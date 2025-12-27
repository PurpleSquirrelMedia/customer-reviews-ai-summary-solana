import { unstable_cache } from "next/cache";
import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { Product } from "./types";

// Support multiple AI providers - Perplexity, Together AI, or OpenAI
const apiKey = process.env.PERPLEXITY_API_KEY || process.env.TOGETHER_API_KEY || process.env.OPENAI_API_KEY;
const baseURL = process.env.PERPLEXITY_API_KEY
  ? "https://api.perplexity.ai"
  : process.env.TOGETHER_API_KEY
    ? "https://api.together.xyz/v1"
    : undefined;

if (!apiKey) {
  throw new Error(
    "API key required. Set PERPLEXITY_API_KEY, TOGETHER_API_KEY, or OPENAI_API_KEY"
  );
}

// Create OpenAI-compatible provider (works with Perplexity, Together, OpenAI)
const openai = createOpenAI({
  apiKey: apiKey,
  baseURL: baseURL,
});

// Use appropriate model based on provider
const modelId = process.env.PERPLEXITY_API_KEY
  ? "pplx-7b-chat"
  : process.env.TOGETHER_API_KEY
    ? "mistralai/Mistral-7B-Instruct-v0.2"
    : "gpt-4o-mini";

export async function summarizeReviews(product: Product) {
  const averageRating =
    product.reviews.reduce((acc, review) => acc + review.stars, 0) /
    product.reviews.length;

  const prompt = `Write a summary of the reviews for the ${
    product.name
  } product. The product's average rating is ${averageRating} out of 5 stars.
Your goal is to highlight the most common themes and sentiments expressed by customers.
If multiple themes are present, try to capture the most important ones.
If no patterns emerge but there is a shared sentiment, capture that instead.
Try to use natural language and keep the summary concise.
Use a maximum of 4 sentences and 30 words.
Don't include any word count or character count.
No need to reference which reviews you're summarizing.
Do not reference the star rating in the summary.

Start the summary with "Customers like…" or "Customers mention…"

Here are 3 examples of a good summarie:
Example 1: Customers like the quality, space, fit and value of the sport equipment bag case. They mention it's heavy duty, has lots of space and pockets, and can fit all their gear. They also appreciate the portability and appearance. That said, some disagree on the zipper.
Example 2: Customers like the quality, ease of installation, and value of the transport rack. They mention that it holds on to everything really well, and is reliable. Some complain about the wind noise, saying it makes a whistling noise at high speeds. Opinions are mixed on fit, and performance.
Example 3: Customers like the quality and value of the body deodorant. They say it works great and provides freshness for a long time after application. Some customers have different opinions on smell and durability.

Hit the following tone based on rating:
- 1-2 stars: negative
- 3 stars: neutral
- 4-5 stars: positive

The customer reviews to summarize are as follows:
${product.reviews
  .map((review, i) => `Review ${i + 1}:\n${review.review}`)
  .join("\n\n")}`;

  const cacheKey = [
    modelId,
    prompt.substring(0, 100),
    "2.0",
    process.env.VERCEL_BRANCH_URL || "",
    process.env.NODE_ENV || "",
  ];

  return unstable_cache(async () => {
    const { text } = await generateText({
      model: openai(modelId),
      prompt: prompt,
      maxTokens: 1000,
      temperature: 0.75,
    });

    // Remove the quotes from the response that the LLM sometimes adds.
    return text
      .trim()
      .replace(/^"/, "")
      .replace(/"$/, "")
      .replace(/[\[\(]\d+ words[\]\)]/g, "");
  }, cacheKey)();
}
