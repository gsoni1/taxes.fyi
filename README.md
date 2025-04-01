# Taxes.fyi Chrome Extension

A Chrome extension that adds after-tax salary information to levels.fyi salary tables.

## Features

- Automatically detects and modifies salary tables on levels.fyi
- Adds an "After Tax" column showing estimated take-home pay
- Configurable tax settings:
  - State selection (CA, NY, TX, WA)
  - Filing status options (Single, Married Filing Jointly, Head of Household)
- Tax calculations include:
  - Federal income tax with 2023 tax brackets
  - State income tax (simplified rates)
  - FICA taxes (Social Security and Medicare)
- Settings are saved and applied to all levels.fyi pages

## Installation

### Development Mode

1. Clone this repository or download the source code
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" by toggling the switch in the top-right corner
4. Click "Load unpacked" and select the directory containing the extension files
5. The extension should now be installed and active

### Testing

1. Open the included `test.html` file in Chrome to see a mock levels.fyi page
2. The extension should automatically add an "After Tax" column to the salary table
3. Click the extension icon in the toolbar to configure your tax settings

## How It Works

- The extension injects a content script into levels.fyi pages
- The script identifies salary tables and adds a new "After Tax" column
- Tax calculations are performed based on the user's selected settings
- The extension matches the styling of the original website for a seamless experience

## Limitations

- Tax calculations are simplified and should be used for estimation purposes only
- Only supports a limited number of states (CA, NY, TX, WA)
- Does not account for all possible tax deductions or credits

## License

MIT
