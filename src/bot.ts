import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';
import { saveUser, getUser, updateUser, deleteUser, User } from './db';

const DEFAULT_TIMEZONE = 4; // UTC+4

dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    throw new Error('Токен бота не найден. Убедитесь, что BOT_TOKEN указан в файле .env.');
}

const bot = new Telegraf(BOT_TOKEN);

bot.start((ctx) => {
    const userId = ctx.from?.id;
    if (!userId) {
        return;
    }

    const user = getUser(userId);
    if (!user) {
        saveUser(userId, 0, 0, DEFAULT_TIMEZONE);
        ctx.reply('Привет! Сколько у тебя денег? Напиши сумму (например: 100).');
    } else {
        ctx.reply('Вы уже начали работу с ботом. Для просмотра текущего статуса используйте команду /status.');
    }
});

bot.command('help', (ctx) => {
    const helpMessage = `
        Доступные команды:
        /start - Начать работу с ботом.
        /status - Узнать текущий остаток и средний бюджет на оставшиеся дни.
        /refund <сумма> - Вернуть сумму в бюджет. Пример: /refund 20
        /setlimit <сумма> - Изменить общий лимит бюджета. Пример: /setlimit 500
        /setdays <дни> - Изменить количество оставшихся дней. Пример: /setdays 10
        /stop - Удалить все данные и остановить работу с ботом.
        /report - Показать список всех покупок.
        /help - Показать список доступных команд.
    `;
    ctx.reply(helpMessage);
});

bot.command('report', (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const user = getUser(userId);
    if (!user) {
        ctx.reply('Данные не найдены. Сначала введи команду /start.');
        return;
    }

    const purchases = JSON.parse(user.purchases || '[]') as number[];
    if (purchases.length === 0) {
        ctx.reply('Вы ещё не совершали покупок.');
        return;
    }

    const report = purchases
        .map((amount, index) => `#${index + 1}: ${amount.toFixed(2)}`)
        .join('\n');
    ctx.reply(`Ваши покупки:\n${report}`);
});


bot.command('status', (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const user = getUser(userId);
    if (!user) {
        ctx.reply('Данные не найдены. Сначала введи команду /start.');
        return;
    }

    const { remainingDays, dailyBudget } = calculateBudget(user);

    const now = new Date();
    const timezoneOffset = user.timezoneOffset || DEFAULT_TIMEZONE;
    const localNow = new Date(now.getTime() + timezoneOffset * 3600 * 1000);
    const startOfNextDay = new Date(
        localNow.getFullYear(),
        localNow.getMonth(),
        localNow.getDate() + 1
    ).getTime();

    const timeUntilNextDay = startOfNextDay - localNow.getTime();
    const hoursUntilNextDay = Math.floor(timeUntilNextDay / (1000 * 60 * 60));
    const minutesUntilNextDay = Math.floor((timeUntilNextDay % (1000 * 60 * 60)) / (1000 * 60));

    let response =
        `Ваш текущий остаток: ${user.totalAmount.toFixed(2)}.\n` +
        `Средний бюджет на оставшиеся ${remainingDays} дней: ${dailyBudget}.\n` +
        `До следующего дня осталось: ${hoursUntilNextDay} часов и ${minutesUntilNextDay} минут.`;

    ctx.reply(response);
});

bot.command('refund', (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const messageParts = ctx.message.text.split(' ');
    const refundAmount = parseFloat(messageParts[1]?.replace(',', '.') || '');

    if (isNaN(refundAmount) || refundAmount <= 0) {
        ctx.reply('Пожалуйста, укажите корректную сумму для возврата. Пример: /refund 20');
        return;
    }

    const user = getUser(userId);
    if (!user) {
        ctx.reply('Данные не найдены. Сначала введи команду /start.');
        return;
    }

    const newTotalAmount = user.totalAmount + refundAmount;
    updateUser(userId, newTotalAmount, JSON.parse(user.purchases || '[]'), user.timezoneOffset);

    ctx.reply(`Сумма ${refundAmount} возвращена. Текущий остаток: ${newTotalAmount.toFixed(2)}.`);
});

bot.command('setlimit', (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const messageParts = ctx.message.text.split(' ');
    const newLimit = parseFloat(messageParts[1]?.replace(',', '.') || '');

    if (isNaN(newLimit) || newLimit <= 0) {
        ctx.reply('Пожалуйста, укажите корректный новый лимит. Пример: /setlimit 500');
        return;
    }

    const user = getUser(userId);
    if (!user) {
        ctx.reply('Данные не найдены. Сначала введи команду /start.');
        return;
    }

    const purchases = JSON.parse(user.purchases || '[]');
    updateUser(userId, newLimit, purchases, user.timezoneOffset);

    ctx.reply(`Лимит бюджета изменен. Новый лимит: ${newLimit.toFixed(2)}.`);
});

bot.command('setdays', (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const messageParts = ctx.message.text.split(' ');
    const newDays = parseInt(messageParts[1], 10);

    if (isNaN(newDays) || newDays <= 0) {
        ctx.reply('Пожалуйста, укажите корректное количество дней. Пример: /setdays 15');
        return;
    }

    const user = getUser(userId);
    if (!user) {
        ctx.reply('Данные не найдены. Сначала введи команду /start.');
        return;
    }

    saveUser(userId, user.totalAmount, newDays, user.timezoneOffset);

    ctx.reply(`Количество дней изменено. Новое количество дней: ${newDays}.`);
});

