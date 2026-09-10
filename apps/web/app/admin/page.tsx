import { SessionArea } from "../session-area";
import { CaixaSync } from "./caixa-sync";
import { ImportDraw } from "./import-draw";
import { AdminOverview } from "./admin-overview";
import { AdminShell } from "@atlas/ui";

export default function AdminPage() {
  return (
    <AdminShell>
      <p className="eyebrow">Administração</p>
      <h1>Painel operacional</h1>
      <SessionArea admin />
      <AdminOverview />
      <CaixaSync />
      <ImportDraw />
    </AdminShell>
  );
}
