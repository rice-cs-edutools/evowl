const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");
const path = require("path");
const fs = require("fs");
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

/**
 * Parses a Java-style .properties file (key=value, # and ! comments, blank lines skipped).
 * Splits on the first '=' so values may contain '=', '&', ':', '?' unescaped.
 */
function readProperties(filePath) {
  const result = {};
  if (!fs.existsSync(filePath)) return result;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    result[key] = value;
  }
  return result;
}

const configPath = path.resolve(__dirname, "../../../config/application.properties");
const appConfig = readProperties(configPath);
const fetchEndpoint = appConfig["evowl.fetch-endpoint"] || "https://localhost:8444";
console.log(
  "\x1b[1m\x1b[31mUsing fetch endpoint: " + fetchEndpoint + "\x1b[0m"
);

module.exports = {
  cache: { type: "filesystem" },
  entry: "./main.ts",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "app.js",
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
      {
        test: /\.ttf$/,
        use: ["file-loader"],
      },
      {
        test: /\.tsx?$/,
        use: "ts-loader",
      },
    ],
  },
  optimization: {
      minimize: true,
      minimizer: [
          new TerserPlugin({
              extractComments: false,
          }),
      ],
  },
  plugins: [new MonacoWebpackPlugin(),
            new webpack.BannerPlugin({banner: `! This application incorporates open-source software under permissive licenses.`}),
            new webpack.DefinePlugin({ __FETCH_ENDPOINT__: JSON.stringify(fetchEndpoint) })
  ],
  resolve: {
    extensions: ["", ".js", ".jsx", ".css", ".ts", ".tsx"],
  },
  mode: "production",
};
