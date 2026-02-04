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

export class Post {
  public readonly data: PostData

  constructor(data: PostData) {
    this.data = PostSchema.parse(data)
  }

  toJSON() {
    return this.data
  }

  toString() {
    const textPreview =
      this.data.text && this.data.text.length > 80
        ? `${this.data.text.slice(0, 80)}...`
        : this.data.text
    return (
      `<Post\n` +
      `  Text: ${textPreview}\n` +
      `  Posted: ${this.data.postedDate}\n` +
      `  Reactions: ${this.data.reactionsCount}\n` +
      `  Comments: ${this.data.commentsCount}>`
    )
  }
}
