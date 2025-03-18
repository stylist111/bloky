/*
 * This file is part of Adblock Plus <https://adblockplus.org/>,
 * Copyright (C) 2006-present eyeo GmbH
 *
 * Adblock Plus is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3 as
 * published by the Free Software Foundation.
 *
 * Adblock Plus is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adblock Plus.  If not, see <http://www.gnu.org/licenses/>.
 */

import { existsSync } from "fs";
import gulp from "gulp";
import merge from "merge-stream";
import changePath from "../utils/gulp-change-path.mjs";

function resolveBundleSrc(bundle) {
  let src = bundle.src;
  if (bundle.package) {
    let packagePath = `node_modules/${bundle.package}`;
    if (!existsSync(packagePath)) {
      packagePath = `../../${packagePath}`;
    }
    if (!existsSync(packagePath)) {
      packagePath = `../../fragment/${bundle.package}`;
    }
    if (!existsSync(packagePath)) {
      throw new Error(`${bundle.package} not found. Do you need to npm install?`);
    }

    if (Array.isArray(bundle.src)) {
      src = bundle.src.map((bundleSrc) => `${packagePath}/${bundleSrc}`);
    } else {
      src = `${packagePath}/${bundle.src}`;
    }
  }
  return src;
}

export default function mapping(bundles) {
  return merge(
    bundles.copy.map((bundle) => {
      return gulp.src(resolveBundleSrc(bundle)).pipe(changePath(bundle.dest));
    }),
    bundles.rename.map((bundle) =>
      gulp.src(resolveBundleSrc(bundle)).pipe(changePath(bundle.dest, { rename: true })),
    ),
  );
}
