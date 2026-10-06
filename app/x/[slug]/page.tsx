import { ArExperience } from "../ar-experience";

export default async function ExperienceSlugPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ArExperience key={slug} slug={slug} />;
}
