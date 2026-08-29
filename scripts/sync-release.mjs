import { execFileSync } from "node:child_process";

const repository = process.env.GITHUB_REPOSITORY ?? "developercharloh/cryptohuckerbots";
const [owner, repo] = repository.split("/");
const branch = process.env.GITHUB_BRANCH ?? "main";
const githubToken = process.env.GITHUB_TOKEN;

if (!githubToken) {
  throw new Error("GITHUB_TOKEN is required to sync the successful build.");
}

if (!owner || !repo) {
  throw new Error(`Invalid GITHUB_REPOSITORY: ${repository}`);
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: "inherit",
    ...options,
  });
}

try {
  execFileSync("git", ["remote", "get-url", "origin"], { stdio: "ignore" });
} catch {
  git(["remote", "add", "origin", `https://github.com/${repository}.git`]);
}

git(["add", "-A"]);

let hasChanges = true;
try {
  execFileSync("git", ["diff", "--cached", "--quiet"], { stdio: "ignore" });
  hasChanges = false;
} catch {
  hasChanges = true;
}

if (!hasChanges) {
  console.log("Build succeeded; there are no new changes to commit.");
} else {
  git([
    "-c",
    "user.name=Replit Build Sync",
    "-c",
    "user.email=replit-build-sync@users.noreply.github.com",
    "commit",
    "-m",
    "chore: sync successful Replit build",
  ]);
}

const gitEnv = {
  ...process.env,
  GIT_CONFIG_COUNT: "1",
  GIT_CONFIG_KEY_0: "http.extraheader",
  GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${githubToken}`).toString("base64")}`,
};

git(["push", "origin", `HEAD:${branch}`], { env: gitEnv });
console.log(`Pushed the successful build to ${repository}:${branch}.`);

if (!process.env.VERCEL_TOKEN) {
  console.warn("VERCEL_TOKEN is not set; skipping the Vercel linkage check.");
  process.exit(0);
}

try {
  const response = await fetch("https://api.vercel.com/v9/projects?limit=100", {
    headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
  });

  if (!response.ok) {
    console.warn(`GitHub push succeeded, but Vercel returned HTTP ${response.status}.`);
    process.exit(0);
  }

  const payload = await response.json();
  const linkedProjects = (payload.projects ?? []).filter(
    (project) =>
      project.link?.type === "github" &&
      project.link?.org === owner &&
      project.link?.repo === repo,
  );

  if (linkedProjects.length === 0) {
    console.warn(
      `GitHub push succeeded, but no Vercel project is linked to ${repository}.`,
    );
  } else {
    console.log(
      `Vercel will deploy linked project(s): ${linkedProjects
        .map((project) => project.name)
        .join(", ")}.`,
    );
  }
} catch (error) {
  console.warn(
    `GitHub push succeeded, but the Vercel linkage check failed: ${error.message}`,
  );
}