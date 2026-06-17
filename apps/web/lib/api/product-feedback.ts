import { z } from "zod";
import { requestApi } from "./client";
import { requestCustomerApi } from "./customer-client";

export const productFeedbackSchema = z.object({
  questions: z.array(
    z.object({
      answer: z.string().nullable(),
      createdAt: z.string(),
      customerName: z.string(),
      id: z.string(),
      question: z.string(),
      status: z.string()
    })
  ),
  reviews: z.array(
    z.object({
      comment: z.string(),
      createdAt: z.string(),
      customerName: z.string(),
      id: z.string(),
      rating: z.number(),
      title: z.string().nullable()
    })
  )
});

export const createReviewInputSchema = z.object({
  comment: z.string().trim().min(5).max(1200),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(120).nullable().optional()
});

export const createQuestionInputSchema = z.object({
  question: z.string().trim().min(5).max(800)
});

export type ProductFeedback = z.infer<typeof productFeedbackSchema>;
export type CreateReviewInput = z.infer<typeof createReviewInputSchema>;
export type CreateQuestionInput = z.infer<typeof createQuestionInputSchema>;

export function getProductFeedback(slug: string) {
  return requestApi(
    `/products/${encodeURIComponent(slug)}/feedback`,
    productFeedbackSchema
  );
}

export function createProductReview(slug: string, input: CreateReviewInput) {
  const parsedInput = createReviewInputSchema.parse(input);

  return requestCustomerApi(
    `/products/${encodeURIComponent(slug)}/feedback/reviews`,
    productFeedbackSchema,
    {
      body: JSON.stringify(parsedInput),
      method: "POST"
    }
  );
}

export function createProductQuestion(
  slug: string,
  input: CreateQuestionInput
) {
  const parsedInput = createQuestionInputSchema.parse(input);

  return requestCustomerApi(
    `/products/${encodeURIComponent(slug)}/feedback/questions`,
    productFeedbackSchema,
    {
      body: JSON.stringify(parsedInput),
      method: "POST"
    }
  );
}
