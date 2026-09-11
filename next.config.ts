import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WASM build of Postgres and `pg` opens raw sockets; neither
  // survives being bundled, so both stay external on the server.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],

  // This project sits inside the home directory, which is itself a repo with
  // its own lockfile. Pin the root or Turbopack walks up and picks the wrong one.
  turbopack: {
    root: path.resolve("."),
  },
};

export default nextConfig;
