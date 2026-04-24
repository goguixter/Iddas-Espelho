import { SqliteImportForm } from "@/components/sqlite-import-form";

export default function ImportarBasePage() {
  return (
    <main className="flex min-h-full flex-col gap-6 overflow-auto py-4">
      <SqliteImportForm />
    </main>
  );
}
