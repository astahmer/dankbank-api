const webpack = require("webpack");
const path = require("path");
const nodeExternals = require("webpack-node-externals");
const { loader } = require("webpack-loader-helper");
const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");
const WebpackShellPlugin = require("webpack-shell-plugin");

const pollInterval = 500;

module.exports = {
    entry: [`webpack/hot/poll?${pollInterval}`, "./src/main.ts"],
    watch: true,
    target: "node",
    devtool: "inline-cheap-module-source-map",
    externals: [
        nodeExternals({
            whitelist: [`webpack/hot/poll?${pollInterval}`],
        }),
    ],
    mode: "development",
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
        plugins: [new TsconfigPathsPlugin({})],
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new webpack.EnvironmentPlugin({ NODE_ENV: "development" }),
        new WebpackShellPlugin({
            onBuildEnd: ["npm run start"],
        }),
    ],
    cache: true,
    module: {
        rules: [
            {
                test: /.tsx?$/,
                exclude: /node_modules/,
                use: [loader("ts", { transpileOnly: true, compilerOptions: {} })],
            },
        ],
    },
    output: {
        path: path.join(__dirname, "build"),
        filename: "server.js",
    },
    node: {
        __dirname: false,
        __filename: false,
    },
};
