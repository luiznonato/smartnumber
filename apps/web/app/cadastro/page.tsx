import Link from "next/link";
import { AuthForm } from "../auth-form";

export default function RegisterPage() {
  return (
    <>
      <p className="eyebrow">Área do assinante</p>
      <h1>Criar conta</h1>
      <AuthForm register />
      <p>
        Já possui conta? <Link href="/login">Entre aqui</Link>.
      </p>
    </>
  );
}
