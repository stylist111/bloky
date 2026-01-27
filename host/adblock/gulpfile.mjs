/* eslint-disable import/extensions */

import gulp from "gulp";
import argparse from "argparse";
import merge from "merge-stream";
import zip from "gulp-vinyl-zip";
import { deleteAsync } from "del";
import url from "url";
import * as tasks from "./build/tasks/index.mjs";
import * as config from "./build/config/index.mjs";
import * as configParser from "./build/configParser.mjs";
import * as gitUtils from "./build/utils/git.mjs";

const argumentParser = new argparse.ArgumentParser({
  description: "Build the extension",
});

argumentParser.addArgument(["-t", "--target"], { choices: ["chrome", "firefox"] });
argumentParser.addArgument(["-o", "--outputDirectory"]);
argumentParser.addArgument(["-c", "--channel"], {
  choices: ["development", "release"],
  defaultValue: "release",
});
argumentParser.addArgument(["-b", "--build-num"]);
argumentParser.addArgument(["--ext-version"]);
argumentParser.addArgument(["--ext-id"]);
argumentParser.addArgument("--config");
argumentParser.addArgument("--manifest-path");
argumentParser.addArgument(["-m", "--manifest-version"], {
  choices: [2, 3],
  defaultValue: 2,
  type: "int",
});
argumentParser.addArgument(["--basename"]);

const args = argumentParser.parseKnownArgs()[0];
let targetDir = `./dist/devenv/${args.target}-mv${args.manifest_version}`;
if (args.outputDirectory) {
  targetDir = `${args.outputDirectory}`;
}

async function getBuildSteps(options) {
  const translations = options.target === "chrome" ? tasks.chromeTranslations : tasks.translations;
  const buildSteps = [];
  const addonName = `${options.basename}${options.target}`;

  if (options.isDevenv) {
    buildSteps.push(
      tasks.addDevEnvVersion(),
      await tasks.addTestsPage({ scripts: options.unitTests.scripts, addonName }),
    );
  }
  if (options.manifestVersion === 3) {
    buildSteps.push(tasks.mapping(config.rulesV3.mapping));
  }

  buildSteps.push(
    tasks.mapping(options.mapping),
    tasks.webpack({
      webpackInfo: options.webpackInfo,
      addonName,
      addonVersion: options.version,
      sourceMapType: options.sourceMapType,
    }),
    tasks.createManifest(options.manifest),
    translations(options.translations, options.manifest),
  );

  return buildSteps;
}

async function getBuildOptions(isDevenv, isSource) {
  if (!isSource && !args.target) {
    argumentParser.error('Argument "-t/--target" is required');
  }

  const opts = {
    isDevenv,
    target: args.target,
    channel: args.channel,
    archiveType: args.target === "chrome" ? ".zip" : ".xpi",
    manifestVersion: args.manifest_version,
  };

  // Chromium versions older than 99 don't support source map files for
  // extensions yet, so we shouldn't include them for Manifest v2 builds
  // https://issues.chromium.org/issues/40632287
  if (opts.target === "chrome" && opts.manifestVersion === 2) {
    opts.sourceMapType = isDevenv ? "inline-source-map" : false;
  } else {
    opts.sourceMapType = "source-map";
  }

  if (args.config) {
    configParser.setConfig(await import(url.pathToFileURL(args.config)));
  } else {
    configParser.setConfig(config);
  }

  let configName;
  if (isSource) {
    configName = "base";
  } else if (isDevenv && configParser.hasTarget(`${opts.target}Dev`)) {
    configName = `${opts.target}Dev`;
  } else {
    configName = opts.target;
  }

  opts.webpackInfo = configParser.getSection(configName, "webpack");
  opts.mapping = configParser.getSection(configName, "mapping");
  opts.unitTests = configParser.getSection(configName, "unitTests");
  opts.basename = configParser.getSection(configName, "basename");
  opts.version = configParser.getSection(configName, "version");
  opts.translations = configParser.getSection(configName, "translations");
  if (args.basename) {
    opts.basename = args.basename;
  }

  if (isDevenv) {
    opts.output = gulp.dest(targetDir);
  } else {
    opts.baseversion = opts.version;
    if (opts.channel === "development") {
      opts.version = args.build_num
        ? opts.version.concat(".", args.build_num)
        : opts.version.concat(".", await gitUtils.getBuildnum());
    }
  }
  if (args.ext_version) {
    opts.version = args.ext_version;
  }

  opts.manifest = await tasks.getManifestContent({
    target: opts.target,
    version: opts.version,
    channel: opts.channel,
    extensionId: args.ext_id,
    manifestPath: args.manifest_path,
    manifestVersion: args.manifest_version,
  });
  return opts;
}

async function getBuildOutput(opts) {
  if (opts.isDevenv) {
    return gulp.dest(targetDir);
  }

  const filenameTarget = opts.channel === "release" ? opts.target : `${opts.target}${opts.channel}`;
  const filenameVersion = await getFilenameVersion(opts);

  const filenameParts = [
    opts.basename,
    filenameTarget,
    filenameVersion,
    `mv${opts.manifestVersion}`,
  ];
  const filename = `${filenameParts.join("-")}${opts.archiveType}`;

  return zip.dest(`./dist/release/${filename}`);
}

async function getFilenameVersion(opts) {
  try {
    const hasReleaseTag = await gitUtils.hasTag(`${opts.basename}-${opts.baseversion}`);
    if (hasReleaseTag) {
      return opts.version;
    }
  } catch (ex) {
    // We may not be running in the context of a git repository, such as
    // when generating builds from the source archive
    return opts.version;
  }

  return gitUtils.getCommitHash();
}

async function buildDevenv() {
  const options = await getBuildOptions(true);
  const output = await getBuildOutput(options);
  const steps = await getBuildSteps(options);

  return new Promise((resolve, reject) =>
    merge(steps).pipe(output).on("finish", resolve).on("error", reject),
  );
}

async function buildPacked() {
  const options = await getBuildOptions(false);
  const output = await getBuildOutput(options);
  const steps = await getBuildSteps(options);

  return new Promise((resolve, reject) =>
    merge(steps).pipe(output).on("finish", resolve).on("error", reject),
  );
}

async function cleanBuild() {
  const opts = await getBuildOptions(false);
  const filenameTarget = opts.channel === "release" ? opts.target : `${opts.target}${opts.channel}`;

  const filenameParts = [opts.basename, filenameTarget, "*", `mv${opts.manifestVersion}`];
  const filename = `${filenameParts.join("-")}${opts.archiveType}`;

  return deleteAsync(`./dist/release/${filename}`);
}

function cleanSource(basename) {
  return deleteAsync(`./dist/release/${basename}-*.tar.gz`);
}

function cleanDir() {
  return deleteAsync(targetDir);
}

export const devenv = gulp.series(cleanDir, buildDevenv);

export const build = gulp.series(cleanBuild, buildPacked);

export async function source() {
  const options = await getBuildOptions(false, true);
  const filenameVersion = await getFilenameVersion(options);

  await cleanSource(options.basename);
  return tasks.sourceDistribution(`./dist/release/${options.basename}-${filenameVersion}`);
}

function startWatch() {
  gulp.watch(
    ["*.js", "*.html", "adblock-betafish/*", "!gulpfile.js"],
    {
      ignoreInitial: false,
    },
    gulp.series(cleanDir, buildDevenv),
  );
}

export const watch = gulp.series(startWatch);
