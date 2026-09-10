import { AuthForm } from "../../auth-form";

export default function AdminLoginPage() {
  return (
    <>
      <p className="eyebrow">Administração</p>
      <h1>Login administrativo</h1>
      <AuthForm admin />
    </>
  );
}
