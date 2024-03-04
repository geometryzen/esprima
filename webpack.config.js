const path = require('path');

module.exports = {
    mode: 'development',
    entry:  __dirname + "/src/index.js",
    output: {
        path:  path.resolve(__dirname + "/dist/commonjs"),
        filename: "index.js",
        libraryTarget: "umd",
        library: "esprima"
    }
}
