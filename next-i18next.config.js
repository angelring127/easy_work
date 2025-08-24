module.exports = {
  i18n: {
    defaultLocale: "en",
    locales: ["en", "ko", "ja"],
    localeDetection: true,
  },
  localePath: "./public/locales",
  reloadOnPrerender: process.env.NODE_ENV === "development",
  debug: process.env.NODE_ENV === "development",
};
