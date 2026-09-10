import { SessionArea } from "../session-area";
import { AppDashboard } from "./app-dashboard";

export default function SubscriberAppPage() {
  return (
    <>
      <p className="eyebrow">Área do assinante</p>
      <h1>Atlas Loto</h1>
      <SessionArea />
      <AppDashboard />
    </>
  );
}
