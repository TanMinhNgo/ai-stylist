// Metro config: Expo defaults (monorepo aware) plus .bin for the generated mannequin meshes.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.assetExts.push('bin');

module.exports = config;
