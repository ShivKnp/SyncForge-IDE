const MonacoWebpackPlugin = require("monaco-editor-webpack-plugin");

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.plugins.push(
        new MonacoWebpackPlugin({
          languages: ["javascript", "typescript", "python", "cpp", "java", "json"],
        })
      );
      return webpackConfig;
    },
  },
};
