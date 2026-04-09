import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { Injectable } from "@nestjs/common";

@Injectable()
export class PathService {
  readonly repoRoot = process.cwd();

  resolveRepoPath(targetPath: string): string {
    if (path.isAbsolute(targetPath)) {
      return path.resolve(targetPath);
    }
    return path.resolve(this.repoRoot, targetPath);
  }

  relativeToRepo(targetPath: string): string {
    return path.relative(this.repoRoot, path.resolve(targetPath)).replaceAll(path.sep, "/");
  }

  async readText(targetPath: string): Promise<string> {
    return fs.readFile(targetPath, "utf8");
  }

  async readJson<T>(targetPath: string): Promise<T> {
    return JSON.parse(await this.readText(targetPath)) as T;
  }

  async exists(targetPath: string): Promise<boolean> {
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  async ensureDir(targetPath: string): Promise<void> {
    await fs.mkdir(targetPath, { recursive: true });
  }

  sha256Text(text: string): string {
    return createHash("sha256").update(text, "utf8").digest("hex");
  }
}
