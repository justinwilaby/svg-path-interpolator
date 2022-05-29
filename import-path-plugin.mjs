import ts from 'typescript';
import path from 'path';
import fs from 'fs';

import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { name } = JSON.parse(fs.readFileSync('./package.json').toString());

const afterTransformerFactory = context => {
  return rootNode => {
    function visit(node) {
      node = ts.visitEachChild(node, visit, context);
      const { dir: currentFileDirectory } = path.parse(rootNode.fileName);
      if (ts.isImportDeclaration(node) && !node.isTypeOnly) {
        const {
          moduleSpecifier: { text },
          importClause,
        } = node;
        const { ext } = path.parse(text);
        // 3rd party library imports are converted to
        // use relative paths.
        // import {} from 'my-3rd-party-dep' becomes import {} from './my-3rd-party-dep/entryFile.js'
        if (!text.startsWith('/') && !text.startsWith('.')) {
          const resolvedImportPath = path.resolve(context.getCompilerOptions().baseUrl, text);
          const relativeImportPath = path.relative(currentFileDirectory, resolvedImportPath);
          const relativeRootPath = path.relative(name, './');
          const packageJson = findPackageJson(text);
          const transformedImportPath = path.join(relativeRootPath, relativeImportPath, packageJson.module).replace(`..`, '.');
          const moduleSpecifier = ts.factory.createStringLiteral(transformedImportPath, true);
          return ts.factory.updateImportDeclaration(node, undefined, undefined, importClause, moduleSpecifier);
        } else if (ext !== '.js') {
          const decl = findFile(text, currentFileDirectory);
          const moduleSpecifier = ts.factory.createStringLiteral(decl, true);
          return ts.factory.updateImportDeclaration(node, undefined, undefined, importClause, moduleSpecifier);
        }
      }
      // export * from '';
      else if (ts.isExportDeclaration(node) && node.moduleSpecifier && !node.moduleSpecifier.text.endsWith('.js')) {
        const decl = findFile(node.moduleSpecifier.text, currentFileDirectory);
        const stringLiteral = ts.factory.createStringLiteral(decl, true);
        return ts.factory.updateExportDeclaration(node, undefined, undefined, undefined, node.exportClause, stringLiteral);
      } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        const { text } = node.arguments[0];
        const decl = findFile(text, currentFileDirectory);
        const moduleSpecifier = ts.factory.createStringLiteral(decl, true);
        return ts.factory.updateCallExpression(node, node.expression, null, [moduleSpecifier]);
      }
      return node;
    }

    return ts.visitNode(rootNode, visit);
  };
};

function findFile(text, currentFileDirectory) {
  // determine if the target file exists
  let decl = text;
  const exists = fs.existsSync(path.join(currentFileDirectory, text + '.ts'));
  if (!exists) {
    // This might be a barrel import - look for an index.ts
    if (fs.existsSync(path.resolve(currentFileDirectory, text, 'index.ts'))) {
      decl += '/index.js';
    }
  } else {
    decl += '.js';
  }
  return decl;
}

function findPackageJson(moduleSpecifier) {
  const fragments = require.resolve(moduleSpecifier).split(path.sep);
  let i = fragments.length;
  while (i--) {
    try {
      const buffer = fs.readFileSync(path.join(fragments.slice(0, i).join(path.sep), 'package.json'));
      return JSON.parse(buffer.toString());
    } catch {}
  }
}

/**
 * Entry function for the project compiler.
 */
function compile() {
  const configPath = ts.findConfigFile('./', ts.sys.fileExists, 'tsconfig.json');
  const tsconfig = JSON.parse(fs.readFileSync(configPath).toString());
  // The options do not translate directly
  // from the tsconfig.json so we have to
  // hard code them here :(
  Object.assign(tsconfig, {
    compilerOptions: {
      ...tsconfig.compilerOptions,
      moduleResolution: ts.ModuleResolutionKind.NodeJs,
      module: ts.ModuleKind[tsconfig.compilerOptions.module],
      target: ts.ScriptTarget[tsconfig.compilerOptions.target],
      declaration: false,
      emitDeclarationOnly: false,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues[tsconfig.compilerOptions.importsNotUsedAsValues],
    },
  });
  const compilerHost = ts.createCompilerHost(tsconfig.compilerOptions);
  const program = ts.createProgram(tsconfig.files, tsconfig.compilerOptions, compilerHost);
  const emittedResult = program.emit(undefined, undefined, undefined, false, {
    after: [afterTransformerFactory],
  });
}

compile();
