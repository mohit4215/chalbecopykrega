module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }]
  ],
  plugins: [
    function importMetaTransform() {
      return {
        visitor: {
          MetaProperty(path) {
            path.replaceWithSourceString('process');
          }
        }
      };
    }
  ]
};
