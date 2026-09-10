import { PrismaClient, Role } from "@prisma/client";
import { hashPassword } from "../src/auth.js";

const prisma = new PrismaClient();
const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.log(
    "Seed não executado: configure ADMIN_EMAIL e ADMIN_PASSWORD. Nenhum dado fictício foi criado.",
  );
} else {
  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { email },
    update: { passwordHash, role: Role.ADMIN },
    create: { email, passwordHash, role: Role.ADMIN, preferences: { create: {} } },
  });
  console.log(`Administrador ${email} criado/atualizado.`);
}

await prisma.$disconnect();