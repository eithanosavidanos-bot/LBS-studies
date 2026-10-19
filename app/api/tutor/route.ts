import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";
import { getChapters, getCourse, hasCourseAccess, listCourses } from "@/lib/courses";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/server";
import { tutorContextNote, tutorSystemPrompt, validateMessages } from "@/lib/tutor";
import type { Course } from "@/lib/types";

export const maxDuration = 120;

// Models that accept the server-side refusal fallback in its "default" form.
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

function fail(status: number, error: string) {
  return Response.json({ error }, { status });
}

async function resolveCourse(slug: unknown): Promise<Course | null> {
  if (typeof slug === "string" && slug) {
    const course = await getCourse(slug);
    return course && (await hasCourseAccess(course.id)) ? course : null;
  }
  // Not inside a course page (home, admin): use the first course they can open.
  for (const course of await listCourses()) if (await hasCourseAccess(course.id)) return course;
  return null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.profile) return fail(401, "Sign in to use the tutor.");

  let body: { course?: unknown; chapter?: unknown; messages?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Bad request.");
  }

  const course = await resolveCourse(body.course);
  if (!course) return fail(403, "You don't have access to this course.");

  const checked = validateMessages(body.messages, env.tutorMaxMessages(), env.tutorMaxChars());
  if (!checked.ok) return fail(checked.status, checked.error);

  const allowed = await createAdminClient().rpc("tutor_take_slot", {
    p_user_id: session.user.id,
    p_course_id: course.id,
    p_limit: env.tutorMessagesPerHour(),
  });
  if (allowed.error) return fail(500, "The tutor isn't available right now. Try again in a moment.");
  if (allowed.data !== true) {
    return fail(429, `You've reached the limit of ${env.tutorMessagesPerHour()} tutor messages per hour. Take a break and try again later.`);
  }

  const chapters = await getChapters(course.id);
  const chapter = chapters.find((c) => c.n === body.chapter);
  const model = env.tutorModel();
  const client = new Anthropic({ apiKey: env.anthropicApiKey(), baseURL: env.anthropicBaseUrl() });

  const stream = client.beta.messages.stream({
    model,
    max_tokens: 8000,
    output_config: { effort: "low" },
    ...(FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    system: [
      // Same for every request in this course: cached.
      { type: "text", text: tutorSystemPrompt(course, chapters), cache_control: { type: "ephemeral" } },
      { type: "text", text: tutorContextNote(chapter) },
    ],
    messages: checked.messages,
  });

  const encoder = new TextEncoder();
  const output = new ReadableStream<Uint8Array>({
    async start(controller) {
      let wrote = false;
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            controller.enqueue(encoder.encode(event.delta.text));
            wrote = true;
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(encoder.encode(`${wrote ? "\n\n" : ""}Sorry, I can't help with that one. Try asking about the course material.`));
        } else if (final.stop_reason === "max_tokens") {
          controller.enqueue(encoder.encode("\n\n(Answer cut short. Ask me to continue.)"));
        }
      } catch (err) {
        const message =
          err instanceof Anthropic.RateLimitError || err instanceof Anthropic.InternalServerError
            ? "The tutor is busy right now. Wait a minute, then ask again."
            : "Something went wrong getting an answer. Try again.";
        console.error("tutor stream failed", err);
        controller.enqueue(encoder.encode(`${wrote ? "\n\n" : ""}${message}`));
      } finally {
        controller.close();
      }
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(output, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
