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

const createReviewInputSchema = z.object({
  comment: z.string().trim().min(5).max(1200),
  rating: z.number().int().min(1).max(5)
});

const createQuestionInputSchema = z.object({
  question: z.string().trim().min(5).max(800)
});

export type ProductFeedback = z.infer<typeof productFeedbackSchema>;

export function getProductFeedback(slug: string) {
  return requestApi(
    `/products/${encodeURIComponent(slug)}/feedback`,
    productFeedbackSchema
  );
}

export function createProductReview(
  slug: string,
  input: z.input<typeof createReviewInputSchema>
) {
  return requestCustomerApi(
    `/products/${encodeURIComponent(slug)}/feedback/reviews`,
    productFeedbackSchema,
    {
      body: JSON.stringify(createReviewInputSchema.parse(input)),
      method: "POST"
    }
  );
}

export function createProductQuestion(
  slug: string,
  input: z.input<typeof createQuestionInputSchema>
) {
  return requestCustomerApi(
    `/products/${encodeURIComponent(slug)}/feedback/questions`,
    productFeedbackSchema,
    {
      body: JSON.stringify(createQuestionInputSchema.parse(input)),
      method: "POST"
    }
  );
}
