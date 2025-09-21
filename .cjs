module.exports = {
  files: ["*.cjs"],
  languageOptions: {
    parser: require.resolve("espree"),
    ecmaVersion: "latest",
    sourceType: "script", // because CJS
  },
  rules: {
    // You can keep JS-specific rules here if you want
  },
};
