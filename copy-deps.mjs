import fs from 'fs/promises';
import path from 'path';
import glob from 'glob';

import {createRequire} from 'module';
const require = createRequire(import.meta.url);

// const saxPath = require.resolve('sax-wasm/lib/sax-wasm.wasm');
//
// async function copy() {
//   const tsConfigBuffer = await fs.readFile('./tsconfig.json');
//   const {compilerOptions: {outDir}} = JSON.parse(tsConfigBuffer.toString());
//   await fs.mkdir(outDir, {recursive: true});
//   const {name, ext} = path.parse(saxPath)
//   const dir = path.resolve(outDir, name + ext);
//   await fs.copyFile(saxPath, dir);
// }

export async function findPackageJsonFrom(dependencyPath) {
  const parts = dependencyPath.split(path.sep);
  let i = parts.length;
  while (i--) {
    try {
      const packageJsonRoot = parts.slice(0, i).join(path.sep);
      const packageJsonBuffer = await fs.readFile(path.join(packageJsonRoot, 'package.json'));
      const packageJson = JSON.parse(packageJsonBuffer.toString());
      return { packageJsonRoot, packageJson };
    } catch {
    }
  }
}

export async function copyDependencies(dependencyName, resolvedOutputPath) {
  const require = createRequire(import.meta.url);
  const resolvedPath = require.resolve(dependencyName);
  const { packageJson: { files, name }, packageJsonRoot } = await findPackageJsonFrom(resolvedPath);
  if (files) {
    for (let i = 0; i < files.length; i++) {
      const from = path.resolve(packageJsonRoot, files[i]);
      const globbed = glob.sync(from, { nodir: true });
      if (!globbed) {
        continue;
      }
      for (let j = 0; j < globbed.length; j++) {
        const [, relativePath] = globbed[j].replace(/[\/]/g, path.sep).split(packageJsonRoot + path.sep);

        const to = path.join(resolvedOutputPath, name, relativePath);
        const { dir: destinationDir } = path.parse(to);
        await fs.mkdir(destinationDir, {recursive: true});
        await fs.copyFile(globbed[j], to);
      }
    }
  } else {
    const { dir: destinationDir } = path.parse(path.resolve(resolvedOutputPath, name));
    await fs.mkdir(destinationDir, {recursive: true});
    await fs.copyFile(packageJsonRoot, path.resolve(resolvedOutputPath, name));
  }
}

async function copyLocalDependencies() {
  const packageJsonBuffer = await fs.readFile('./package.json');
  const {dependencies} = JSON.parse(packageJsonBuffer.toString());

  const keys = Object.keys(dependencies);
  for (let i = 0; i < keys.length; i++) {
    const dependencyName = keys[i];
    if (dependencyName === 'fs-extra' || dependencyName === 'glob') {
      continue;
    }
    await copyDependencies(dependencyName, 'lib');
  }
}


copyLocalDependencies().then();
