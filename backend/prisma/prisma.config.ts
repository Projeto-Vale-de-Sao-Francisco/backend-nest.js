import { definePrismaConfig } from "prisma/config";

export default definePrismaConfig({
  orm: {
    driver: "postgres",
    family: "postgresql",
    target: "node",
  },
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  db: {
    connection: "postgresql://vsf:vsf_123@localhost:5432/pi4?schema=public",
  },
});