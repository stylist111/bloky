/* eslint-env node */

module.exports = {
  env: {
    browser: true,
    jquery: true,
    node: false,
  },
  extends: [
    "airbnb-base",
    "prettier",
    "prettier/prettier",
    "plugin:@typescript-eslint/eslint-recommended",
  ],
  plugins: ["no-unsanitized", "@typescript-eslint"],
  rules: {
    "linebreak-style": "off",
    strict: ["error", "global"],
    "func-names": ["error", "as-needed"],
    "brace-style": ["error", "1tbs", { allowSingleLine: false }],
    "no-cond-assign": ["error", "except-parens"],
    curly: ["error", "all"],
    "guard-for-in": "off",
    "import/prefer-default-export": "off",
    "no-plusplus": ["error", { allowForLoopAfterthoughts: true }],
    "no-global-assign": ["error", { exceptions: ["savedData"] }],
    "no-unsanitized/method": "error",
    "no-unsanitized/property": ["error", { escape: { methods: ["DOMPurify.sanitize"] } }],
    "no-underscore-dangle": [
      "error",
      {
        allow: [
          "_url",
          "_filterText",
          "_title",
          "_subscriptions",
          "_lastDownload",
          "_downloadStatus",
        ],
      },
    ],
    camelcase: [
      "error",
      {
        allow: [
          "adblock_installed",
          "adblock_userid",
          "adblock_version",
          "adblock_ext_id",
          "adblock_block_count",
          "blockage_stats",
          "bug_report",
          "synchronize_invalid_url",
          "synchronize_connection_error",
          "synchronize_invalid_data",
          "synchronize_checksum_mismatch",
          "synchronize_diff_error",
          "synchronize_diff_too_many_filters",
          "synchronize_diff_too_old",
          "synchronize_dnr_error",
          "error_msg_header",
          "error_msg_help_us",
          "error_msg_thank_you",
          "error_msg_reload",
          "error_msg_help",
          "error_msg_partI",
          "show_statsinicon",
          "myadblock_enrollment",
          "popup_menu",
          "options_page",
          "install_timestamp",
          "debug_logging",
          "show_advanced_options",
          "show_statsinpopup",
          "display_menu_stats",
          "show_survey",
          "twitch_hiding",
          "color_themes",
          "original_sid",
          "updated_sid",
          "block_count_limit",
          "web_accessible_resources",
          "strict_min_version",
          "app_id_release",
          "app_name",
          "browser_name",
          "language_tag",
          "app_version",
          "command_library_version",
          "command_name",
          "command_version",
          "install_type",
          "device_id",
          "user_time",
          "ipm_id",
          "blocked_total",
          "domain_list",
          "license_status",
          "license_state_list",
          "experiment_id",
          "variant_id",
          "extension_id",
          "browser_version",
          "manifest_version",
          "ping_count",
        ],
      },
    ],
    "spaced-comment": ["error", "always", { markers: ["#"] }],
    "import/extensions": [
      "error",
      "ignorePackages",
      {
        "": "never",
        js: "never",
        ts: "never",
      },
    ],
    "import/no-unresolved": "off",
    /**
     * These rules are disabled, because they're no longer expected to apply
     * after we switch from Airbnb to Standard
     */
    "no-continue": "off",
    "no-restricted-syntax": "off",
    "no-void": "off",
    "no-use-before-define": "off",
    // The no-shadow rule must be used from @typescript-eslint instead of
    // eslint, because it triggers false positives for any enum declaration.
    // See https://typescript-eslint.io/rules/no-shadow/#how-to-use
    "no-shadow": "off",
    "@typescript-eslint/no-shadow": "error",

    // The no-unused-vars rule must be used from @typescript-eslint instead of
    // eslint, because it triggers false positives for globals in *.d.ts files.
    // See https://typescript-eslint.io/rules/no-unused-vars/#how-to-use
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": "error",
    "no-await-in-loop": "off",
  },
  parserOptions: {
    sourceType: "script",
  },
  parser: "@typescript-eslint/parser",
  settings: {
    // https://stackoverflow.com/questions/41769880/how-to-manually-add-a-path-to-be-resolved-in-eslintrc
    "import/resolver": {
      node: {
        paths: ["adblockplusui/lib/", "adblockplusui/adblockpluschrome/lib/"],
      },
    },
  },
  overrides: [
    {
      files: ["*.mjs", "*.js", "*.ts"],
      parserOptions: {
        sourceType: "module",
        allowImportExportEverywhere: true,
        ecmaVersion: 13,
      },
    },
  ],
  globals: {
    modulesAsGlobal: true,
  },
};
