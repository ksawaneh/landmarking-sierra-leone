/**
 * @type {import('next-i18next').UserConfig}
 */
module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'kr'], // English and Krio
    localeDetection: false,
  },
  localePath: './public/locales',
  reloadOnPrerender: process.env.NODE_ENV === 'development',
};