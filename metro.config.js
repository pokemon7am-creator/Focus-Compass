const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The shared API client is a workspace package. pnpm can resolve its React Query
// peer to a different React instance than the mobile app, splitting QueryClient
// context between the provider and generated hooks.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@tanstack/react-query' || moduleName === 'react' || moduleName.startsWith('react/')) {
    return context.resolveRequest(
      context,
      require.resolve(moduleName, { paths: [__dirname] }),
      platform,
    );
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
