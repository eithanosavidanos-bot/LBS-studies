import { notFound, redirect } from "next/navigation";
import { loadCourse } from "../course";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { chapters } = await loadCourse(slug);
  if (!chapters.length) notFound();
  redirect(`/c/${slug}/book/${chapters[0].n}`);
}
