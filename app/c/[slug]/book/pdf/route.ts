import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getCourse, hasCourseAccess } from "@/lib/courses";
import { createAdminClient } from "@/lib/supabase/server";

// The owner-uploaded book PDF (if any). Only signed-in students with access to
// the course get a link, and the link itself expires after a few minutes.
export async function GET(request: NextRequest, ctx: RouteContext<"/c/[slug]/book/pdf">) {
  const { slug } = await ctx.params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/login", request.url));
  const course = await getCourse(slug);
  if (!course?.pdf_path || !(await hasCourseAccess(course.id))) {
    return new NextResponse("Not found", { status: 404 });
  }
  const { data, error } = await createAdminClient().storage.from("course-files").createSignedUrl(course.pdf_path, 300);
  if (error || !data) return new NextResponse("The file isn't available right now.", { status: 503 });
  return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
}