bot.command('settimezone', (ctx) => {
    const messageParts = ctx.message.text.split(' ');
    if (messageParts.length < 2) {
        ctx.reply('Пожалуйста, укажите ваш часовой пояс в формате ±HH:MM (например, +03:00 или -05:45).');
        return;
    }

    const timezoneInput = messageParts[1];
    const match = timezoneInput.match(/^([+-]\d{1,2}):(\d{2})$/);

    if (!match) {
        ctx.reply('Пожалуйста, введите корректный часовой пояс в формате ±HH:MM (например, +03:30 или -05:45).');
        return;
    }

    const sign = match[1][0]; // "+" или "-"
    const hours = parseInt(match[1].slice(1), 10);
    const minutes = parseInt(match[2], 10);

    if (isNaN(hours) || isNaN(minutes) || hours > 14 || minutes > 59) {
        ctx.reply('Часовой пояс должен быть в диапазоне от -12:00 до +14:00. Попробуйте еще раз.');
        return;
    }

    // Рассчитываем смещение в часах
    let timezoneOffset = hours + minutes / 60;
    if (sign === '-') {
        timezoneOffset = -timezoneOffset;
    }

    const userId = ctx.from?.id;
    if (!userId) {
        ctx.reply('Не удалось определить пользователя.');
        return;
    }

    const user = getUser(userId);
    if (!user) {
        ctx.reply('Сначала используйте команду /start.');
        return;
    }

    updateUser(userId, user.totalAmount, JSON.parse(user.purchases || '[]'), timezoneOffset);

    ctx.reply(`Ваш часовой пояс установлен: UTC${timezoneOffset >= 0 ? `+${timezoneOffset.toFixed(2)}` : timezoneOffset.toFixed(2)}.`);
});

bot.command('stop', (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const user = getUser(userId);
    if (!user) {
        ctx.reply('Данные не найдены. Сначала введи команду /start.');
        return;
    }

    deleteUser(userId);
    ctx.reply('Ваши данные успешно удалены. Если захотите начать заново, используйте команду /start.');
});


bot.hears(/.*/, (ctx) => {
    const userId = ctx.from?.id;
    if (!userId) return;

    const user = getUser(userId);
    if (!user) {
        saveUser(userId, 0, 0, DEFAULT_TIMEZONE);
        ctx.reply('Сначала введи команду /start.');
        return;
    }

    const message = ctx.message.text;

    if (user.totalAmount === 0) {
        const amount = parseFloat(message.replace(',', '.'));
        if (isNaN(amount) || amount <= 0) {
            ctx.reply('Пожалуйста, введи корректную сумму.');
            return;
        }

        saveUser(userId, amount, 0, user.timezoneOffset);
        ctx.reply('На сколько дней рассчитаны эти деньги?');
        return;
    }

    if (user.days === 0) {
        const days = parseInt(message, 10);
        if (isNaN(days) || days <= 0) {
            ctx.reply('Пожалуйста, введи корректное количество дней.');
            return;
        }

        saveUser(userId, user.totalAmount, days, user.timezoneOffset);
        const dailyBudget = (user.totalAmount / days).toFixed(2);
        ctx.reply(`Твой средний бюджет на день: ${dailyBudget}. Чтобы добавить покупку, напиши сумму (например: 15).`);
        return;
    }

    const purchase = parseFloat(message.replace(',', '.'));
    if (!isNaN(purchase) && purchase > 0) {
        const purchases = JSON.parse(user.purchases || '[]') as number[];
        purchases.push(purchase);

        const newTotalAmount = user.totalAmount - purchase;
        updateUser(userId, newTotalAmount, purchases, user.timezoneOffset);

        const { remainingDays, dailyBudget } = calculateBudget({ ...user, totalAmount: newTotalAmount });

        let response =
            `Покупка на сумму ${purchase} добавлена.\n` +
            `Остаток средств: ${newTotalAmount.toFixed(2)}.\n` +
            `Средний бюджет на оставшиеся ${remainingDays} дней: ${dailyBudget}.`;

        if (remainingDays > 1) {
            const futureDailyBudget = (newTotalAmount / (remainingDays - 1 || 1)).toFixed(2);
            response += `\nСредний бюджет на следующие дни без новых покупок сегодня: ${futureDailyBudget}.`;
        }

        ctx.reply(response);
    } else {
        ctx.reply('Пожалуйста, введи корректную сумму.');
    }
});

bot.launch().then(() => {
    console.log('Бот запущен!');
});

function calculateBudget(user: User): BudgetInfo {
    const timezoneOffset = user.timezoneOffset || DEFAULT_TIMEZONE;
    const startDate = new Date(new Date(user.startDate).getTime() + timezoneOffset * 3600 * 1000);
    const now = new Date(new Date().getTime() + timezoneOffset * 3600 * 1000);

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfStartDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());

    const daysPassed = Math.floor((startOfToday.getTime() - startOfStartDate.getTime()) / (1000 * 60 * 60 * 24));
    const remainingDays = Math.max(user.days - daysPassed, 1);
    const dailyBudget = (user.totalAmount / remainingDays).toFixed(2);

    return {
        remainingDays,
        dailyBudget
    };
}



process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

export interface BudgetInfo {
    remainingDays: number;
    dailyBudget: string;
}