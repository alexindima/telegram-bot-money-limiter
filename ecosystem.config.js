module.exports = {
    apps: [
        {
            name: "telegram-bot",
            script: "./dist/bot.js",
            cwd: "/var/www/telegram-bot-money-limiter",
            env: {
                NODE_ENV: "production",
            }
        }
    ]
};
