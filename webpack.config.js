const path = require('path');

module.exports = {
    mode: 'development',
    entry:  __dirname + "/src/esprima.js",
    output: {
        path:  path.resolve(__dirname + "/dist"),
        filename: "esprima.js",
        libraryTarget: "umd",
        library: "esprima"
    }
}
