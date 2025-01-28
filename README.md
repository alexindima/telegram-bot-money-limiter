# Telegram Bot Money Limiter

**Telegram Bot Money Limiter** is a bot for managing personal finances. The bot allows users to set a budget for a specific number of days, track expenses, and receive useful information, such as the remaining balance and the average budget for the remaining days.

---

## Features

- **Budget Management**:
    - Set a total budget and the number of days.
    - Add expenses and track the remaining balance.
    - Get information about the average daily budget for the remaining days.

- **Expense Tracking**:
    - Return money back to the budget.
    - View a list of all purchases (in development).

- **Flexible Management**:
    - Modify the budget limit and the remaining number of days.
    - Delete all user data to start fresh.

---

## Installation

### 1. Clone the repository
```bash
git clone https://github.com/alexindima/telegram-bot-money-limiter.git
cd telegram-bot-money-limiter
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a .env file in the project root and add your Telegram Bot API token:

```plaintext
BOT_TOKEN=your_bot_token
```

### 4. Start the bot
```bash
npm run start
```

## Bot Commands

| Command                 | Description                                                                       |
|-------------------------|-----------------------------------------------------------------------------------|
| `/start`                | Start using the bot.                                                              |
| `/help`                 | Show a list of all available commands.                                            |
| `/status`               | Check the current balance and average daily budget for the remaining days.        |
| `/refund <сумма>`       | Return an amount back to the budget. Example: `/refund 20`.                       |
| `/setlimit <сумма>`     | Change the total budget limit. Example: `/setlimit 500`.                          |
| `/setdays <дни>`        | Change the number of remaining days. Example: `/setdays 10`.                      |
| `/settimezone <±HH:MM>` | Set the timezone. Example: `/settimezone +03:30`.                                 |
| `/report`               | View a list of all purchases (in development: adding date and time to purchases). |
| `/info`                 | Display information about your account.                                           |
| `/stop`                 | Delete all user data and stop using the bot.                                      |
|

## Requirements

- Node.js >= 16.x
- Telegram Bot API Token
- SQLite (integrated into Node.js via `better-sqlite3`)

## License

This project is distributed under the **ISC** license.

## Future Plans

- Add an option to export expense data to CSV/Excel.
- Support for multiple currencies.
- More detailed reports with expense categorization.
- Add spending statistics (charts and graphs).
