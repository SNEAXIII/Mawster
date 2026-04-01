module.exports = {
  presets: ['next/babel'],
  plugins: [
    process.env.NODE_ENV === 'development' && '@react-dev-inspector/babel-plugin',
  ].filter(Boolean),
};
