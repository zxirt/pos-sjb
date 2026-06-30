import { Card, CardSection } from "@/components/ui/Card";

/** Halaman placeholder untuk fitur yang dibangun di fase berikutnya. */
export function PagePlaceholder({
  title,
  fase,
  desc,
}: {
  title: string;
  fase: string;
  desc: string;
}) {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-2xl font-bold">{title}</h1>
      <Card>
        <CardSection>
          <p className="text-ink-soft">{desc}</p>
          <p className="mt-3 inline-block rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
            Akan dibangun di {fase}
          </p>
        </CardSection>
      </Card>
    </div>
  );
}
