// Bloky's own texts for the redesigned pages (English and Russian).
// node tools/bloky/bloky-strings.mjs
// Adds new "bloky_*" keys and rewrites a few stock texts in host/adblock/_locales/{en_US,ru}.
// Other languages fall back to English for the new keys. Safe to run again.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const locales = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "host",
  "adblock",
  "_locales",
);

// key: [English, Russian]
const texts = {
  // toolbar window
  bloky_disabled_site_text: [
    "Bloky works on regular websites. Browser pages and the extension store have nothing to block.",
    "Bloky работает на обычных сайтах. На служебных страницах браузера и в магазине расширений блокировать нечего.",
  ],
  disabled_site_title: ["Nothing to block here", "Здесь нечего блокировать"],
  bloky_state_paused_visit: ["Paused on this site", "Пауза на этом сайте"],
  bloky_state_paused_all: ["Paused on all sites", "Пауза на всех сайтах"],
  bloky_state_allowlisted: [
    "This site is always allowed",
    "Этот сайт в исключениях",
  ],
  status_domain_paused: [
    "Until you leave this site. Reload the page if the ads haven't come back.",
    "До конца этого посещения. Если реклама не появилась, обновите страницу.",
  ],
  status_allowlisted: [
    "Bloky won't block ads here until you turn it back on.",
    "Bloky не блокирует рекламу на этом сайте, пока вы не включите его снова.",
  ],
  disabled_on_all_sites: [
    "Ads aren't blocked on any site.",
    "Реклама не блокируется ни на одном сайте.",
  ],
  unpause_adblock: ["Resume blocking", "Снова блокировать"],
  // asked when more than 6 filter lists are on
  you_know_thats_a_bad_idea_right: [
    "Every extra list slows the browser a little, and too many can break sites. Turn it on anyway?",
    "Каждый лишний список немного замедляет браузер, а слишком много списков могут ломать сайты. Всё равно включить?",
  ],
  // status of a filter list whose updates do not fit into Chrome's rule limit
  ab_filters_subscription_lastDownload_diffTooManyFilters: [
    "Works, but its latest updates don't fit into the browser's limit.",
    "Работает, но свежие обновления не помещаются в лимит браузера.",
  ],
  // confirmation windows in the popup
  cookie_consent_cutter_title: ["Cookie pop-ups", "Окна про cookie"],
  distraction_control_new: [
    "Hiding distractions is still being improved, so some may slip through.",
    "Скрытие отвлекающего ещё дорабатывается, поэтому что-то может проскочить.",
  ],
  your_participation: [
    "If a site breaks, tell us on GitHub.",
    "Если какой-то сайт сломается, напишите нам на GitHub.",
  ],
  error_msg_header: ["Something went wrong", "Что-то пошло не так"],
  error_msg_partI: [
    "The Bloky window didn't load.",
    "Окно Bloky не загрузилось.",
  ],
  error_msg_reload_partI: ["Try ", "Попробуйте "],
  error_msg_reload_partII: [
    "restarting the extension.",
    "перезапустить расширение.",
  ],
  error_msg_help_partI: ["Still broken? ", "Не помогло? "],
  error_msg_help_partII: ["Tell us on GitHub.", "Напишите нам на GitHub."],

  // settings: sidebar
  bloky_translators: ["Translators", "Переводчики"],
  bloky_translators_text: [
    "Thanks to everyone who translated Bloky (and AdBlock, which it is based on) into your language:",
    "Спасибо всем, кто перевёл Bloky (и AdBlock, на котором он основан) на ваш язык:",
  ],

  // settings: general
  bloky_general_lead: [
    "How Bloky behaves in your browser.",
    "Как Bloky ведёт себя в браузере.",
  ],
  bloky_group_ads: ["Ads", "Реклама"],
  bloky_group_button: ["Button and menu", "Кнопка и меню"],
  bloky_group_advanced: ["For advanced users", "Для опытных"],
  bloky_desc_acceptable_ads: [
    "Small ads that don't get in the way. Off by default.",
    "Небольшая реклама, которая не мешает читать. По умолчанию выключено.",
  ],
  bloky_desc_context_menu: [
    "Bloky items in the right-click menu.",
    "Пункты Bloky в меню по правой кнопке мыши.",
  ],
  bloky_desc_count_button: [
    "The number on the Bloky icon next to the address bar.",
    "Число на значке Bloky рядом с адресной строкой.",
  ],
  bloky_desc_count_menu: [
    "The counter in the Bloky window.",
    "Счётчик в окне Bloky.",
  ],
  bloky_desc_devtools: [
    "A Bloky tab in the developer tools (F12).",
    "Вкладка Bloky в инструментах разработчика (F12).",
  ],
  bloky_desc_advanced: [
    "More options for filter lists and troubleshooting.",
    "Больше настроек для списков фильтров и поиска проблем.",
  ],
  advanced_options2: [
    "Show advanced options",
    "Показывать дополнительные параметры",
  ],

  // settings: page titles
  generaloptions2: ["General", "Общие"],
  filterstabtitle: ["Filter lists", "Списки фильтров"],
  tabcustomizetitle: ["Customize", "Свои правила"],
  tabcustomize: ["Customize", "Свои правила"],
  statstitle: ["Statistics", "Статистика"],

  // settings: filter lists
  bloky_filters_lead: [
    "Rule lists Bloky uses to find ads. They update on their own.",
    "Списки правил, по которым Bloky находит рекламу. Обновляются сами.",
  ],
  bloky_update_now: ["Update now", "Обновить сейчас"],

  // settings: appearance
  themes: ["Appearance", "Оформление"],
  bloky_theme_lead: [
    "How the Bloky window and this page look.",
    "Как выглядят окно Bloky и эта страница.",
  ],
  bloky_theme_system: ["System", "Как в системе"],
  bloky_theme_system_text: [
    "Light or dark, like your computer.",
    "Светлая или тёмная — как на компьютере.",
  ],
  bloky_theme_light: ["Light", "Светлая"],
  bloky_theme_light_text: ["Always light.", "Всегда светлая."],
  dark_theme: ["Dark", "Тёмная"],
  bloky_theme_dark_text: ["Always dark.", "Всегда тёмная."],

  // settings: support
  adblocksupport: ["Support", "Поддержка"],
  aboutadblock: ["About Bloky", "О Bloky"],
  bloky_support_lead: [
    "Questions, problems and ideas go to GitHub.",
    "Вопросы, проблемы и идеи — на GitHub.",
  ],
  bloky_support_issue_title: ["Report a problem", "Сообщить о проблеме"],
  bloky_support_issue_text: [
    "An ad slipped through, a site broke, or you have an idea? Write to us on GitHub.",
    "Реклама проскочила, сайт сломался или есть идея? Напишите нам на GitHub.",
  ],
  bloky_support_issue_button: ["Write on GitHub", "Написать на GitHub"],
  bloky_version: ["Version", "Версия"],
  bloky_whats_new: ["What's new", "Что нового"],
  bloky_whats_new_text: [
    "Changes in every release.",
    "Изменения в каждой версии.",
  ],
  bloky_open: ["Open", "Открыть"],
  bloky_source_code: ["Source code", "Исходный код"],
  bloky_source_code_text: [
    "Bloky is open source (GPL-3.0) and based on AdBlock.",
    "Bloky — открытый проект (GPL-3.0) на основе AdBlock.",
  ],
  bloky_debug_title: ["Debug data", "Данные для отладки"],
  bloky_debug_text: [
    "If we ask for it, download the file and attach it to your message.",
    "Если мы попросим — скачайте файл и приложите к сообщению.",
  ],
  bloky_download: ["Download", "Скачать"],
  bloky_tech_info: ["Technical details", "Техническая информация"],
  // still shown by older code paths: no AdBlock e-mail address
  bugreport: ["[[Write to us on GitHub]]", "[[Напишите нам на GitHub]]"],
  helpcenter: [
    "Have questions? [[Ask on GitHub]]",
    "Есть вопросы? [[Спросите на GitHub]]",
  ],
};

for (const [index, locale] of [
  [0, "en_US"],
  [1, "ru"],
]) {
  const file = join(locales, locale, "messages.json");
  const messages = JSON.parse(readFileSync(file, "utf8"));
  for (const [key, values] of Object.entries(texts)) {
    const entry = messages[key] || { description: "Bloky" };
    // keep placeholders of stock keys, replace only the text people see
    messages[key] = { ...entry, message: values[index] };
  }
  writeFileSync(file, `${JSON.stringify(messages, null, 2)}\n`);
  console.log(`${locale}: ${Object.keys(texts).length} texts`);
}
