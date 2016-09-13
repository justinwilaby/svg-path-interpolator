"use strict";
//https://pomax.github.io/bezierinfo/
const fs = require('fs');
const path = require('path');

const SVGPathInterpolator = require('../src/SVGPathInterpolator');

const configPath = process.argv[2];
const svgFile = process.argv[3];
const outputFile = process.argv[4];

function read(file) {
    return new Promise((resolve, reject) => {
        fs.access(file, fs.R_OK, (error) => {
            if (error) {
                console.log(error);
                process.exit(1);
            }
            fs.readFile(file, 'utf8', (error, data) => {
                if (data) {
                    resolve(data);
                }
                else {
                    reject(error);
                }
            });
        });
    });
}

function runJob(configJson) {
    const config = JSON.parse(configJson) || process.exit(1);
    const file = path.normalize(svgFile);
    read(file).then(svg => {
        const json = new SVGPathInterpolator(config).processSvg(svg);
        const jsonStr = JSON.stringify(json, null, (config.pretty ? config.prettyIndent : 0));
        if (outputFile) {
            fs.writeFile(path.normalize(outputFile), jsonStr);
        }
        else {
            console.log(jsonStr);
        }
    })
}

read(configPath).then(runJob);