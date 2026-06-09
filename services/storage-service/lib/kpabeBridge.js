import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_SERVICE_ROOT = path.resolve(__dirname, "..");
const SCRIPT_PATH = path.join(STORAGE_SERVICE_ROOT, "scripts", "kpabe_encrypt.py");
const DEFAULT_NATIVE_LIB_DIR = path.join(
  STORAGE_SERVICE_ROOT,
  "python-vendor",
  "native",
  "linux-x86_64",
);

function buildLdLibraryPath(envConfig) {
  const parts = [
    envConfig.nativeLibDir || "",
    DEFAULT_NATIVE_LIB_DIR,
    process.env.LD_LIBRARY_PATH || "",
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  return Array.from(new Set(parts)).join(":");
}

export function buildKpabePackage(record, recordHash, envConfig) {
  return new Promise((resolve, reject) => {
    const child = spawn(envConfig.pythonBin || "python3", [SCRIPT_PATH], {
      cwd: STORAGE_SERVICE_ROOT,
      env: {
        ...process.env,
        PYTHONUTF8: "1",
        MEDCHAIN_CHARM_SRC: envConfig.charmSrc || "",
        MEDCHAIN_KPABE_CURVE: envConfig.kpabeCurve || "BN254",
        MEDCHAIN_KPABE_KEYSTORE_PATH: envConfig.kpabeKeyStorePath || "",
        LD_LIBRARY_PATH: buildLdLibraryPath(envConfig),
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      reject(
        new Error(
          `Khong the chay Python runtime '${envConfig.pythonBin || "python3"}': ${error.message}`,
        ),
      );
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(
          new Error(
            stderr.trim()
              || stdout.trim()
              || "KP-ABE helper failed while sealing the record.",
          ),
        );
        return;
      }

      try {
        resolve(JSON.parse(stdout));
      } catch {
        reject(new Error("KP-ABE helper returned invalid JSON output."));
      }
    });

    child.stdin.end(JSON.stringify({ record, recordHash }));
  });
}
