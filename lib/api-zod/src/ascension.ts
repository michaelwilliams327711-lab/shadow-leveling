import * as zod from "zod";

export const QuickLogBody = zod.object({
  type: zod.enum(["vice", "virtue"]),
  pair: zod.string().min(1).max(100),
});
export type QuickLogBodyType = zod.infer<typeof QuickLogBody>;
