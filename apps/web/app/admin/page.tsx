import { SessionArea } from "../session-area";
import { CaixaSync } from "./caixa-sync";
import { ImportDraw } from "./import-draw";

export default function AdminPage() {
  return (
    <>
      <p className="eyebrow">Administração</p>
      <h1>Painel operacional</h1>
      <SessionArea admin />
      <CaixaSync />
      <ImportDraw />
    </>
  );
}
