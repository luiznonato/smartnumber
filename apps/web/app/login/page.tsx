import Link from "next/link";
import { AuthForm } from "../auth-form";

export default function LoginPage() {
  return (
    <>
      <p className="eyebrow">Área do assinante</p>
      <h1>Entrar</h1>
      <AuthForm />
      <p>
        Ainda não possui conta? <Link href="/cadastro">Cadastre-se</Link>.
      </p>
      <p>
        <Link href="/recuperar-senha">Esqueci minha senha</Link>
      </p>
    </>
  );
}
