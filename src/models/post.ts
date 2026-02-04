import { z } from 'zod'

export const PostSchema = z.object({
  linkedinUrl: z.string().optional(),
  urn: z.string().optional(),
  text: z.string().optional(),
  postedDate: z.string().optional(),
  reactionsCount: z.number().optional(),
  commentsCount: z.number().optional(),
  repostsCount: z.number().optional(),
  imageUrls: z.array(z.string()).default([]),
  videoUrl: z.string().optional(),
  articleUrl: z.string().optional(),
})

export type PostData = z.infer<typeof PostSchema>

/**
 * Factory function to create and validate a Post data object
 * @param data - Raw post data to validate
 * @returns Validated PostData object
 */
export function createPost(data: PostData): PostData {
  return PostSchema.parse(data)
}

/**
 * Convert PostData to a formatted string representation
 * @param post - PostData object
 * @returns Formatted string with post details
 */
export function postToString(post: PostData): string {
  const textPreview =
    post.text && post.text.length > 80
      ? `${post.text.slice(0, 80)}...`
      : post.text
  return (
    `<Post\n` +
    `  Text: ${textPreview}\n` +
    `  Posted: ${post.postedDate}\n` +
    `  Reactions: ${post.reactionsCount}\n` +
    `  Comments: ${post.commentsCount}>`
  )
}

