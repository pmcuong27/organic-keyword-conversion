import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpSchema = path.join(root, "prisma", "schema.generate-tmp.prisma");
const tmpOut = path.join(root, "node_modules", ".prisma", "client-tmp");
const dest = path.join(root, "node_modules", ".prisma", "client");
const prismaCli = path.join(root, "node_modules", "prisma", "build", "index.js");

const schema = readFileSync(path.join(root, "prisma", "schema.prisma"), "utf8").replace(
  /generator client \{[\s\S]*?\}/,
  `generator client {
  provider = "prisma-client-js"
  output   = "../node_modules/.prisma/client-tmp"
}`,
);

writeFileSync(tmpSchema, schema);
mkdirSync(tmpOut, { recursive: true });

const generated = spawnSync(process.execPath, [prismaCli, "generate", `--schema=${tmpSchema}`], {
  cwd: root,
  encoding: "utf8",
  env: process.env,
  windowsHide: true,
});
if (generated.stdout) process.stdout.write(generated.stdout);
if (generated.stderr) process.stderr.write(generated.stderr);
if (generated.error) {
  console.error(generated.error);
  rmSync(tmpSchema, { force: true });
  process.exit(1);
}
if (generated.status !== 0) {
  rmSync(tmpSchema, { force: true });
  process.exit(generated.status ?? 1);
}

mkdirSync(dest, { recursive: true });
for (const name of readdirSync(tmpOut)) {
  if (name.startsWith("query_engine-") && name.endsWith(".node")) continue;
  const from = path.join(tmpOut, name);
  const to = path.join(dest, name);
  if (statSync(from).isDirectory()) {
    cpSync(from, to, { recursive: true, force: true });
  } else {
    cpSync(from, to, { force: true });
  }
}

if (!existsSync(path.join(dest, "query_engine-windows.dll.node"))) {
  const engine = readdirSync(tmpOut).find(
    (name) => name.startsWith("query_engine-") && name.endsWith(".node"),
  );
  if (engine) cpSync(path.join(tmpOut, engine), path.join(dest, engine), { force: true });
}

rmSync(tmpSchema, { force: true });
rmSync(tmpOut, { recursive: true, force: true });
console.log("Prisma client JS/schema updated without replacing the locked query engine");
